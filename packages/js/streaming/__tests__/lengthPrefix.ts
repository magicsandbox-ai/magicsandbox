import { describe, expect, test } from "@jest/globals";
import {
  createLengthPrefixTransform,
  createLengthPrefixParser,
} from "../src/index.ts";
import { createStream } from "./testUtils.ts";

/*
cd packages/js/streaming
npm run test
*/

function encode(chunk: any) {
  if (typeof chunk === "string") {
    return new TextEncoder().encode(chunk);
  } else {
    return new TextEncoder().encode(JSON.stringify(chunk));
  }
}

async function collectLengthPrefixStream(
  stream: AsyncIterable<{
    state: string;
    readRemaining: number;
    chunk: Uint8Array;
  }>,
) {
  const decoder = new TextDecoder();
  let stringBuffer = "";
  let finalObjectBuffer = "";
  let string;
  let finalObject;
  for await (const { state, readRemaining, chunk } of stream) {
    if (state === "object") {
      stringBuffer += decoder.decode(chunk, { stream: true });
      if (readRemaining === 0) {
        string = stringBuffer;
      }
    } else if (state === "finalObject") {
      finalObjectBuffer += decoder.decode(chunk, { stream: true });
      if (readRemaining === 0) {
        finalObject = JSON.parse(finalObjectBuffer);
      }
    }
  }
  return { string, finalObject };
}

describe("lengthPrefix", () => {
  test("works", async () => {
    const chunks = ["hello ", "world"];
    const stream = createStream(chunks.map(encode));
    const resultStream = stream
      .pipeThrough(createLengthPrefixTransform())
      .pipeThrough(createLengthPrefixParser());
    const { string } = await collectLengthPrefixStream(resultStream);
    expect(string).toBe("hello world");
  });

  test("finalObject works", async () => {
    const chunks = ["hello ", "world", { __command: { finalCost: 100 } }];
    const stream = createStream(chunks.map(encode));
    const resultStream = stream
      .pipeThrough(createLengthPrefixTransform({ finalObject: true }))
      .pipeThrough(createLengthPrefixParser());
    const { string, finalObject } =
      await collectLengthPrefixStream(resultStream);
    expect(string).toBe("hello world");
    expect(finalObject).toEqual({ __command: { finalCost: 100 } });
  });
});
