import { test, expect } from "@magicsandbox.ai/test";

/*
npm run test dev

todos:
- test typing after diff - shouldn't create more diffs
- approve/reject changes
- tailwind.config.js build
- magic.json dependencies
- hover
- undo history
- help
- download
- publish
- preview mobile/tablet/desktop
- prettier
*/

//init waits for the wasm to initialize, so we'll disable autoInit and wait for init before testing
test.use({ appOptions: { autoInit: false } });

test("Dev", async ({ app }) => {
  await app.evaluate(async () => {
    return await app.init();
  });

  //opens on Example magic.json app
  await expect(app.getByText(/['"]Example['"]/)).toBeVisible();

  //select index.js file
  await app.getByRole("button", { name: "index.js", exact: true }).click();
  await expect(app.getByText("import React")).toBeVisible();

  //add file
  const newFileInput = app.getByRole("textbox", { name: "New file" });
  await newFileInput.fill("new.js");
  await newFileInput.press("Enter");
  await expect(
    app.getByRole("button", { name: "new.js", exact: true }),
  ).toBeVisible();

  //delete file
  await app.getByRole("button", { name: "Delete new.js" }).click();
  await expect(
    app.getByRole("button", { name: "new.js", exact: true }),
  ).not.toBeVisible();

  //update preview
  await app.getByRole("button", { name: "Update Preview" }).click();
  const preview = app.childFrames()[0];
  await expect(preview.getByText("Hello, world!")).toBeVisible({
    timeout: 15000, //allow for initial build to take longer
  });

  //api createApp
  await app.evaluate(async () => {
    await app.api.createApp(
      "HelloWorld",
      "A simple hello world app",
      `<index.tsx>
import React from "react";
import { createRoot } from "react-dom/client";
interface AppProps {
  message?: string;
}
function init(): void {
  createRoot(document.getElementById("root")!).render(
    <App message="Hello, there!" />,
  );
}
function App({ message = "Hello, there!" }: AppProps): JSX.Element {
  return <div className="flex h-screen items-center justify-center">{message}</div>;
}
export { init };
</index.tsx>`,
    );
  });
  await expect(preview.getByText("Hello, there!")).toBeVisible();

  //select app
  const selectApp = app.getByRole("combobox", { name: "Select App" });
  await selectApp.click();
  await selectApp.selectOption("Example@0.1.0");
  await app.getByRole("button", { name: "magic.json", exact: true }).click();
  await expect(app.getByText(/['"]Example['"]/)).toBeVisible();

  //delete app
  await app.getByRole("button", { name: "Delete App" }).click();
  await app.getByRole("button", { name: "Delete", exact: true }).click(); //confirmation
  await expect(app.getByText(/['"]HelloWorld['"]/)).toBeVisible(); //magic.json

  //api update
  await app.evaluate(async () => {
    await app.api.updateFiles(
      `<index.tsx>
import React from "react";
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
export { init };
</index.tsx>
<reverse.ts>
export function reverse(str: string): string {
  return str.split("").reverse().join("");
}
</reverse.ts>
`,
    );
  });
  await expect(preview.getByText("!ereht ,olleH")).toBeVisible();

  //api update find/replace
  await app.evaluate(async () => {
    await app.api.updateFiles(
      `<index.tsx>
<find>
Hello, there!
</find>
<replace>
Goodbye!
</replace>
<find>
import { reverse } from "./reverse.ts";
</find>
<replace>
import { reverseN } from "./reverse.ts";
</replace>
<find>
reverse(message)
</find>
<replace>
reverseN(message, 4)
</replace>
</index.tsx>
<reverse.ts>
export function reverse(str: string): string {
  return str.split("").reverse().join("");
}
export function reverseN(str: string, n: number): string {
  return str.slice(0, n).split("").reverse().join("");
}
</reverse.ts>
`,
    );
  });
  await expect(preview.getByText("dooG")).toBeVisible();

  //api additionalContext
  const additionalContext = await app.evaluate(async () => {
    await app.api.additionalContext({
      files: ["index.tsx", "reverse.ts"],
      code: ["reverse", "reverseN"],
    });
  });
  expect(additionalContext).toEqual(expect.any(String));

  //api advancedDocs
  const advancedDocs = await app.evaluate(async () => {
    await app.api.advancedDocs();
  });
  expect(advancedDocs).toEqual(expect.any(String));
});
