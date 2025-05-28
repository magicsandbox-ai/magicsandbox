import pytest
from unittest.mock import AsyncMock, patch
from .retry import handle_midstream, handle_retry, acompletion_retry_stream, acompletion_retry

'''
npm run pytest -- functions/llm/test_retry.py
'''

def test_handle_midstream():
    # Test with a model that supports prefill
    api_args = {
        'model': 'claude-3-7-sonnet-20250219',
        'messages': [{'role': 'user', 'content': 'Hello'}]
    }
    chunks = [
        type('Chunk', (), {'choices': [type('Choice', (), {'delta': type('Delta', (), {'content': 'Hi'})()})()]})()
    ]
    result = handle_midstream(api_args, chunks)
    assert result['messages'][-1]['role'] == 'assistant'
    assert result['messages'][-1]['content'] == 'Hi'
    assert result['messages'][-1]['prefix'] == True # noqa: E712

    # Test with a model that doesn't support prefill
    api_args['model'] = 'gemini-2.5-pro-preview-03-25'
    result = handle_midstream(api_args, chunks)
    assert len(result['messages']) == 3  # Original + assistant + system message
    assert result['messages'][-1]['role'] == 'user'
    assert '<system>' in result['messages'][-1]['content']

@pytest.mark.asyncio
async def test_handle_retry():
    # Test successful retry
    e = type('Error', (), {'status_code': 500})()
    with patch('asyncio.sleep', new_callable=AsyncMock) as mock_sleep:
        await handle_retry(e, max_retries=1)
        mock_sleep.assert_called_once_with(1)

    # Test error propagation
    e = type('Error', (), {'status_code': 400})()
    with pytest.raises(Exception):
        await handle_retry(e, max_retries=1)

    e = type('Error', (), {'status_code': 500})()
    with pytest.raises(Exception):
        await handle_retry(e, max_retries=0)

    # Test with missing status_code
    e = type('Error', (), {})()
    with pytest.raises(Exception):
        await handle_retry(e, max_retries=1)

@pytest.mark.asyncio
async def test_acompletion_retry_stream():
    # Create a mock response that fails after first chunk
    class MockResponse:
        def __init__(self, fail_after=1):
            # Create two chunks with different content
            self.chunks = [
                type('Chunk', (), {'choices': [type('Choice', (), {'delta': type('Delta', (), {'content': 'Hi'})()})()]})(),
                type('Chunk', (), {'choices': [type('Choice', (), {'delta': type('Delta', (), {'content': ' there'})()})()]})()
            ]
            self.fail_after = fail_after
            self.count = 0

        def __aiter__(self):
            return self

        async def __anext__(self):
            if self.count >= self.fail_after:
                # Create an error with status code 500 to trigger retry
                error = Exception("Simulated error")
                error.status_code = 500
                raise error
            elif self.count >= len(self.chunks):
                raise StopAsyncIteration
            chunk = self.chunks[self.count]
            self.count += 1
            return chunk

    # Mock acompletion to fail on first call, succeed on retry
    with patch('functions.llm.retry.acompletion') as mock_acompletion:
        mock_acompletion.side_effect = [
            MockResponse(fail_after=1),  # First call fails after 1 chunk
            MockResponse(fail_after=10)  # Retry succeeds (won't fail)
        ]

        api_args = {
            'model': 'gemini/gemini-2.0-flash-lite-001',
            'messages': [{'role': 'user', 'content': 'Hello'}]
        }

        chunks = []
        async for chunk in acompletion_retry_stream(api_args, max_retries=1):
            chunks.append(chunk)

        assert len(chunks) == 3  # get 1 chunk from the first call, 2 chunks from the retry
        assert mock_acompletion.call_count == 2  # Should have retried once
        # Verify the content is correct
        content = ''.join(chunk.choices[0].delta.content for chunk in chunks)
        assert content == 'HiHi there'

@pytest.mark.asyncio
async def test_acompletion_retry():
    with patch('functions.llm.retry.acompletion') as mock_acompletion:
        # First call fails with 500 status code, second succeeds
        error = Exception("Simulated error")
        error.status_code = 500
        mock_acompletion.side_effect = [
            error,
            "Success"
        ]

        api_args = {
            'model': 'gemini/gemini-2.0-flash-lite-001',
            'messages': [{'role': 'user', 'content': 'Hello'}]
        }

        result = await acompletion_retry(api_args, max_retries=1)
        assert result == "Success"
        assert mock_acompletion.call_count == 2