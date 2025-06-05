from ..body import Body
import json
from math import floor
from pydantic import BaseModel, field_validator
from fastapi import HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from magicsandbox_streaming import length_prefix_transform #type: ignore
import logging
import asyncio
from aiostream.stream import merge
from typing import Literal
from .tokenizer import Tokenizer
from .models import supported_models, default_models
from .retry import acompletion_retry_stream, acompletion_retry

logger = logging.getLogger("magicsandbox.llm")

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
    reasoning_effort: Literal["low", "medium", "high"] | None = None
    ## these would require returning the whole object, not just the content
    ## careful with token_counter if enabling these. and trim_messages: https://github.com/BerriAI/litellm/issues/4931
    # 'logprobs',
    # 'tools',
    # 'tool_choice',
    # 'parallel_tool_calls',
    maxCost: float | None = None

    @field_validator('maxCost')
    @classmethod
    def validate_max_cost(cls, v):
        if v is not None and v <= 0:
            raise ValueError('maxCost must be strictly positive if provided')
        return v

class LlmBody(Body):
    args: list[LlmArgs] | LlmArgs | str

    @field_validator('args')
    @classmethod
    def validate_args(cls, v):
        if isinstance(v, list) and len(v) > 10:
            raise ValueError('cannot generate more than 10 responses at once')
        return v

async def llm(body: LlmBody, test=False):
    if isinstance(body.args, str):
        args_list = [LlmArgs(messages=[{"role": "user", "content": body.args}])]
    elif isinstance(body.args, list):
        args_list = body.args
    else:
        args_list = [body.args]
    total_max_cost = 0
    for args in args_list:
        if args.maxCost is None:
            total_max_cost = None
            break
        total_max_cost += args.maxCost
    if total_max_cost is not None:
        max_cost_pcts = [args.maxCost / total_max_cost for args in args_list]
    else:
        max_cost_pcts = [1 / len(args_list) for _ in args_list]
    tasks = [get_response(args, body.options.stream, body.options.maxCost * max_cost_pcts[i], i if test else None) for i, args in enumerate(args_list)]
    results = await asyncio.gather(*tasks)
    if body.options.stream:
        return handle_stream_response(results)
    else:
        return handle_response(results)

async def get_response(args: LlmArgs, stream: bool, maxCost: float, test=None):
    if args.messages is None:
        raise HTTPException(status_code=400, detail='messages required')
    if args.max_completion_tokens is None:
        args.max_completion_tokens = 1000
    elif args.max_completion_tokens > 99000 and not stream:
        # because max command object size is 100KB
        raise HTTPException(status_code=400, detail='max_completion_tokens must be less than 99000 when streaming is disabled')
    model, expected_cost = find_model(args, maxCost) # note that this may modify args.messages and args.max_completion_tokens
    if supported_models[model].get('reasoning_disabled', False):
        args.reasoning_effort = None
    args.messages = process_messages(model, args)
    api_args = args.model_dump(exclude_none=True)
    api_args.pop('maxCost', None) # remove custom args or litellm will throw an error
    api_args.update({
        'model': supported_models[model].get('api_name', model),
        'timeout': 180,
    })
    if test is not None:
        api_args.update({
            'mock_response': f'This is mock content {test}',
        })
    if stream:
        api_args.update({
            'stream': True,
            'stream_options': {'include_usage': True},
        })
        response = acompletion_retry_stream(api_args)
    else:
        response = await acompletion_retry(api_args)
    return {'response': response, 'expected_cost': expected_cost, 'model': model}

def process_messages(model, args):
    for message in args.messages:
        if supported_models[model].get('multimodal_disabled', False):
            content = message.get('content')
            if content is not None and not isinstance(content, str):
                message['content'] = [c for c in content if c['type'] == 'text']
        message.pop('cache_control', None) # disable prompt caching
    return args.messages

def find_model(args: LlmArgs, maxCost: float):
    model = args.model
    if model is not None and model not in supported_models:
        raise HTTPException(status_code=400, detail=f'Model {model} not supported')
    elif model is not None:
        try:
            model_index = default_models.index(model)
            models = default_models[model_index:]
        except ValueError:
            models = [model] + default_models
    else:
        models = default_models
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
            args.messages = trim_messages_for_tokens(args, model_info, input_tokens)
            return model, expected_cost
        else:
            logger.debug('expected_cost %s > maxCost %s for model %s: input_tokens %s, output_tokens %s', expected_cost, maxCost, model, input_tokens, output_tokens)
    # trim messages so that we can use the last model in the list (which should be the cheapest)
    args.messages = trim_messages_for_cost(args, model_info, input_tokens, maxCost)
    return model, maxCost

base_token_count = 3 # every reply is primed with <|start|>assistant<|message|>

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
            value_tokens = tokenizer.count(value)
            if key == "content":
                content_tokens += value_tokens
            else:
                num_tokens += value_tokens
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

def trim_messages_for_tokens(args: LlmArgs, model_info, input_tokens):
    input_token_budget = model_info['max_input_tokens']
    if input_tokens <= input_token_budget:
        return args.messages # we're done without modifying messages
    return trim_messages_impl(args, model_info, input_token_budget)

def trim_messages_for_cost(args: LlmArgs, model_info, input_tokens, maxCost):
    # first try cutting output tokens to 500
    args.max_completion_tokens = min(args.max_completion_tokens, 500)
    input_cost = input_tokens * model_info['input_cost_per_token']
    output_cost = args.max_completion_tokens * model_info['output_cost_per_token']
    if input_cost + output_cost <= maxCost:
        return args.messages # we're done without modifying messages
    input_token_budget = (maxCost - output_cost) / model_info['input_cost_per_token'] - base_token_count
    input_token_budget = min(input_token_budget, model_info['max_input_tokens'])
    return trim_messages_impl(args, model_info, input_token_budget)

