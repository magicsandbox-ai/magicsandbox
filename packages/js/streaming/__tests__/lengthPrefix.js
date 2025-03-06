import { describe, expect, test } from "@jest/globals";
import {
  createLengthPrefixTransform,
  createLengthPrefixParser,
} from "../index.js";
import { createStream } from "./testUtils.js";

/*
npm run jest -- packages/js/streaming
*/

function encode(chunk) {
  if (typeof chunk === "string") {
    return new TextEncoder().encode(chunk);
  } else {
    return new TextEncoder().encode(JSON.stringify(chunk));
  }
}

async function collectLengthPrefixStream(stream) {
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
