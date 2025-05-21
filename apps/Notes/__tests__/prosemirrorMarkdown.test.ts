import { describe, expect, test } from "@jest/globals";
import { parse, serialize } from "../prosemirrorMarkdown.ts";

/*
npm run jest -- apps/Notes/__tests__/prosemirrorMarkdown.test.ts
*/

const testCases = [
  "foo\nbar",
  "foo\n\nbar",
  "foo\n\n\nbar",
  "[test](https://example.com)",
];

describe("prosemirrorMarkdown", () => {
  test("works", () => {
    for (const content of testCases) {
      try {
        const doc = parse(content);
        expect(doc.content.content.length).toBe(content.split("\n").length);
        const serialized = serialize(doc);
        expect(serialized).toBe(content);
      } catch (error) {
        throw new Error(
          `Test failed for case: ${JSON.stringify(content)}\n${(error as Error).message}`,
        );
      }
    }
  });
});
