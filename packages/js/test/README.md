# @magicsandbox.ai/test

`@magicsandbox.ai/test` makes it easy to run [Playwright](https://playwright.dev/) tests for Magic Sandbox Apps.

## Getting Started

`npm install "@magicsandbox.ai/test"`

See the [Magic Sandbox docs](https://magicsandbox.ai/?_app=magicsandbox.Docs) to learn more about Magic Sandbox.

## Cost Warning

Because there are costs associated with loading Apps on Magic Sandbox, there are costs associated with running tests. See the [Tests Cost Warning](#tests-cost-warning) and [Configuration Cost Warning](#configuration-cost-warning) sections below for more details.

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

`@magicsandbox.ai/test` requires the `MAGICSANDBOX_API_KEY` environment variable to be set, which you can set in a `.env` file in your project root. You can get an API key [here](https://magicsandbox.ai/account/api-key).

See [Writing Tests](#writing-tests) for details on creating the test files like `test1.spec.js`.

`@magicsandbox.ai/test` depends on [@magicsandbox.ai/dev](https://github.com/magicsandbox-ai/magicsandbox/tree/main/packages/js/dev), so you should already be able to successfully run `npx magicsandbox dev MyApp`.

Then run:

`npx magicsandbox test MyApp`

This command will:

- Run `npx playwright install` to ensure the Playwright browsers used for testing are installed
- Start the `@magicsandbox.ai/dev` development server for MyApp if it's not already running
- If you haven't already, create a playwright.config.js file in MyApp/tests for you. See [Configuration](#configuration) for details.
- Run the tests in MyApp/tests

Any additional arguments are passed to [the Playwright CLI](https://playwright.dev/docs/test-cli):

`npx magicsandbox test MyApp --ui`

## Writing Tests

See the [Playwright docs](https://playwright.dev/docs/writing-tests) for details on writing tests.

`@magicsandbox.ai/test` extends Playwright's `test` function by adding an `app` fixture. When you use the `app` fixture, `@magicsandbox.ai/test` handles:

- Authentication using your API key
- Loading the correct URL and waiting for the dev server to build the app
- Selecting the correct nested iframe to use as the `app` fixture

`app` is a Playwright [Frame](https://playwright.dev/docs/api/class-frame) object.

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

By default, `app.init` is automatically called. If you want to test `init`, disable this behavior like so:

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

To disable `magicsandbox.Assistant` user confirmation prompts (for example, when spending money with `requestFunction`), set `autoConfirm` to true:

```javascript
test.use({ appOptions: { autoConfirm: true } });
```

See the ExampleApp folder for an App that passes the above tests.

### Tests Cost Warning

Each Playwright test runs in a new browser instance. That means each test has to load the Apps `magicsandbox.Assistant` and `magicsandbox.DevLocal` at a cost of $0.002. Be sure not to run thousands of tests!

Use extra caution when setting `autoConfirm` to true.

## Configuration

You can create or edit the `playwright.config.js` file in your App's tests folder and `magicsandbox.ai/test` won't override your changes. See the [Playwright docs](https://playwright.dev/docs/test-configuration) for details.

When the dev server first starts, the initial build can be slow (rebuilds are much faster). To guard against slow builds causing tests to fail, `magicsandbox.ai/test` configures a timeout of 60 seconds rather than Playwright's default of 30 seconds.

### Configuration Cost Warning

Because each test has a cost, consider carefully the impact of using `projects` to configure Playwright to run tests across many browsers or configurations.
