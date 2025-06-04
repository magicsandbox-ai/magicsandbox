import { test, expect, jest } from "@jest/globals";
import * as esbuild from "esbuild";
jest.unstable_mockModule("@magicsandbox.ai/docs/docs.md", () => ({
  default:
    "# Mock Documentation\n\n ## Making your App Magic\n\nIt's cool to make your app magic!",
}));
jest.unstable_mockModule("../prompt.ts", () => ({
  prompt: ({ context }: { context: string }) => context,
}));
const { DevState } = await import("../DevState.ts");
const { context } = await import("../context.ts");

/*
npm run jest -- apps/Dev/__tests__/context.test.ts

todo context doesn't actually respect maxLength, it just stops adding nodes after reaching it
plus the added formating like <magic.json> adds additional length
but getting context to actually respect maxLength may make testing easier
*/

global.getSelection = () => null;

const initialApp = {
  id: "TestContext@0.1.0",
  files: {
    "magic.json": {
      name: "magic.json",
      content: "{name: 'TestContext', version: '0.1.0'}",
    },
    "index.tsx": {
      name: "index.tsx",
      content: `import React from "react";
import { createRoot } from "react-dom/client";
import { reverse } from "./reverse.ts";
interface AppProps {
  message?: string;
}
function init(): void {
  createRoot(document.getElementById("root")!).render(
    <App message="Hello, there!" />,
  );
}
function App({ message = "Hello, there!" }: AppProps): JSX.Element {
  return <div className="flex h-screen items-center justify-center">{reverse(message)}</div>;
}
function pointless() {
  console.log("Hello from pointless! This is a pointless function that's not used anywhere.");
}
export { init }`,
    },
    "reverse.ts": {
      name: "reverse.ts",
      content: `export function reverse(str: string): string {
  return str.split("").reverse().join("");
}`,
    },
  },
  selectedFileName: "magic.json",
  deletedFiles: {},
};

const devState = new DevState({
  esbuildPromise: Promise.resolve(esbuild),
  initialApp,
});

function isFileInContext(context: string, filename: string) {
  /*
  a file not in context looks like:
  <index.tsx>
  ...
  </index.tsx>
  */
  return (
    context.includes(`<${filename}>`) && !context.includes(`<${filename}>\n...`)
  );
}

test("context", async () => {
  //default - should be everything
  const context0 = await context(devState, {});
  console.log(context0);
  expect(isFileInContext(context0, "magic.json")).toBe(true);
  expect(isFileInContext(context0, "index.tsx")).toBe(true);
  expect(isFileInContext(context0, "reverse.ts")).toBe(true);

  //maxLength = 1 - should only be magic.json in context
  const context1 = await context(devState, {}, 1);
  console.log(context1);
  expect(isFileInContext(context1, "magic.json")).toBe(true);
  expect(isFileInContext(context1, "index.tsx")).toBe(false);

  //maxLength = context1.length - should be enough for magic.json and index.tsx summary
  const context2 = await context(devState, {}, context1.length);
  console.log(context2);
  expect(isFileInContext(context2, "magic.json")).toBe(true);
  expect(isFileInContext(context2, "index.tsx")).toBe(true);
  expect(isFileInContext(context2, "reverse.ts")).toBe(false);

  //maxLength = context1.length, reverse.ts selected - should be magic.json and reverse.ts
  const context3 = await context(
    devState,
    { files: ["reverse.ts"] },
    context1.length,
  );
  console.log(context3);
  expect(isFileInContext(context3, "magic.json")).toBe(true);
  expect(isFileInContext(context3, "index.tsx")).toBe(false);
  expect(isFileInContext(context3, "reverse.ts")).toBe(true);

  //maxLength = context3.length + 100, reverse.ts selected
  //should be magic.json, reverse.ts, and index.tsx summary
  const context4 = await context(
    devState,
    { files: ["reverse.ts"] },
    context3.length + 100,
  );
  console.log(context4);
  expect(isFileInContext(context4, "magic.json")).toBe(true);
  expect(isFileInContext(context4, "index.tsx")).toBe(true);
  expect(isFileInContext(context4, "reverse.ts")).toBe(true);
  expect(context4).not.toContain("reverse(message)"); //function definitions not included in summary

  //no maxLength, reverse.ts selected
  const context5 = await context(devState, { files: ["reverse.ts"] });
  console.log(context5);
  expect(isFileInContext(context5, "magic.json")).toBe(true);
  expect(isFileInContext(context5, "index.tsx")).toBe(true);
  expect(isFileInContext(context5, "reverse.ts")).toBe(true);
  //App function definition is included because there's an edge between it and the selected file reverse.ts
  expect(context5).toContain("reverse(message)");
  //pointless function definition is not included because there's no edge between it and reverse.ts
  expect(context5).not.toContain("Hello from pointless!");

  //no maxLength, reverse.ts selected, selected code is "pointless"
  const context6 = await context(devState, {
    files: ["reverse.ts"],
    code: ["pointless"],
  });
  console.log(context6);
  expect(isFileInContext(context6, "magic.json")).toBe(true);
  expect(isFileInContext(context6, "index.tsx")).toBe(true);
  expect(isFileInContext(context6, "reverse.ts")).toBe(true);
  expect(context6).toContain("reverse(message)");
  //pointless function definition is now included because we're selecting the code "pointless"
  expect(context6).toContain("Hello from pointless!");
});
