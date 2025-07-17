import { describe, expect, test } from "@jest/globals";
import { parse, serialize } from "../prosemirrorMarkdown.ts";

/*
npm run jest -- apps/Notes/__tests__/prosemirrorMarkdown.test.ts
*/

const testCases = [
  "foo\nbar",
  "\nfoo\nbar\n",
  "\n\nfoo\nbar\n\n",
  "\n\n\nfoo\nbar\n\n\n",
  "foo\n\nbar",
  "foo\n\n\nbar",
  "[test](https://example.com)",
];

describe("prosemirrorMarkdown", () => {
  test("works", () => {
    for (const content of testCases) {
      try {
        const doc = parse(content);
        const serialized = serialize(doc);
        expect(serialized).toBe(content);
      } catch (error) {
        throw new Error(
          `Test failed for case: ${JSON.stringify(content)}\n${(error as Error).message}`,
        );
      }
    }
  });

  test("code blocks", () => {
    const content =
      "```\nfoo\nbar\n\nbaz\n```\n\n```\nconsole.log(I'm another code block!);\nx = 1;\n```";
    const doc = parse(content);
    const serialized = serialize(doc);
    expect(serialized).toBe(content);
  });

  test("blockquote", () => {
    const content = "> foo\n> bar\n> \n> baz\n> \n> \n> qux";
    const doc = parse(content);
    const serialized = serialize(doc);
    expect(serialized).toBe(content);
  });

  test("headers", () => {
    const content =
      "# alpha\nbeta\n## gamma\n\ndelta\n### epsilon\n\n\nzeta\n#### eta\n#### theta";
    const doc = parse(content);
    const serialized = serialize(doc);
    expect(serialized).toBe(content);
  });

  test("kitchen sink", () => {
    const content = `# Meeting Notes

Here are the key points from today's meeting:

* First item
  * Subitem
    * Subsubitem
  * Subitem
* Second item with some *emphasis* and **bold** text

* Third item with a [link](https://example.com)

Here's some code we discussed:
\`\`\`
function example() {
  console.log("Hello world");
}
\`\`\`


More notes here

## Action Items

1. First task
2. Second task with \`inline code\`

3. Third task

\`\`\`
// Another code block
const x = 1;
const y = 2;
\`\`\`

> Important quote from the meeting
> Multiple lines in the quote



Regular paragraph with some *italic* and **bold** text.

* List item 1
* List item 2 with \`code\`

* List item 3

\`\`\`python
# Python code block
def hello():
    print("Hello")
\`\`\`

Final notes here with some \`inline code\` and a [link](https://example.com)`;
    const doc = parse(content);
    const serialized = serialize(doc);
    expect(serialized).toBe(content);
  });
});