def trim_messages_impl(args, model_info, input_token_budget):
    messages_token_counts = messages_token_counter( # todo counting for the second time here - should just do it in find_model
        args.messages, 
        model_info['tokenizer'], 
        model_info['max_vision_tokens'],
        return_list=True,
    )
    if args.messages[0]['role'] == 'system' or args.messages[0]['role'] == 'developer':
        # try to preserve the system prompt, forward budget is system prompt + 20% of budget
        # but can't exceed 80% of budget, so backward budget is guaranteed to be at least 20% of budget
        forward_budget = min(messages_token_counts[0][1] + floor(input_token_budget * .2), 
                             floor(input_token_budget * .8)
                            )
    else:
        forward_budget = floor(input_token_budget * .2)
    backward_budget = floor(input_token_budget - forward_budget)
    # content token budget for each message. since we may add to the same message on forward and backward pass, track it here
    # loop through messages forward taking up to 20% of the budget
    messages_forward_budget = trim_message_loop(messages_token_counts, forward_budget)
    # loop through messages backward taking up remaining budget
    messages_backward_budget = trim_message_loop(messages_token_counts, backward_budget, forward=False)
    # now we can trim each message
    trimmed_messages = []
    for i in range(len(args.messages)):
        trimmed_messages.append(trim_message(
            args.messages[i], 
            messages_token_counts[i][1], 
            messages_forward_budget[i],
            messages_backward_budget[i],
            model_info['tokenizer'],
            model_info['max_vision_tokens'], 
            i == len(args.messages) - 1,
        ))
    return [m for m in trimmed_messages if m is not None]

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
        return message
    if content_budget <= 0:
        return None
    content = message['content']
    if isinstance(content, str):
        content = [{"type": "text", "text": content}] # todo should just do this earlier so we don't have to handle strings throughout the code
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
                # I think there is only one text type per message but it's not explicit anywhere? 
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
    message['content'] = content # in case it was a string, we didn't mutate the original
    return message

def handle_stream_response(results):
    if len(results) > 1:
        streams = [handle_stream_result(result, i) for i, result in enumerate(results)]
        stream = merge(*streams)
    else:
        # still wrap it in merge so the object passed to handle_stream_final_cost is consistent
        stream = merge(handle_stream_result(results[0]))
    return StreamingResponse(length_prefix_transform(handle_stream_final_cost(stream), final_object=True),
                             headers={'x-length-prefix': 'true'})

async def handle_stream_result(result, index=None):
    def data(**kwargs):
        if index is not None:
            kwargs['index'] = index
        return json.dumps(kwargs)
    response = result['response']
    model = result['model']
    expected_cost = result['expected_cost']
    buffer = '' # buffer to reduce overhead to json and length prefixes
    buffer_size = 5
    first_chunk = True
    finish_reason = None
    async for chunk in response:
        #logger.debug('%s', json.dumps(chunk.json(), default=str, indent=2))
        content = chunk.choices[0].delta.content
        if content:
            buffer += content
            if len(buffer) >= buffer_size:
                if first_chunk:
                    yield data(model=model, content=buffer)
                    first_chunk = False
                else:
                    yield data(content=buffer)
                buffer = ''
        finish_reason = chunk.choices[0].finish_reason or finish_reason
    usage = {
        'prompt_tokens': chunk.usage.prompt_tokens,
        'completion_tokens': chunk.usage.completion_tokens,
    }
    if finish_reason != 'stop':
        logger.info('finish_reason: %s', finish_reason)
    if first_chunk:
        yield data(model=model, content=buffer, finish_reason=finish_reason, usage=usage)
    else:
        yield data(content=buffer, finish_reason=finish_reason, usage=usage)
    final_cost = handle_final_cost(model, expected_cost, chunk.usage)
    yield {'final_cost': final_cost}

async def handle_stream_final_cost(stream):
    final_cost = 0
    async with stream.stream() as streamer:
        # this context ensures the stream is properly closed. something to do with gc?
        # without it there's a warning about the stream being iterated outside of its context
        async for chunk in streamer:
            if isinstance(chunk, dict):
                final_cost += chunk['final_cost']
            else:
                yield chunk
    yield json.dumps({'__command': {'finalCost': final_cost}})

def handle_final_cost(model, expected_cost, usage):
    final_cost = get_cost(model, usage.prompt_tokens, usage.completion_tokens)
    if final_cost > expected_cost:
        logger.warning(
            f'Final cost exceeds expected cost: final={final_cost:.6f} expected={expected_cost:.6f} model={model}'
        )
    return final_cost

def handle_response(results):
    final_result = []
    final_cost = 0
    for r in results:
        result, result_cost = handle_result(r)
        final_result.append(result)
        final_cost += result_cost
    if len(final_result) == 1:
        final_result = final_result[0]
    content = {
        'result': final_result,
        '__command': {'finalCost': final_cost},
    }
    return JSONResponse(content=content, headers={'x-command-object': 'true'})

def handle_result(result):
    response = result['response']
    model = result['model']
    expected_cost = result['expected_cost']
    #logger.debug('%s', json.dumps(response.json(), default=str, indent=2))
    final_cost = handle_final_cost(model, expected_cost, response.usage)
    return ({
            'model': model,
            'content': response.choices[0].message.content,
            'finish_reason': response.choices[0].finish_reason,
            'usage': {
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens,
            },
        },
        final_cost)