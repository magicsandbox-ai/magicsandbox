import { describe, expect, test } from "@jest/globals";
import { tagStreamParser, tagParser } from "../tagStreamParser";

/*
npm run test -- packages/js/streaming
*/

async function* createMockStream(chunks) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function collectResults(generator) {
  const results = [];
  for await (const item of generator) {
    results.push(item);
  }
  return results;
}

describe("tagStreamParser", () => {
  test("works", async () => {
    const stream = createMockStream([
      { result: "hello " },
      { result: "world" },
      { result: "<" },
      { result: "example" },
      { result: ">" },
      { result: "test" },
      { result: "</" },
      { result: "example" },
      { result: ">" },
      { result: "good" },
      { result: "bye" },
      { metadata: { finalCost: 100 } },
    ]);
    const results = await collectResults(
      tagStreamParser({ stream, chunkProcessor: (chunk) => chunk.result }),
    );
    expect(results).toEqual([
      {
        content: "hello world",
        tag: undefined,
        originalContent: "hello world<example>",
      },
      {
        content: "test",
        tag: "example",
        originalContent: "test</example>",
      },
      {
        content: "goodbye",
        tag: undefined,
        originalContent: "goodbye",
      },
    ]);
  });
});

describe("tagParser", () => {
  test("works", () => {
    const input = "hello world<example>test</example>goodbye";
    const result = tagParser(input);
    expect(result).toEqual({
      undefined: "hello worldgoodbye",
      example: "test",
    });
  });
});
