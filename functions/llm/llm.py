import os
import json
from math import floor
from pydantic import BaseModel
from fastapi import HTTPException
from litellm import acompletion, model_cost
from .tokenizer import Tokenizer, TiktokenTokenizer, VertexTokenizer, DefaultTokenizer
from fastapi.responses import StreamingResponse
from magicsandbox_streaming import length_prefix_transform #type: ignore

gpt_4o_tokenizer = TiktokenTokenizer('gpt-4o')
gemini_tokenizer = VertexTokenizer('gemini-1.5-flash-002')
default_tokenizer = DefaultTokenizer()

# THE ORDER OF THESE MATTERS. should be ordered from smartest to cheapest. last model is used no matter what with trim_messages
supported_models = {
    'claude-3-5-sonnet-20241022': {
        'tokenizer': default_tokenizer,
        'max_vision_tokens': 1600,
    },
    'gpt-4o-2024-08-06': {
        'tokenizer': gpt_4o_tokenizer,
        'max_vision_tokens': 1445,
    },
    'gpt-4o-mini-2024-07-18': {
        'tokenizer': gpt_4o_tokenizer, # uses same tokenizer as gpt-4o
        'max_vision_tokens': 1445,
    },
    'gemini/gemini-1.5-flash-002': {
        'tokenizer': gemini_tokenizer,
        'max_vision_tokens': 0,
        'vision_disabled': True, # can't compute cost for audio/video so need to disable until can filter it out specifically
    },
    'gemini/gemini-1.5-flash-8b-001': {
        'tokenizer': gemini_tokenizer, # note: 8b not yet included in get_tokenizer_for_model. assume same as flash-002
        'max_vision_tokens': 0,
        'vision_disabled': True,
    }
}
model_cost['gemini/gemini-1.5-flash-8b-001'] = { #not included in model_costfor some reason
    'input_cost_per_token': 0.0375 / 1000000,
    'output_cost_per_token': 0.15 / 1000000,
}
supported_models = {model: model_cost[model] | model_info for model, model_info in supported_models.items()}

base_token_count = 3 # every reply is primed with <|start|>assistant<|message|>

class LlmArgs(BaseModel):
    model: str | None = None
    messages: list[dict] | None = None
    max_completion_tokens: int | None = None
    response_format: dict | None = None
    temperature: float | None = None
    top_p: float | None = None
    frequency_penalty: float | None = None
    presence_penalty: float | None = None
    logit_bias: dict | None = None
    ## these would require returning the whole object, not just the content
    ## careful with token_counter if enabling these. and trim_messages: https://github.com/BerriAI/litellm/issues/4931
    # 'logprobs',
    # 'tools',
    # 'tool_choice',
    # 'parallel_tool_calls',

async def llm(_args: LlmArgs | str, options):
    if isinstance(_args, str):
        args = LlmArgs(messages=[{"role": "user", "content": _args}])
    else:
        args = _args
    if args.messages is None:
        raise HTTPException(status_code=400, detail='messages required')
    if args.max_completion_tokens is None:
        args.max_completion_tokens = 1000
    model, expected_cost = find_model(args, options.maxCost) # note that this may modify args.messages and args.max_completion_tokens
    args.messages = process_messages(model, args)
    api_args = args.model_dump(exclude_none=True)
    api_args.update({
        'model': model,
        'stream': True,
        'stream_options': {'include_usage': True},
    })
    stream = await acompletion(**api_args)
    return StreamingResponse(length_prefix_transform(openai_transform(stream, model, expected_cost), final_object=True),
                             headers={'x-length-prefix': 'true'})

def process_messages(model, args):
    if not supported_models[model].get('vision_disabled', False):
        return args.messages
    for message in args.messages:
        content = message.get('content')
        if content is not None and not isinstance(content, str):
            message['content'] = [c for c in content if c['type'] == 'text']
    return args.messages

def find_model(args: LlmArgs, maxCost: float):
    model = args.model
    if model is not None and model not in supported_models:
        raise HTTPException(status_code=400, detail=f'Model {model} not supported')
    if model in supported_models:
        models = [model]
    else:
        models = []
    models += [m for m in supported_models.keys() if m != model]
    token_counts = {}
    for model in models:
        model_info = supported_models[model]
        tokenizer = model_info['tokenizer']
        input_tokens = token_counts.get(tokenizer.model) # avoid recomputing
        if input_tokens is None:
            input_tokens = messages_token_counter(args.messages, tokenizer, model_info['max_vision_tokens'])
            token_counts[tokenizer.model] = input_tokens
        output_tokens = args.max_completion_tokens
        expected_cost = get_cost(model, input_tokens, output_tokens)
        if expected_cost <= maxCost:
            return model, expected_cost
    # trim messages so that we can use the last model in the list (which should be the cheapest)
    args.messages = trim_messages(args, model, input_tokens, maxCost)
    return model, maxCost

