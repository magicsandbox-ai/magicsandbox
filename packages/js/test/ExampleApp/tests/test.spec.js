import { test, expect } from "@magicsandbox.ai/test";

/*
To test in development (if you are not sure whether this applies to you, ignore it):
npx magicsandbox test -p 3002 --url http://localhost:3000 packages/js/test/ExampleApp
*/

test("example test", async ({ app }) => {
  await expect(app.getByText("Hello, world!")).toBeVisible();
  await app.getByRole("button", { name: "Click me" }).click();
  await expect(app.getByText("Button clicked!")).toBeVisible();
  const context = await app.execute(`return app.context()`);
  expect(context).toEqual("This is the context");
  await app.execute(`
    const text = app.text;
    app.api.setText(text + " Goodbye!");
  `);
  await expect(app.getByText("Button clicked! Goodbye!")).toBeVisible();
});

test.describe("run tests with autoInit disabled", () => {
  test.use({ appOptions: { autoInit: false } });
  test("test init", async ({ app }) => {
    await expect(app.getByText("Hello, world!")).not.toBeVisible();
    const init = await app.execute(`return app.init()`);
    expect(init).toEqual("This is the init");
    await expect(app.getByText("Hello, world!")).toBeVisible();
  });
});
