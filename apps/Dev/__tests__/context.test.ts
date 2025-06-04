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
import { reverse, logSecret } from "./reverse.ts";
interface AppProps {
  message?: string;
}
function init(): void {
  logSecret("secret");
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
}
function logSecret(secret: string) {
  console.log(secret);
}
export { logSecret };`,
    },
  },
  selectedFileName: "magic.json",
  deletedFiles: {},
};

const devState = new DevState({
  esbuildPromise: Promise.resolve(esbuild),
  initialApp,
});

function getLength(files: string[]) {
  return files.reduce(
    (acc, file) =>
      acc + (devState.selectedApp.files[file]?.content?.length ?? 0),
    0,
  );
}

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
  const context0 = await context(devState, {});
  console.log("default - should be everything");
  console.log(context0);
  expect(isFileInContext(context0, "magic.json")).toBe(true);
  expect(isFileInContext(context0, "index.tsx")).toBe(true);
  expect(isFileInContext(context0, "reverse.ts")).toBe(true);

  const context1 = await context(devState, {}, getLength(["magic.json"]) - 1);
  console.log("maxLength = magic.json - 1 - should only be magic.json");
  console.log(context1);
  expect(isFileInContext(context1, "magic.json")).toBe(true);
  expect(isFileInContext(context1, "index.tsx")).toBe(false);

  const context2 = await context(devState, {}, getLength(["magic.json"]));
  console.log(
    "maxLength = magic.json - should be magic.json and index.tsx summary",
  );
  console.log(context2);
  expect(isFileInContext(context2, "magic.json")).toBe(true);
  expect(isFileInContext(context2, "index.tsx")).toBe(true);
  expect(isFileInContext(context2, "reverse.ts")).toBe(false);

  const context3 = await context(
    devState,
    { files: ["reverse.ts"] },
    getLength(["magic.json"]),
  );
  console.log(
    "maxLength = magic.json, reverse.ts selected - should be magic.json and reverse.ts summary",
  );
  console.log(context3);
  expect(isFileInContext(context3, "magic.json")).toBe(true);
  expect(isFileInContext(context3, "index.tsx")).toBe(false);
  expect(isFileInContext(context3, "reverse.ts")).toBe(true);

  const context4 = await context(
    devState,
    { files: ["reverse.ts"] },
    getLength(["magic.json", "reverse.ts"]),
  );
  console.log(
    "maxLength = magic.json + reverse.ts, reverse.ts selected - should be magic.json, reverse.ts, and index.tsx summary",
  );
  console.log(context4);
  expect(isFileInContext(context4, "magic.json")).toBe(true);
  expect(isFileInContext(context4, "index.tsx")).toBe(true);
  expect(isFileInContext(context4, "reverse.ts")).toBe(true);
  //function definitions not included in summary
  expect(context4).not.toContain('logSecret("secret")');
  //expect(context4).not.toContain("reverse(message)");
  //right now as implemented, when adding a summary, we always add at least one node - todo could clean this up
  expect(context4).toContain("reverse(message)");

  const context5 = await context(
    devState,
    { files: ["reverse.ts"] },
    getLength(["magic.json", "reverse.ts", "index.tsx"]) - 1,
  );
  console.log(
    "maxLength = magic.json + reverse.ts + index.tsx - 1, reverse.ts selected - should be everything but index.tsx pointless",
  );
  console.log(context5);
  expect(isFileInContext(context5, "magic.json")).toBe(true);
  expect(isFileInContext(context5, "index.tsx")).toBe(true);
  expect(isFileInContext(context5, "reverse.ts")).toBe(true);
  //function definitions are included when there's an edge between it and the selected file reverse.ts
  expect(context5).toContain('logSecret("secret")');
  expect(context5).toContain("reverse(message)");
  //pointless function definition is not included because there's no edge between it and reverse.ts
  expect(context5).not.toContain("Hello from pointless!");

  const context6 = await context(devState, {
    files: ["reverse.ts"],
    code: ["pointless"],
  });
  console.log(
    "maxLength = magic.json + reverse.ts + index.tsx - 1, reverse.ts selected, selected code is 'pointless' - pointless should be included",
  );
  console.log(context6);
  expect(isFileInContext(context6, "magic.json")).toBe(true);
  expect(isFileInContext(context6, "index.tsx")).toBe(true);
  expect(isFileInContext(context6, "reverse.ts")).toBe(true);
  //pointless function definition is now included because we're selecting the code "pointless"
  //this may be kind of confusing since we didn't change maxLength vs. the last test and the result exceeds maxLength because everything is included
  //but when maxLength is less than the length of all the files, only nodes with edges are included
  expect(context6).toContain("Hello from pointless!");
});
