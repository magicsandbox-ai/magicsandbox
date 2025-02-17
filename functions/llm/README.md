# magicsandbox.llm

Call LLMs using an OpenAI compatible API.

## Arguments

You can simply pass a string, which will be used as the user message.

Or you can pass an object with the following keys. Refer to the [OpenAI docs](https://platform.openai.com/docs/api-reference/chat/create) for details. Note that not all OpenAI arguments are supported.

- `messages` (**required**)
- `model`: supported models are:
  - `claude-3-5-sonnet-20241022`
  - `gpt-4o-2024-08-06`
  - `gpt-4o-mini-2024-07-18`
  - `gemini/gemini-1.5-flash-002` (note: vision is not supported)
  - `gemini/gemini-1.5-flash-8b-001` (note: vision is not supported)
- `max_completion_tokens` (note: defaults to 1000 if not provided)
- `response_format`
- `temperature`
- `top_p`
- `frequency_penalty`
- `presence_penalty`
- `logit_bias`

## Returns

Objects with keys:

- `model`: the model used
- `content`: the content of the response

## Usage

### Streaming

Since the LLM response can take some time to generate, you should leverage streaming:

```javascript
const response = await requestFunction(
  "magicsandbox.llm",
  { messages: [{ role: "user", content: "Hello, world!" }] },
  { maxCost: 0.01, stream: true },
);

for await (const chunk of response) {
  if (chunk.result) {
    const { model, content } = chunk.result;
    // do something
  } else {
    // do something with chunk.metadata if you want
  }
}
```

If you don't set `stream` to `true` when calling `requestFunction`, `response.result` will be an array of objects with keys `model` and `content`.

### maxCost

magicsandbox.llm checks that the `maxCost` you provide is sufficient given `model`, the number of tokens in `messages`, and `max_completion_tokens`. However, if `maxCost` is insufficient, magicsandbox.llm attempts to always return a response by:

- Using a cheaper `model`
- Reducing `max_completion_tokens` to 500
- Trimming the content of `messages`

If you want to avoid the above behavior, ensure that you set `maxCost` appropriately. A conservative assumption is that each byte in messages will become a token. This may seem overly conservative, but this is the assumption magicsandbox.llm uses for models like Claude that don't have a publicly available tokenizer. That might look something like this:

```javascript
const messages = [{ role: "user", content: "Hello, world!" }];
const model = "claude-3-5-sonnet-20241022";
const inputTokens = new TextEncoder().encode(JSON.stringify(messages)).length; //one token per byte
const outputTokens = 1000;
const inputTokenCost = 3 / 1000000;
const outputTokenCost = 15 / 1000000;
const maxCost = inputTokenCost * inputTokens + outputTokenCost * outputTokens;
const stream = await requestFunction(
  "magicsandbox.llm",
  { messages, model, max_completion_tokens: outputTokens },
  { maxCost, stream: true },
);
```

magicsandbox.llm charges [variable costs](https://magicsandbox.ai/?_app=magicsandbox.Docs&id=variable-costs), so you'll only be charged for the tokens used, not the entire `maxCost`.
