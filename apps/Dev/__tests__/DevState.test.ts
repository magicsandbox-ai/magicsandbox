import { test, expect, jest } from "@jest/globals";
import { Text } from "@codemirror/state";

jest.unstable_mockModule("@magicsandbox.ai/docs/docs.md", () => ({
  default: "# Mock Documentation",
}));

const { createChangeSet } = await import("../DevState.ts");

/*
npm run jest -- apps/Dev/__tests__/DevState.test.ts
*/

function docFromString(content: string) {
  return Text.of(content.split("\n"));
}

function testCreateChangeSet(prevContent: string, newContent: string) {
  const changeSet = createChangeSet(prevContent, newContent);
  const doc = changeSet.apply(docFromString(newContent));
  expect(doc.toString()).toEqual(prevContent);
}

test("createChangeSet", () => {
  testCreateChangeSet("Hello, world!", "Hi, world!!");
  testCreateChangeSet("", "");
  testCreateChangeSet("a", "b");
  testCreateChangeSet("", "I'm new here");
  testCreateChangeSet(
    "Line 1\nLine 2\nLine 3",
    "Line 1\nModified Line 2\nLine 3",
  );
  testCreateChangeSet("Original content", "Original content with additions");
  testCreateChangeSet("Content to be removed", "Content");
  testCreateChangeSet(
    "First line\nSecond line\nThird line",
    "First line modified\nNew line\nThird line changed",
  );
  testCreateChangeSet(
    "Special chars: !@#$%^&*()",
    "Special chars: !@#$%^&*()_+",
  );
});
