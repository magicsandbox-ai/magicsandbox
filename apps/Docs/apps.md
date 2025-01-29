# Magic Apps

Magic Apps create the frontend interfaces you see in Magic Sandbox. Behind the scenes, they're simply JSON objects with a number of mostly optional keys. Only `name`, `version`, and one of `script`, `html`, or `style` are required. Let's walk through them:

### script (string)

String of JavaScript code which is executed in the user's browser inside the Sandbox. The user's input is saved in the global `input` variable in the Sandbox, so `script` has access to it.

### html (string)

String of HTML code which is appended to document.body in the Sandbox.

### style (string)

String of CSS code which is added as a `<style>` tag in the Sandbox.

## Shared Keys between Magic Apps and Magic Functions

All of the remaining Magic App JSON keys are shared with Magic Functions, so we'll cover them together here:

### name (**required**) (string)

Magic App names must begin with a capital letter to distinguish them from Magic Functions, which must begin with a lowercase letter. Names can include alphanumeric characters and underscores and be at most 64 characters.

### version (**required**) (string)

App or Function version. Follow [semantic versioning conventions](https://semver.org/).

### type (string)

Used to indicate that your App or Function has certain behavior. We expect to add more types over time, so please provide [feedback](todo).

App types:

- `assistant`: an [Assistant](todo). See [magicsandbox.Assistant](todo).

Function types:

- `findApp`: a Function that takes user input and returns the name of an appropriate App. See [magicsandbox.findApp](todo). todo max cost, return array, exclude deprecated, assistants

### description (string)

App or Function description. This is used to discover your App or Function, so while not required, you should fill this out.

### minCost (number) (default 0.001)

Minimum cost in dollars required to call your App or Function. Must be between $0.001 and $1.00.

### finalCost (number)

The final cost charged to call your App or Function. Apps and Functions have different behavior when it comes to `finalCost`:

For Apps, `finalCost` is the cost charged to the user and defaults to `minCost` if not provided. So why use `finalCost`? Imagine your App has a minCost of $0.01 but immediately upon loading makes an expensive requestFunction call that costs $0.10. The user may not have the budget to make the requestFunction call, leading to a poor user experience. Instead, you could set `minCost` to $0.11 and `finalCost` to $0.01, still charging the user $0.01 to call your App but ensuring they have the budget to make the required requestFunction call.

For Functions, `finalCost` is not actually accepted as a key in the Magic App JSON, but instead can be included in an object returned from your Function's endpoint. This enables Functions to charge different costs depending on the arguments to the Function. See [Variable Costs](#variable-costs) for details.

### private (boolean) (default false)

Set to true to make your App or Function private. Note: this just means your App or Function won't be published publicly [todo link to more info](todo). Anyone who knows your App or Function name can still call it, which enables sharing with others without publishing publicly. To keep your App or Function truly private, give it a hard to guess name and keep it a secret by treating the name like a password.

### status (string) (default 'active')

Controls the availability of your App or Function. Supported values:

- `'active'` (default): App or Function is fully available.
- `'deprecated'`: App or Function is available but users receive deprecation warnings.
- `'inactive'`: Function cannot be called. Note that Apps cannot currently be inactive.

## Making Your App Magical

Those are all the keys in a Magic App - pretty simple! At its core, a Magic App is just typical HTML/CSS/JavaScript along with some metadata. What makes a Magic App magical is how it exposes information to the Assistant by creating two global variables:

- `app.context`: (any) => string, a function that returns a string giving the Assistant context about your App. You can think of this like documentation, but it might not be just a hardcoded string - you may want to update it dynamically based on the current state of your App.
- `app.api`: { [key: string]: any }, an object that exposes your App's API to the Assistant.

Let's look at a simple example:

```javascript
import React, { useState } from "react";
import { createRoot } from "react-dom/client";

function context() {
  return `API:
  - setText: (text: string) => void, updates the displayed text`;
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

export { context, api }; //magicsandbox.Dev handles assigning these to the global app object for you during the build process
```

Now here's what happens if a user asks the Assistant to 'make it say "Goodbye!"':

1. The Assistant calls `app.context()` to get the context string.
2. The Assistant generates the script `app.api.setText("Goodbye!");`.
3. The Assistant executes the script in the Sandbox, updating the App to display "Goodbye!" as requested.
