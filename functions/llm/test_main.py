import pytest
import json
from .main import llm, LlmBody

'''
npm run pytest -- functions/llm/test_main.py
'''

@pytest.mark.asyncio
async def test_string():
    body = LlmBody(
        id='magicsandbox.llm@0.1.0',
        options={
            'maxCost': 0.001,
            'stream': False,
        },
        args='Hello, world!',
    )
    response = await llm(body, test=True)
    validate_response(response)

def validate_response(response, model=None):
    assert response.headers.get('x-command-object') == 'true'
    response_body = json.loads(response.body)
    assert response_body['result']['content'] == 'This is mock content 0'
    assert isinstance(response_body['result']['model'], str)
    if model is not None:
        assert response_body['result']['model'] == model
    assert isinstance(response_body['__command']['finalCost'], float)

@pytest.mark.asyncio
async def test_args():
    body = LlmBody(
        id='magicsandbox.llm@0.1.0',
        options={
            'maxCost': 0.1,
            'stream': False,
        },
        args={
            'model': 'gpt-4o-mini-2024-07-18',
            'messages': [
                {'role': 'system', 'content': 'You are a helpful assistant.'},
                {'role': 'user', 'content': 'Hello, world!'},
            ],
        },
    )
    response = await llm(body, test=True)
    validate_response(response, model='gpt-4o-mini-2024-07-18')

@pytest.mark.asyncio
async def test_stream():
    body = LlmBody(
        id='magicsandbox.llm@0.1.0',
        options={
            'maxCost': 0.1,
            'stream': True,
        },
        args={
            'model': 'gpt-4o-mini-2024-07-18',
            'messages': [
                {'role': 'system', 'content': 'You are a helpful assistant.'},
                {'role': 'user', 'content': 'Hello, world!'},
            ],
        },
    )
    response = await llm(body, test=True)
    assert response.headers.get('x-length-prefix') == 'true'
    chunks = []
    async for chunk in response.body_iterator:
        # Skip first 4 bytes (length prefix) and decode remaining as JSON
        chunk_data = json.loads(chunk[4:].decode('utf-8'))
        chunks.append(chunk_data)
    content = ''
    for i, chunk in enumerate(chunks):
        if i == 0:
            assert chunk['model'] == 'gpt-4o-mini-2024-07-18'
            content = chunk['content']
        elif i == len(chunks) - 1:
            assert isinstance(chunk['__command']['finalCost'], float)
        else:
            assert 'model' not in chunk
            assert '__command' not in chunk
            content += chunk['content']
    assert content == 'This is mock content 0'

@pytest.mark.asyncio
async def test_multiple():
    body = LlmBody(
        id='magicsandbox.llm@0.1.0',
        options={
            'maxCost': 0.1,
            'stream': False,
        },
        args=[
            {
                'model': 'gpt-4o-mini-2024-07-18',
                'messages': [{'role': 'user', 'content': 'Hello, world!'}],
                'maxCost': 0.05,
            },
            {
                'model': 'gemini-1.5-flash-002',
                'messages': [{'role': 'user', 'content': 'Goodbye!'}],
                'maxCost': 0.05,
            },
        ],
    )
    response = await llm(body, test=True)
    assert response.headers.get('x-command-object') == 'true'
    response_body = json.loads(response.body)
    assert len(response_body['result']) == 2
    assert response_body['result'][0]['content'] == 'This is mock content 0'
    assert response_body['result'][0]['model'] == 'gpt-4o-mini-2024-07-18'
    assert response_body['result'][1]['content'] == 'This is mock content 1'
    assert response_body['result'][1]['model'] == 'gemini-1.5-flash-002'
    assert isinstance(response_body['__command']['finalCost'], float)

@pytest.mark.asyncio
async def test_multiple_stream():
    body = LlmBody(
        id='magicsandbox.llm@0.1.0',
        options={
            'maxCost': 0.1,
            'stream': True,
        },
        args=[
            {
                'model': 'gpt-4o-mini-2024-07-18',
                'messages': [{'role': 'user', 'content': 'Hello, world!'}],
                'maxCost': 0.05,
            },
            {
                'model': 'gemini-1.5-flash-002',
                'messages': [{'role': 'user', 'content': 'Goodbye!'}],
                'maxCost': 0.05,
            },
        ],
    )
    response = await llm(body, test=True)
    assert response.headers.get('x-length-prefix') == 'true'
    chunks = []
    async for chunk in response.body_iterator:
        # Skip first 4 bytes (length prefix) and decode remaining as JSON
        chunk_data = json.loads(chunk[4:].decode('utf-8'))
        chunks.append(chunk_data) 
    contents = ['', '']
    for i, chunk in enumerate(chunks):
        if i < len(chunks) - 1:
            if contents[chunk['index']] == '':
                assert 'model' in chunk
            contents[chunk['index']] += chunk['content']
            assert '__command' not in chunk
        else:
            assert isinstance(chunk['__command']['finalCost'], float)
    assert contents[0] == 'This is mock content 0'
    assert contents[1] == 'This is mock content 1'