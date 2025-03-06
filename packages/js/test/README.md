# @magicsandbox.ai/test

`@magicsandbox.ai/test` makes it easy to run [Playwright](https://playwright.dev/) tests for Magic Sandbox Apps.

## Getting Started

`npm install "@magicsandbox.ai/test"`

See the [Magic Sandbox docs](https://magicsandbox.ai/?_app=magicsandbox.Docs) to learn more about Magic Sandbox.

## Usage

Set up a folder structured like so:

```
.env
MyApp/
├── magic.json5
├── index.js
└── tests/
    ├── test1.spec.js
    └── test2.spec.js
```

`@magicsandbox.ai/test` requires the `MAGICSANDBOX_API_KEY` environment variable to be set, which you can set in a `.env` file in your project root. You can get an API key [here](https://magicsandbox.ai/api-key).

See the next section for details on creating the test files like `test1.spec.js`.

`@magicsandbox.ai/test` depends on [@magicsandbox.ai/dev](https://github.com/magicsandbox-ai/magicsandbox/tree/main/packages/js/dev), so you should already be able to successfully run `npx magicsandbox dev MyApp`.

Then run:

`npx magicsandbox test MyApp`

This command will:

- Run `npx playwright install` to ensure the Playwright browsers used for testing are installed and updated
- Start the `@magicsandbox.ai/dev` development server for MyApp
- If you haven't already, create a playwright.config.js file in MyApp/tests for you
- Run the tests in MyApp/tests

Any additional arguments are passed to [the Playwright CLI](https://playwright.dev/docs/test-cli):

`npx magicsandbox test MyApp --ui`

## Writing tests

See the [Playwright docs](https://playwright.dev/docs/writing-tests) for details on writing tests.

`@magicsandbox.ai/test` extends Playwright's `test` function by:

- Handling authentication using your API key
- Adding an `app` fixture.

Your App executes in a (nested) iframe, so by using the `app` fixture, you don't have to worry about selecting the correct element. `app` is a Playwright [Frame](https://playwright.dev/docs/api/class-frame) object.

Here's an example test:

```javascript
import { test, expect } from "@magicsandbox.ai/test";

test("example test", async ({ app }) => {
  await expect(app.getByText("Hello, world!")).toBeVisible();
  await app.getByRole("button", { name: "Click me" }).click();
  await expect(app.getByText("Button clicked!")).toBeVisible();
  const context = await app.evaluate(() => app.context()); //https://playwright.dev/docs/api/class-frame#frame-evaluate
  expect(context).toEqual("This is the context");
  await app.evaluate(() => {
    const text = app.api.text;
    app.api.setText(text + " Goodbye!");
  });
  await expect(app.getByText("Button clicked! Goodbye!")).toBeVisible();
});
```

**Warning**:

The `app` fixture calls `app.init` for you by default. If you want to test `init`, disable this behavior like so:

```javascript
test.describe("run tests with autoInit disabled", () => {
  test.use({ appOptions: { autoInit: false } });
  test("test init", async ({ app }) => {
    await expect(app.getByText("Hello, world!")).not.toBeVisible();
    const init = await app.evaluate(() => app.init());
    expect(init).toEqual("This is the init");
    await expect(app.getByText("Hello, world!")).toBeVisible();
  });
});
```

See the ExampleApp folder for an App that passes the above tests.
