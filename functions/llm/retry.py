from litellm import acompletion
import asyncio
import logging
from .models import supported_models

logger = logging.getLogger("magicsandbox.llm")

# todo additional tokens in midstream handling could cause exceeding maxCost

async def acompletion_retry_stream(api_args, max_retries=1, chunks=None):
    if chunks is None:
        chunks = []
        api_args_to_use = api_args
    else:
        api_args_to_use = handle_midstream(api_args, chunks)
    response = await acompletion(**api_args_to_use)
    try:
        async for chunk in response:
            yield chunk
            chunks.append(chunk)
    except Exception as e:
        await handle_retry(e, max_retries)
        async for chunk in acompletion_retry_stream(api_args, max_retries - 1, chunks):
            yield chunk

async def acompletion_retry(api_args, max_retries=1):
    try:
        return await acompletion(**api_args)
    except Exception as e:
        await handle_retry(e, max_retries)
        return await acompletion_retry(api_args, max_retries - 1)

async def handle_retry(e, max_retries):
    status_code = getattr(e, 'status_code', None)
    if max_retries > 0 and status_code is not None and (status_code >= 500 or status_code in [408, 409, 429]):
        logger.warning('Retrying error', exc_info=e)
        await asyncio.sleep(1)
    else:
        logger.error('Throwing error', exc_info=e)
        raise e

def handle_midstream(api_args, chunks):
    new_api_args = api_args.copy()
    messages = api_args['messages'].copy()
    content = ''.join([chunk.choices[0].delta.content for chunk in chunks])
    model_config = get_model_config(api_args['model'])
    if model_config.get('supports_assistant_prefill', False):
        messages.append({
            'role': 'assistant',
            'content': content,
            'prefix': True,
        })
    else:
        messages.extend([
            {
                'role': 'assistant',
                'content': content,
            },
            {
                'role': 'user',
                'content': '<system>Your previous message was cut off midstream due to an error. Please continue exactly where you left off. Do not acknowledge the error, as the user is not aware of it. Continue your previous response as if nothing happened to ensure a smooth user experience.</system>',
            }
        ])
    new_api_args['messages'] = messages
    return new_api_args

def get_model_config(model):
    if model in supported_models:
        return supported_models[model]
    for config in supported_models.values():
        if config.get('api_name') == model:
            return config
    raise KeyError(f"Model {model} not supported")