def messages_token_counter(messages, tokenizer, max_vision_tokens, return_list=False):
    # reference: https://github.com/jalcantarab/openai-cookbook/blob/62574a79b8cef067baa7b4143a77f366078d5d98/examples/How_to_count_tokens_with_tiktoken.ipynb
    # and litellm token_counter. litellm attempts to download image urls though which doesn't work for our use case
    messages_token_counts = []
    for message in messages:
        messages_token_counts.append(message_token_counter(message, tokenizer, max_vision_tokens))
    if return_list:
        return messages_token_counts
    else:
        return sum([r[0] for r in messages_token_counts]) + base_token_count

def message_token_counter(message, tokenizer: Tokenizer, max_vision_tokens):
    num_tokens = 3 # tokens per message
    content_tokens = 0
    for key, value in message.items():
        if isinstance(value, str):
            num_tokens += tokenizer.count(value)
            if key == "name":
                num_tokens += 1 #tokens per name
        elif key == "content":
            for c in value:
                if c["type"] == "text":
                    content_tokens += tokenizer.count(c["text"])
                elif c["type"] == "image_url":
                    content_tokens += max_vision_tokens
                else:
                    raise HTTPException(status_code=400, detail=f'Unknown message type: {c["type"]}')
        else:
            raise HTTPException(status_code=400, detail=f'Unknown message key: {key}')
    return num_tokens + content_tokens, content_tokens

def get_cost(model, input_tokens, output_tokens):
    model_info = supported_models[model]
    input_cost = input_tokens * model_info['input_cost_per_token']
    output_cost = output_tokens * model_info['output_cost_per_token']
    return input_cost + output_cost

def trim_messages(args: LlmArgs, model, input_tokens, maxCost):
    # first try cutting output tokens to 500
    args.max_completion_tokens = min(args.max_completion_tokens, 500)
    model_info = supported_models[model]
    input_cost = input_tokens * model_info['input_cost_per_token']
    output_cost = args.max_completion_tokens * model_info['output_cost_per_token']
    if input_cost + output_cost <= maxCost:
        return args.messages # we're done without modifying messages
    input_token_budget = (maxCost - output_cost) / model_info['input_cost_per_token'] - base_token_count
    messages_token_counts = messages_token_counter(
        args.messages, 
        model_info['tokenizer'], 
        model_info['max_vision_tokens'],
        return_list=True,
    )
    # content token budget for each message. since we may add to the same message on forward and backward pass, track it here
    # loop through messages forward taking up to 20% of the budget
    messages_forward_budget = trim_message_loop(messages_token_counts, floor(input_token_budget * .2))
    # loop through messages backward taking up remaining budget
    messages_backward_budget = trim_message_loop(messages_token_counts, floor(input_token_budget * .8), forward=False)
    # now we can trim each message
    for i in range(len(args.messages)):
        trim_message(
            args.messages[i], 
            messages_token_counts[i][1], 
            messages_forward_budget[i],
            messages_backward_budget[i],
            model_info['tokenizer'],
            model_info['max_vision_tokens'], 
            i == len(args.messages) - 1,
        )
    return [m for m in args.messages if m is not None]

def trim_message_loop(messages_token_counts, budget, forward=True):
    messages_content_budget = [0 for _ in messages_token_counts]
    total = 0
    if forward:
        loop = range(len(messages_token_counts))
    else:
        loop = range(len(messages_token_counts) - 1, -1, -1)
    for i in loop:
        num_tokens, content_tokens = messages_token_counts[i]
        content_budget = budget - total - (num_tokens - content_tokens)
        if content_budget <= 0:
            break
        messages_content_budget[i] += content_budget
        total += num_tokens
    return messages_content_budget

def trim_message(message, content_tokens, forward_budget, backward_budget, tokenizer: Tokenizer, max_vision_tokens, is_last_message):
    content_budget = forward_budget + backward_budget
    if content_budget >= content_tokens:
        return
    if content_budget <= 0:
        message = None
        return
    content = message['content']
    # handle images
    for i, c in enumerate(content):
        if c['type'] == 'image_url':
            # assume images mostly only matter in last message. need to ensure we have some budget remaining to provide context for the image
            if is_last_message and max_vision_tokens / content_budget < 0.5:
                content_budget -= max_vision_tokens
            else:
                del content[i]
    # now text
    for i, c in enumerate(content):
        found_text = False
        if c['type'] == 'text':
            if found_text:
                # I think there is only one text type per message but it's not explict anywhere? 
                # just use up whole budget on first and delete the rest
                del content[i]
                continue
            found_text = True
            forward_budget = floor(content_budget * forward_budget / (forward_budget + backward_budget))
            backward_budget = content_budget - forward_budget
            tokens = tokenizer.encode(c['text'])
            final_tokens = tokens[:forward_budget]
            if backward_budget > 0: # [-0:] selects the whole list
                final_tokens += tokens[-backward_budget:]
            c['text'] = tokenizer.decode(final_tokens)

async def openai_transform(stream, model, expected_cost):
    async for chunk in stream:
        yield chunk.choices[0].delta.content or ''
    final_cost = get_cost(model, chunk.usage.prompt_tokens, chunk.usage.completion_tokens)
    if final_cost > expected_cost:
        print(f'Warning: final cost {final_cost} is greater than expected cost {expected_cost}')
    yield json.dumps({'__command': {'finalCost': final_cost}})