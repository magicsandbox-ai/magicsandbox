import { describe, expect, test } from "@jest/globals";
import { xmlParser } from "../xmlParser";

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

describe("xmlParser", () => {
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
      xmlParser({ stream, chunkProcessor: (chunk) => chunk.result }),
    );
    expect(results).toEqual([
      { content: "hello world", tag: undefined },
      { content: "test", tag: "example" },
      { content: "goodbye", tag: undefined },
    ]);
  });
});
