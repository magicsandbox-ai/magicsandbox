# magicsandbox.llm

Call LLMs using an OpenAI compatible API.

## Arguments

You can simply pass a string, which will be used as the user message.

Or you can pass an object with the following keys. Refer to the [OpenAI docs](https://platform.openai.com/docs/api-reference/chat/create) for details. Note that not all OpenAI arguments are supported.

- `messages` _(**required**)_
- `model`: supported models are listed below, with limitations noted. Note that PDF inputs are not supported for any model.
  - `claude-4-sonnet-20250514`
    - Prompt caching is not supported
  - `gemini-2.5-pro-preview-03-25`
    - Limited to 200k input tokens
    - Prompt caching is not supported
    - Multimodal inputs (images, audio, video) are not supported
  - `gpt-4.1-2025-04-14`
  - `gemini-2.5-flash-preview-04-17`
    - Prompt caching is not supported
    - Multimodal inputs (images, audio, video) are not supported
  - `gpt-4.1-mini-2025-04-14`
  - `gemini-2.0-flash-001`
    - Prompt caching is not supported
    - Multimodal inputs (images, audio, video) are not supported
  - `gemini-2.0-flash-lite-001`
    - Prompt caching is not supported
    - Multimodal inputs (images, audio, video) are not supported
  - `claude-3-7-sonnet-20250219`
    - Prompt caching is not supported
  - `gpt-4o-2024-08-06`
  - `gpt-4o-mini-2024-07-18`
- `max_completion_tokens` (note: defaults to 1000 if not provided)
- `response_format`
- `temperature`
- `top_p`
- `frequency_penalty`
- `presence_penalty`
- `logit_bias`
- `reasoning_effort`

Or, to generate multiple responses, you can pass an array of up to 10 objects with the above keys. In this case, you can also provide an additional `maxCost` key indicating how to split `maxCost` across the responses.

## Returns

Object(s) with keys:

- `model`: the model used
- `content`: the content of the response
- `finish_reason`: the reason the response finished (see the OpenAI docs)
- `usage`: an object with keys `prompt_tokens` and `completion_tokens`

When `stream` is `true` (recommended), returns a stream of objects. `model` is present on only the first object. `finish_reason` and `usage` are present on only the final object. If generating multiple responses, each object will have an additional `index` key indicating the zero based index of the response.

When `stream` is false, returns a single object with keys `model`, `content`, and `finish_reason`. If generating multiple responses, returns an array of objects with these keys.

## Usage

### Streaming

```javascript
const stream = await requestFunction(
  "magicsandbox.llm",
  { messages: [{ role: "user", content: "Hello, world!" }] },
  { maxCost: 0.01, stream: true },
);

for await (const chunk of stream) {
  const { result: { model, content, finish_reason, usage } = {}, metadata } =
    chunk;
  console.log(model); //present on only the first chunk
  console.log(content); //present on all but last chunk
  console.log(finish_reason, usage); //present on the final result chunk (the second to last chunk)
  console.log(metadata); //present on only the last chunk
}
```

### maxCost

`magicsandbox.llm` checks that the `maxCost` you provide is sufficient given `model`, the number of tokens in `messages`, and `max_completion_tokens`. However, if `maxCost` is insufficient, `magicsandbox.llm` attempts to always return a response by:

- Using a cheaper `model`
- Reducing `max_completion_tokens` to 500
- Trimming the content of `messages`

This may be acceptable or even convenient for some use cases. However, if you want to avoid the above behavior, ensure that you set `maxCost` appropriately. A conservative assumption is that each byte in messages will become a token. This may seem overly conservative, but this is the assumption `magicsandbox.llm` uses for models like Claude that don't have a publicly available tokenizer. That might look something like this:

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

`magicsandbox.llm` charges [variable costs](https://magicsandbox.ai/?_app=magicsandbox.Docs#variable-costs), so you'll only be charged for the tokens used, not the entire `maxCost`.

### Multiple responses

```javascript
const stream = await requestFunction(
  "magicsandbox.llm",
  [
    { messages: [{ role: "user", content: "Hello, world!" }], maxCost: 0.009 },
    {
      messages: [
        {
          role: "user",
          content: "Generate a summary for this user input: Hello, world!",
        },
      ],
      maxCost: 0.001,
    },
  ],
  { maxCost: 0.01, stream: true },
);

for await (const chunk of stream) {
  const {
    result: { model, content, finish_reason, usage, index } = {},
    metadata,
  } = chunk;
  //...
}
```
