import { test, expect } from "@magicsandbox.ai/test";

test("example test", async ({ app }) => {
  await expect(app.getByText("Hello, world!")).toBeVisible();
  await app.getByRole("button", { name: "Click me" }).click();
  await expect(app.getByText("Button clicked!")).toBeVisible();
  const context = await app.evaluate(() => app.context());
  expect(context).toEqual("This is the context");
  await app.evaluate(() => {
    const text = app.api.text;
    app.api.setText(text + " Goodbye!");
  });
  await expect(app.getByText("Button clicked! Goodbye!")).toBeVisible();
});

test.describe("run tests with autoInit disabled", () => {
  test.use({ appOptions: { autoInit: false } });
  test("test init", async ({ app }) => {
    await expect(app.getByText("Hello, world!")).not.toBeVisible();
    const init = await app.evaluate(() => app.init());
    expect(init).toEqual("This is the init");
    await expect(app.getByText("Hello, world!")).toBeVisible();
  });
});
