import { describe, expect, test } from "@jest/globals";
import { tagStreamParser, tagParser } from "../index.js";
import { createStream, collectStream } from "./testUtils.js";

/*
npm run test -- packages/js/streaming
*/

describe("tagStreamParser", () => {
  test("works", async () => {
    const stream = createStream([
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
    const results = await collectStream(
      tagStreamParser({ stream, chunkProcessor: (chunk) => chunk.result }),
    );
    expect(results).toEqual([
      {
        content: "hello world",
        tag: undefined,
      },
      {
        content: "test",
        tag: "example",
      },
      {
        content: "goodbye",
        tag: undefined,
      },
    ]);
  });

  test("handles tags at start and end of string", async () => {
    const stream = createStream([
      { result: "<" },
      { result: "example1" },
      { result: ">" },
      { result: "test1" },
      { result: "</" },
      { result: "example1" },
      { result: ">" },
      { result: "<" },
      { result: "example2" },
      { result: ">" },
      { result: "test2" },
      { result: "</" },
      { result: "example2" },
      { result: ">" },
      { metadata: { finalCost: 100 } },
    ]);
    const results = await collectStream(
      tagStreamParser({ stream, chunkProcessor: (chunk) => chunk.result }),
    );
    expect(results).toEqual([
      {
        content: "test1",
        tag: "example1",
      },
      {
        content: "test2",
        tag: "example2",
      },
    ]);
  });

  test("ignores nested tags", async () => {
    const stream = createStream([
      { result: "<" },
      { result: "example1" },
      { result: ">" },
      { result: "test1" },
      { result: "<" },
      { result: "example2" },
      { result: ">" },
      { result: "test2" },
      { result: "</" },
      { result: "example2" },
      { result: ">" },
      { result: "</" },
      { result: "example1" },
      { result: ">" },
      { metadata: { finalCost: 100 } },
    ]);
    const results = await collectStream(
      tagStreamParser({ stream, chunkProcessor: (chunk) => chunk.result }),
    );
    expect(results).toEqual([
      {
        content: "test1<example2>test2</example2>",
        tag: "example1",
      },
    ]);
  });

  test("respects validTags", async () => {
    const stream = createStream([
      {
        result: {
          model: "gemini-1.5-flash-002",
          content:
            "`<ul>` and `<ol>` are both HTML list elements, but they create different",
        },
      },
      {
        result: {
          content: " types of lists. `<ul>` creates an unordered list...",
        },
      },
      { metadata: { finalCost: 100 } },
    ]);
    const results = await collectStream(
      tagStreamParser({
        stream,
        chunkProcessor: (chunk) => chunk.result?.content,
        validTags: ["intermediate_script", "final_script", "launch_app"],
      }),
    );
    const content = results.map((r) => r.content).join("");
    expect(content).toEqual(
      "`<ul>` and `<ol>` are both HTML list elements, but they create different types of lists. `<ul>` creates an unordered list...",
    );
  });
});

describe("tagParser", () => {
  test("works", () => {
    const input = "hello world<example>test</example>goodbye";
    const result = tagParser(input);
    expect(result).toEqual([
      { content: "hello world", tag: undefined },
      { content: "test", tag: "example" },
      { content: "goodbye", tag: undefined },
    ]);
  });

  test("handles tags at start and end of string", () => {
    const input =
      "<example1>test1</example1><example2>test2</example2><example1>test3</example1>";
    const result = tagParser(input);
    expect(result).toEqual([
      { content: "test1", tag: "example1" },
      { content: "test2", tag: "example2" },
      { content: "test3", tag: "example1" },
    ]);
  });

  test("ignores nested tags", () => {
    const input = `let me run a script <script>return <div>hello world</div></script>`;
    const result = tagParser(input);
    expect(result).toEqual([
      { content: "let me run a script ", tag: undefined },
      { content: "return <div>hello world</div>", tag: "script" },
    ]);
  });

  test("respects validTags", () => {
    const input =
      "`<ul>` and `<ol>` are both HTML list elements, but they create different types of lists. `<ul>` creates an unordered list...";
    const result = tagParser(input, [
      "intermediate_script",
      "final_script",
      "launch_app",
    ]);
    expect(result).toEqual([
      {
        content:
          "`<ul>` and `<ol>` are both HTML list elements, but they create different types of lists. `<ul>` creates an unordered list...",
        tag: undefined,
      },
    ]);
  });
});
