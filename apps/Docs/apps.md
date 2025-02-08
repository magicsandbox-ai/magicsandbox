# Magic Apps

Magic Apps create the frontend interfaces you see in Magic Sandbox. Behind the scenes, they're simply JSON objects with a number of mostly optional keys. Only `name`, `version`, and at least one of `script`, `html`, or `style` are required. Let's walk through them:

## Magic App keys

### script

_(string)_

String of JavaScript which is executed in the Sandbox.

### html

_(string)_

String of HTML which is appended to `document.body` in the Sandbox.

### style

_(string)_

String of CSS which is added as a `<style>` tag in the Sandbox.

## Shared keys between Apps and Functions

All of the remaining Magic App JSON keys are shared with Magic Functions, so we'll cover them together here:

### name

_(**required**, string)_

Magic App names must begin with a capital letter to distinguish them from Magic Functions, which must begin with a lowercase letter. Names can include alphanumeric characters and underscores and be at most 64 characters.

### version

_(**required**, string)_

App or Function version. Follow [semantic versioning conventions](https://semver.org/).

### type

_(string)_

Used to indicate that your App or Function has certain behavior. We expect to add more types over time.

App types:

- `assistant`: an [Assistant](#assistants).

### description

_(string)_

App or Function description. This is used to discover your App or Function, so while not required, you should include it.

### minCost

_(number, default 0.001)_

Minimum cost in dollars required to call your App or Function. Must be between $0.001 and $1.00.

### finalCost

_(number)_

The final cost charged to call your App or Function. Apps and Functions have different behavior when it comes to `finalCost`:

For Apps, `finalCost` is the cost charged to the user and defaults to `minCost` if not provided. So why use `finalCost`? Imagine your App has a `minCost` of $0.01 but immediately upon loading makes an expensive `requestFunction` call that costs $0.10. The user may not have the budget to make the `requestFunction` call, leading to a poor user experience. Instead, you could set `minCost` to $0.11 and `finalCost` to $0.01, still charging the user $0.01 to call your App but ensuring they have the budget to make the required `requestFunction` call.

For Functions, `finalCost` is not accepted as a key in the Magic App JSON, but instead can be included in an object returned from your Function's endpoint. This enables Functions to charge different costs depending on the arguments to the Function. See [Variable Costs](#variable-costs) for details.

### private

_(boolean, default false)_

Set to true to make your App or Function private. This just means your App or Function won't be published publicly (more info [here](#public-app-and-function-metadata)). Anyone who knows your App or Function name can still call it, which enables sharing with others without publishing publicly. To keep your App or Function truly private, give it a hard to guess name and keep it a secret by treating the name like a password.

### status

_(string, default 'active')_

Controls the availability of your App or Function. Supported values:

- 'active' (default): App or Function is fully available.
- 'deprecated': App or Function is available but users receive deprecation warnings.
- 'inactive': Function cannot be called. Apps cannot currently be made inactive.

## Making your App magical

Those are all the keys in a Magic App - pretty simple! At its core, a Magic App is just typical HTML/CSS/JavaScript along with some metadata. What makes a Magic App magical is how it works with the Assistant by creating two global variables:

- `app.context` ((any) => string): an optionally async function that returns a string giving the Assistant context about your App. You can think of this like your App's documentation, but it might not be just a hardcoded string - you can update it dynamically based on the current state of your App.
- `app.api` (object): an object that exposes your App's API to the Assistant.

Let's look at a simple example:

```javascript
import React, { useState } from "react";
import { createRoot } from "react-dom/client";

function context() {
  return `API:
  - app.api.setText: (text: string) => void, updates the displayed text`;
}

const api = {
  setText: null,
};

function App() {
  const [text, setText] = useState("Hello, world!");
  api.setText = setText;
  return <div>{text}</div>;
}

createRoot(document.getElementById("root")).render(<App />);

export { context, api };
```

Now here's what happens if a user asks the Assistant to 'make it say "Goodbye!"':

1. The Assistant calls `app.context()` to get the context string.
2. The Assistant reads the context string and generates the script `app.api.setText("Goodbye!");`.
3. The Assistant executes the script in the Sandbox, updating the App to display "Goodbye!" as requested.

When you export `context` and `api` from your `script`, both [magicsandbox.Dev](#magicsandboxdev) and [@magicsandbox.ai/dev](#magicsandboxaidev) will assign them to the global `app` object during the build process. If you use an alternative approach to publishing your App, you'll need to handle this yourself.

Assistants are aware of the basic details of the Magic Sandbox platform and have access to the [Sandbox](#sandbox) documentation, so you don't need to provide that in your App's context.

## Initializing your App

In addition to `app.context` and `app.api`, you can also create an `app.init` function that's called when your App is first loaded. `app.init` is an optionally async function that's called with three arguments provided by the Assistant:

- `input` (string): user input
- `budget` (number): the budget for `requestApp` and `requestFunction` calls. If exceeded, the Assistant will ask for user approval before making the call.
- `urlParams` (object): URL parameters

`app.init` can optionally return a string. If it does, the string will be used as context for the Assistant to generate a script to dynamically initialize your App. See [magicsandbox.Dev](https://github.com/magicsandbox-ai/magicsandbox/blob/main/apps/Dev/index.js) for an example.

Here's a simple example of using `app.init` to render a React app and pass input, budget, and urlParams as props:

```javascript
import React, { useState } from "react";
import { createRoot } from "react-dom/client";

function context() {
  // ...
}

const api = {
  // ...
};

function App({ input, budget, urlParams }) {
  // do something with input, budget, and urlParams...
}

function init({ input, budget, urlParams }) {
  createRoot(document.getElementById("root")).render(
    <App input={input} budget={budget} urlParams={urlParams} />,
  );
  // optionally return context to the Assistant
}

export { context, api, init };
```
