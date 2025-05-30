import { test, expect } from "@magicsandbox.ai/test";

/*
npm run test dev

todos:
- additionalContext
- advancedDocs
- approve/reject changes
- creating new file
- multiple find/replace
*/

//init waits for the wasm to initialize, so we'll disable autoInit and wait for init before testing
test.use({ appOptions: { autoInit: false } });

test("Dev", async ({ app }) => {
  await app.evaluate(async () => {
    return await app.init();
  });

  //api create
  await app.evaluate(async () => {
    await app.api.createApp(
      "HelloWorld",
      "A simple hello world app",
      `<index.js>
import React from "react";
import { createRoot } from "react-dom/client";
function init() {
  createRoot(document.getElementById("root")).render(
    <App />,
  );
}
function App() {
  return <div className="flex h-screen items-center justify-center">Hello, world!</div>;
}
export { init };
</index.js>
`,
    );
  });
  const preview = app.childFrames()[0];
  await expect(preview.getByText("Hello, world!")).toBeVisible();

  //api update
  await app.evaluate(async () => {
    await app.api.updateFiles(`<index.js>
import React from "react";
import { createRoot } from "react-dom/client";
function init() {
  createRoot(document.getElementById("root")).render(
    <App />,
  );
}
function App() {
  return <div className="flex h-screen items-center justify-center">Hello, updated!</div>;
}
export { init };
</index.js>
`);
  });
  await expect(preview.getByText("Hello, updated!")).toBeVisible();

  //api update find/replace
  await app.evaluate(async () => {
    await app.api.updateFiles(`<index.js>
<find>
<div className="flex h-screen items-center justify-center">Hello, updated!</div>
</find>
<replace>
<div className="flex h-screen items-center justify-center">Hello, replaced!</div>
</replace>
</index.js>
`);
  });
  await expect(preview.getByText("Hello, replaced!")).toBeVisible();
});
