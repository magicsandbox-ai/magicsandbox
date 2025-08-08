import pytest
import json
from .main import (
    llm,
    LlmBody,
    LlmArgs,
    trim_messages_for_tokens,
    trim_messages_for_cost,
    supported_models,
)

"""
npm run pytest -- functions/llm/test_main.py
WARNING: test_all_models makes real API calls and incurs costs!
"""


@pytest.mark.asyncio
async def test_string():
    body = LlmBody(
        id="magicsandbox.llm@0.1.0",
        options={
            "maxCost": 0.001,
            "stream": False,
        },
        args="Hello, world!",
    )
    response = await llm(body, test=True)
    validate_response(response)


def validate_response(response, model=None, test=True):
    assert response.headers.get("x-command-object") == "true"
    response_body = json.loads(response.body)
    if test:
        assert response_body["result"]["content"] == "This is mock content 0"
    else:
        assert isinstance(response_body["result"]["content"], str)
    assert isinstance(response_body["result"]["model"], str)
    if model is not None:
        assert response_body["result"]["model"] == model
    assert isinstance(response_body["result"]["finish_reason"], str)
    assert isinstance(response_body["result"]["usage"]["prompt_tokens"], int)
    assert isinstance(response_body["result"]["usage"]["completion_tokens"], int)
    assert isinstance(response_body["__command"]["finalCost"], float)


async def helper(model, test):
    body = LlmBody(
        id="magicsandbox.llm@0.1.0",
        options={
            "maxCost": 0.1,
            "stream": False,
        },
        args={
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello, world!"},
            ],
        },
    )
    response = await llm(body, test=test)
    validate_response(response, model=model, test=test)


@pytest.mark.asyncio
async def test_args():
    await helper("gpt-5-nano-2025-08-07", test=True)


async def stream_helper(model, test):
    body = LlmBody(
        id="magicsandbox.llm@0.1.0",
        options={
            "maxCost": 0.1,
            "stream": True,
        },
        args={
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello, world!"},
            ],
        },
    )
    response = await llm(body, test=test)
    assert response.headers.get("x-length-prefix") == "true"
    chunks = []
    async for chunk in response.body_iterator:
        # Skip first 4 bytes (length prefix) and decode remaining as JSON
        chunk_data = json.loads(chunk[4:].decode("utf-8"))
        chunks.append(chunk_data)
    content = ""
    for i, chunk in enumerate(chunks):
        if i == 0:
            assert chunk["model"] == model
            content = chunk["content"]
        elif i == len(chunks) - 2:
            assert isinstance(chunk["finish_reason"], str)
            assert isinstance(chunk["usage"]["prompt_tokens"], int)
            assert isinstance(chunk["usage"]["completion_tokens"], int)
            content += chunk["content"]
        elif i == len(chunks) - 1:
            assert isinstance(chunk["__command"]["finalCost"], float)
        else:
            assert "model" not in chunk
            assert "__command" not in chunk
            content += chunk["content"]
    if test:
        assert content == "This is mock content 0"


@pytest.mark.asyncio
async def test_stream():
    await stream_helper("gpt-5-nano-2025-08-07", test=True)


@pytest.mark.asyncio
async def test_multiple():
    body = LlmBody(
        id="magicsandbox.llm@0.1.0",
        options={
            "maxCost": 0.1,
            "stream": False,
        },
        args=[
            {
                "model": "gpt-5-nano-2025-08-07",
                "messages": [{"role": "user", "content": "Hello, world!"}],
                "maxCost": 0.05,
            },
            {
                "model": "gemini-2.0-flash-lite-001",
                "messages": [{"role": "user", "content": "Goodbye!"}],
                "maxCost": 0.05,
            },
        ],
    )
    response = await llm(body, test=True)
    assert response.headers.get("x-command-object") == "true"
    response_body = json.loads(response.body)
    assert len(response_body["result"]) == 2
    assert response_body["result"][0]["content"] == "This is mock content 0"
    assert response_body["result"][0]["model"] == "gpt-5-nano-2025-08-07"
    assert response_body["result"][1]["content"] == "This is mock content 1"
    assert response_body["result"][1]["model"] == "gemini-2.0-flash-lite-001"
    assert isinstance(response_body["__command"]["finalCost"], float)


@pytest.mark.asyncio
async def test_multiple_stream():
    body = LlmBody(
        id="magicsandbox.llm@0.1.0",
        options={
            "maxCost": 0.1,
            "stream": True,
        },
        args=[
            {
                "model": "gpt-5-nano-2025-08-07",
                "messages": [{"role": "user", "content": "Hello, world!"}],
                "maxCost": 0.05,
            },
            {
                "model": "gemini-2.0-flash-lite-001",
                "messages": [{"role": "user", "content": "Goodbye!"}],
                "maxCost": 0.05,
            },
        ],
    )
    response = await llm(body, test=True)
    assert response.headers.get("x-length-prefix") == "true"
    chunks = []
    async for chunk in response.body_iterator:
        # Skip first 4 bytes (length prefix) and decode remaining as JSON
        chunk_data = json.loads(chunk[4:].decode("utf-8"))
        chunks.append(chunk_data)
    contents = ["", ""]
    for i, chunk in enumerate(chunks):
        if i < len(chunks) - 1:
            if contents[chunk["index"]] == "":
                assert "model" in chunk
            contents[chunk["index"]] += chunk["content"]
            assert "__command" not in chunk
        else:
            assert isinstance(chunk["__command"]["finalCost"], float)
    assert contents[0] == "This is mock content 0"
    assert contents[1] == "This is mock content 1"


@pytest.mark.asyncio
async def test_trim_messages_for_tokens():
    long_message = "This is a very long message. " * 1000
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": long_message},
    ]
    args = LlmArgs(messages=messages)
    model_info = supported_models["gpt-5-nano-2025-08-07"]
    model_info["max_input_tokens"] = 100
    input_tokens = 1000  # note this is not actually the token count of messages, but just needs to be higher than max_input_tokens
    trimmed_messages = trim_messages_for_tokens(args, model_info, input_tokens)
    assert (
        trimmed_messages[0]["content"] == messages[0]["content"]
    )  # System message should be preserved
    assert len(trimmed_messages[1]["content"]) < len(
        messages[1]["content"]
    )  # User message should be trimmed


@pytest.mark.asyncio
async def test_trim_messages_for_cost():
    long_message = "This is a very long message. " * 1000
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": long_message},
    ]
    args = LlmArgs(messages=messages, max_completion_tokens=1000)
    model_info = supported_models["claude-3-7-sonnet-20250219"]
    input_tokens = 1000  # note this is not actually the token count of messages, but just needs to be high enough to trigger trimming
    max_cost = (
        500 * model_info["output_cost_per_token"]
        + 100 * model_info["input_cost_per_token"]
    )
    trimmed_messages = trim_messages_for_cost(args, model_info, input_tokens, max_cost)
    assert (
        trimmed_messages[0]["content"] == messages[0]["content"]
    )  # System message should be preserved
    assert len(trimmed_messages[1]["content"]) < len(
        messages[1]["content"]
    )  # User message should be trimmed


@pytest.mark.asyncio
async def test_all_models():
    for model in supported_models.keys():
        try:
            await helper(model, test=False)
        except Exception as e:
            raise Exception(f"Error testing model '{model}': {str(e)}") from e


@pytest.mark.asyncio
async def test_all_models_stream():
    for model in supported_models.keys():
        try:
            await stream_helper(model, test=False)
        except Exception as e:
            raise Exception(f"Error testing model '{model}': {str(e)}") from e
