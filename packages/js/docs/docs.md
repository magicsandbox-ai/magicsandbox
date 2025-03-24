# Magic Sandbox Documentation

This technical documentation is aimed at developers interested in writing code for Magic Sandbox. For non-technical user support, please see the [About](https://magicsandbox.ai?_app=magicsandbox.About) page. This documentation assumes you have already read through the About page and are familiar with Magic Sandbox at a high level.

1. [Apps](#apps): how to create frontend Apps
2. [Functions](#functions): how to create backend Functions
3. [Publishing](#publishing): how to publish your Apps and Functions
4. [Sandbox](#sandbox): about the environment Apps run in
5. [Assistants](#assistants): how to create your own Assistant
6. [Advanced Topics](#advanced-topics)

The Magic Sandbox [public repo](https://github.com/magicsandbox-ai/magicsandbox) is a resource that includes example Apps, Functions, and useful packages. If you have any questions or feedback, please create an issue - we'd love to hear from you!

# Apps

Apps are the frontend interfaces you see in Magic Sandbox. Behind the scenes, they're simply JSON objects with a number of mostly optional keys. Only `name`, `version`, and at least one of `script`, `html`, or `style` are required. Let's walk through them:

## App keys

### script

_(string)_

String of JavaScript which is executed in the Sandbox.

### html

_(string)_

String of HTML which is appended to `document.body` in the Sandbox.

### style

_(string)_

String of CSS which is added as a `<style>` tag in the Sandbox.

## App and Function shared keys

All of the remaining App JSON keys are shared with Functions, so we'll cover them together here:

### name

_(**required**, string)_

App names must begin with a capital letter to distinguish them from Functions, which must begin with a lowercase letter. Names can include alphanumeric characters and underscores and be at most 64 characters.

### version

_(**required**, string)_

App or Function version. Follow [semantic versioning conventions](https://semver.org/).

### type

_(string)_

Used to indicate that your App or Function has certain behavior. We expect to add more types over time.

App types:

- `assistant`: an [Assistant](#assistants)

### description

_(string)_

App or Function description. This is used by Assistants and other tools to discover your App or Function, so while not required, you should include it.

### minCost

_(number, default 0.001)_

Minimum cost in dollars required to call your App or Function. Must be between $0.001 and $1.00.

### finalCost

_(number)_

The final cost charged to call your App or Function. Apps and Functions have different behavior when it comes to `finalCost`:

For Apps, `finalCost` is the cost charged to the user and defaults to `minCost` if not provided. So why use `finalCost`? Imagine your App has a `minCost` of $0.01 but immediately upon loading makes an expensive `requestFunction` call that costs $0.10. The user may not have the balance to make the `requestFunction` call, leading to a poor user experience. Instead, you could set `minCost` to $0.11 and `finalCost` to $0.01, still charging the user $0.01 to call your App but ensuring they have the balance to make the required `requestFunction` call. Assistants should allow Apps to spend the difference between `minCost` and `finalCost` without requiring additional confirmation.

For Functions, `finalCost` is not accepted as a key in the App JSON, but instead can be included in an object returned from your Function's endpoint. This enables Functions to charge different costs depending on the arguments to the Function. See [Variable Costs](#variable-costs) for details.

### private

_(boolean, default false)_

Set to true to make your App or Function private. This just means your App or Function won't be published publicly (more info [here](#app-and-function-metadata)). Anyone who knows your App or Function name can still call it, which enables sharing with others without publishing publicly. To keep your App or Function truly private, give it a hard to guess name and keep it a secret by treating the name like a password.

### status

_(string, default "active")_

Controls the availability of your App or Function. Supported values:

- "active" (default): App or Function is fully available
- "deprecated": App or Function is available but users receive deprecation warnings
- "inactive": Function cannot be called. Apps cannot currently be made inactive

## Making your App Magic

As you can see, an App is just typical HTML/CSS/JavaScript along with some metadata. What makes the App magic is how it works with the Assistant by exposing a global `app` object that includes:

- `app.init` (() => string?): an optionally async function called when the App is first loaded. It can optionally return a context string that's used by the Assistant to dynamically initialize the App
- `app.context` (() => string): an optionally async function called when the user chats with the Assistant after the App is loaded. It returns a context string that's used by the Assistant to answer the user's question or to execute a script to dynamically update the App
- `app.api` (object): an object that exposes your App's API to the Assistant

You can think of the context string returned by `app.init` and `app.context` as your App's documentation, but it might not be just a hardcoded string - you can update it dynamically based on the current state of your App.

Let's look at a simple App, example.Notes, and walk through its lifecycle:

```javascript
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

async function init() {
  // need to get the notes here so they're available in the initial context call
  const initNotes = await requestGetData("notes");
  api.notes = initNotes;
  createRoot(document.getElementById("root")).render(
    <App initNotes={initNotes} />,
  );
  return context();
}

function context() {
  return `# example.Notes

This is a simple notes app.

## Context

The current notes are:

<notes>
${api.notes}
</notes>

## API

### app.api.addNote(note: string)

Add a note to the notes.
`;
}

const api = {
  notes: null,
  addNote: null,
};

function App({ initNotes }) {
  const [notes, setNotes] = useState(initNotes || "");

  useEffect(() => {
    requestPutData("notes", notes).catch(console.error);
  }, [notes]);

  api.notes = notes;
  api.addNote = (note) => {
    setNotes(`${notes}\n${note}`);
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <textarea
        className="grow resize-none border-none p-4"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add a note..."
      />
    </div>
  );
}

export { init, context, api };
```

1. The user says "I'm competing in a chili cookoff, can you add the groceries I'll need to my notes?".
2. The Assistant launches example.Notes, triggering a call to `app.init()`.
3. `app.init` uses [requestGetData](#requestgetdata) to get the user's notes, renders the App, and returns a context string.
4. The Assistant reads the context string, which includes the user's notes and the App's API. The Assistant replies "I'll add the groceries you need to your notes. Since you already have a note to buy tomatoes and onions, I won't add them again." The Assistant then executes the script `app.api.addNote("For the chili cookoff, buy: ...");`. Note: if `app.init` didn't return anything, this step would be skipped.
5. Later, the user says "can you make me a to do list for the day?", triggering a call to `app.context()`.
6. `app.context` returns a context string.
7. The Assistant reads the context string and replies "Based on your notes, here's a to do list for the day: ...".

When you export `init`, `context`, and `api` from your `script`, both `magicsandbox.Dev` and `@magicsandbox.ai/dev` will assign them to the global `app` object during the build process (see [Publishing](#publishing) for details). If you use an alternative approach to publishing your App, you'll need to handle this yourself.

Assistants are aware of the basic details of the Magic Sandbox platform and have access to the [Sandbox](#sandbox) documentation, so you don't need to provide that in your App's context.

# Functions

Functions are server-side functions that can be called by Apps or other Functions. Unlike Apps, which run on the frontend (the user's browser), Functions run on the backend.

Like Apps, Functions are also just JSON objects. See [shared keys](#app-and-function-shared-keys) for the keys you can include.

Magic Sandbox currently only supports Functions that you host on your own server. `name`, `version`, and `endpoint` are required keys for Functions.

## Function keys

### endpoint

_(**required**, string)_

HTTPS URL that Magic Sandbox will call to execute your backend code:

- The request is a POST that will timeout after 60 seconds
- Includes headers:
  - `Content-Type: application/json`
  - If you have an API key, `Authorization: Bearer <hashedKey>`, where `<hashedKey>` is the SHA-256 hash of your API key encoded as a hexadecimal string. You can generate an API key [here](https://magicsandbox.ai/api-key). See below code snippets that generate `hashedKey`
- Includes the body `{ id, args, options, userInfo, app }`, where:
  - `id` is the fully resolved Function name, author.name@version
  - `args`, `options` were the arguments to [requestFunction](#requestfunction)
  - `userInfo` (UserInfo) is an object with keys populated based on the arguments in `options.includeUserInfo`
  - `app` is the name of the App that is calling the Function. This is provided by the user's Assistant and is not verified by Magic Sandbox.

```typescript
type UserInfo = {
  userId?: string;
};
```

```javascript
// javascript
const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");

// python
hashed_key = hashlib.sha256(api_key.encode()).hexdigest();
```

### documentation

_(string)_

Documentation of how to use your Function.

### decode

_(string, default "json")_

Specifies how to decode the response from your Function's endpoint. Supported values:

- "json" (default): Parse the response as JSON. If parsing fails, the response will be returned as a string
- "msgpack": Parse the response using [msgpack](https://github.com/kriszyp/msgpackr?tab=readme-ov-file#structured-cloning). If parsing fails, `requestFunction` will throw an error
- "string": Decode the response as a UTF-8 string
- "bytes": Return the raw bytes as an ArrayBuffer

See [Streaming JSON](#streaming-json) for details on streaming with decode set to "json" or "msgpack".

### subscribeToUpdates

_(boolean, default false)_

Whether you want your endpoint to receive updates when users publish or update Apps or Functions. See [Subscribing to Updates](#subscribing-to-updates) for details.

## Calling other Functions

From your endpoint, you can call other Functions by making a POST request to `https://magicsandbox.ai/request-function`. Your request should include the following:

- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <apiKey>`, where `<apiKey>` is your API key, which you can generate [here](https://magicsandbox.ai/api-key)
- Body:
  - An object with keys `fn`, `args`, and `options`, the arguments to [requestFunction](#requestfunction)

# Publishing

This section details how to publish Apps and Functions. You have a number of options to do so:

- [magicsandbox.Dev](https://magicsandbox.ai?_app=magicsandbox.Dev) is an App that offers an easy way to create and publish Apps without installing anything on your computer. It provides a live preview so you can test your App as you develop and includes a button for easy publishing
- [@magicsandbox.ai/dev](https://github.com/magicsandbox-ai/magicsandbox/tree/main/packages/js/dev) is a command-line tool for creating and publishing Apps locally. Refer to its docs for help getting started
- Rather than using `magicsandbox.Dev`, you can create your own App to publish Apps and Functions using [requestPublish](#requestpublish)
- You can publish Apps and Functions locally by making a POST request to `https://magicsandbox.ai/publish`. Your request should include the following:
  - URL parameters:
    - `kind`: "app" or "function"
    - `name`: App or Function name
    - `version`: App or Function version
  - Headers:
    - `Content-Type: application/json`
    - `Authorization: Bearer <apiKey>`, where `<apiKey>` is your API key, which you can generate [here](https://magicsandbox.ai/api-key)
  - Body:
    - the App or Function JSON object

`magicsandbox.Dev` is the easiest way to get started, while `@magicsandbox.ai/dev` offers better integration with development tools like IDEs and version control. When using either tool, you'll edit a `magic.json` file:

## magic.json

`magic.json` can include all of the keys documented in [Apps](#apps), like `script`, `style`, and `html`. However, trying to edit code inside of a JSON file is inconvenient, so `magic.json` accepts additional keys enabling you to edit code using separate files instead. For example, rather than editing `script` in `magic.json` directly, you can create multiple JavaScript files. The build process will combine all of your files and populate `script`, `style`, and `html` for you.

The remainder of this section describes the additional keys accepted by `magic.json`:

### magic.json keys

#### scriptFile

_(string, default "index.js")_

Main filename for `script` code. Your JavaScript files are bundled with esbuild using `scriptFile` as the entrypoint.

#### html

_(string, default `<div id="root"></div>`)_

Unlike when publishing to Magic Sandbox directly, a default value for `html` is provided if you don't specify `html` or have an `htmlFile`.

#### htmlFile

_(string, default "index.html")_

Filename containing `html` code.

#### style

_(string, default "@tailwind base; @tailwind components; @tailwind utilities;")_

Unlike when publishing to Magic Sandbox directly, a default value for `style` is provided if you don't specify `style` or have a `styleFile`, enabling you to use Tailwind.

#### styleFile

_(string, default "index.css")_

Filename containing `style` code.

#### tailwindConfig

_(object)_

Options to pass to [Tailwind](https://v3.tailwindcss.com/docs/configuration). Currently only Tailwind v3 is supported.

`magicsandbox.Dev` does not support configuring `content`. By default, all files ending in `.js`, `.jsx`, or `.html` are included. You can add an `excludeContent` key to exclude files:

```javascript
{
  excludeContent: ["utils.js", "index.html"],
};
```

`tailwindConfig` is simply an object, so it doesn't support all of Tailwind's configuration options. Rather than supplying `tailwindConfig` in `magic.json`, you can also create a `tailwind.config.js` or `tailwind.config.mjs` file. This enables advanced features like `plugins`, `presets`, and `content.transform` that require the config to be evaluated as JavaScript:

```javascript
import typography from "@tailwindcss/typography";

export default {
  plugins: [typography],
};
```

`tailwindConfig` is not used if `tailwind.config.js` or `tailwind.config.mjs` is present.

#### cacheRequests

_(boolean)_

Whether to cache `requestApp` and `requestFunction` calls, which can save cost when making repeated calls during development.

#### author

_(string)_

To read from the database using e.g. `requestGetData`, the `author` key is required. Alternatively, you can set `options.app` when calling `requestGetData`.

Note that writes made during development with `requestPutData` or `requestDeleteData` are maintained only in memory, not saved to the database. They can be retrieved by later calls to `requestGetData` but will be lost upon refresh. The 10 MB database size limit is not enforced.

#### dependencies

_(object)_

Semantic version ranges to use for the packages you import.

#### overrides

_(object)_

Semantic version ranges to use for all imports, enabling you to override the dependencies of your dependencies. Similar to `overrides` in npm, but `magicsandbox.Dev` currently supports only a subset of the functionality that npm does:

```javascript
{
  "overrides": {
    //always import dep1 as major version 1
    "dep1": "^1",
    //except when importing from dep2@2.0.0, use version 2.0.0
    "dep2@2.0.0": { //note that version is required here, "dep2" or "dep2@^2" would not do anything
      "dep1": "2.0.0" //note this takes precedence over the dep1 override above
    }
  }
}
```

#### esbuildOptions

_(object, default below)_

Options to pass to [esbuild](https://esbuild.github.io/api/#build).

The options `entryPoints`, `write`, and `plugins` cannot be set. The default options are:

```javascript
{
  bundle: true,
  globalName: "app", //assigns exports (i.e. init, context, api) to this global variable
  loader: { ".js": "jsx" },
  target: "es2020",
  minify: publishing ? true : false, //true when building for publishing, false when building for live preview
  sourcemap: publishing ? false : true, //false when building for publishing, true when building for live preview
};
```

#### debug

_(boolean)_

Enable additional logging to debug the build.

#### update

_(boolean)_

Whether to update the App when publishing. The build will be skipped, as `script`, `html`, and `style` cannot be updated. See [Updating Apps and Functions](#updating-apps-and-functions) for details.

## Updating Apps and Functions

You can update Apps and Functions by publishing again with the same name and version.

Updates have the following restrictions:

- `script`, `html`, `style`: cannot be updated. Publish a new version instead
- Apps cannot be changed to Functions or vice versa

You only need to provide the keys you're updating. In fact, this is required for Apps, as the server will throw an error if you include `script`, `html`, or `style` when republishing an App. For example, to update `description`, you can publish the following:

```javascript
{
  name: "MyApp",
  version: "1.0.1",
  update: true, //if using magicsandbox.Dev or @magicsandbox.ai/dev
  description: "This is my new and improved description",
}
```

# Sandbox

The secure environment that Apps execute in is called the Sandbox. It's implemented as an iframe with a sandbox attribute. The Sandbox environment is restrictive but provides a number of global functions that enable you to bypass these restrictions. Each of these Sandbox functions has a name that begins with `request`, reflecting the fact that they may fail if not approved. The Assistant is responsible for approving Sandbox requests, either automatically if determined to be safe or by asking for user confirmation.

The Sandbox has the following high level restrictions and associated Sandbox functions:

- Limited network access. APIs like `fetch` don't work, and you can't use traditional links
  - Use `requestApp` and `requestFunction` to call other Apps and Functions
  - Use `requestFetch` to fetch data from the web
  - Use `requestOpenUrl` to open a link in a new tab
  - Use `requestPublish` to publish a Function
  - Note: currently there are limited ways that your App can access the network without using a Sandbox function. You should not rely on these, as they may be blocked at any time without warning
- No direct access to web storage APIs
  - Use `requestPutData`, `requestDeleteData`, `requestGetData`, `requestGetAllData`, and `requestGetAllKeysData` to store and retrieve data
- Permissions to use certain browser features like creating popups or accessing the camera may be blocked. We expect the allowed permissions to evolve over time. Please share any feedback you have by creating an [issue](https://github.com/magicsandbox-ai/magicsandbox/issues/new?template=Blank+issue)

## Calling Apps and Functions

### requestApp

Retrieve an App's `style`, `html`, `script`, and `metadata`.

**Arguments:**

- `app` _(**required**, string)_: App to call, either in the form author.name@version or just author.name, in which case the latest version is used
- `options` _(object)_:
  - `maxCost` _(number, default 0.001)_: Maximum cost you're willing to pay for the App call, which should be at least the App's `minCost`. Cannot exceed $1.00. Apps can't charge variable costs, so the user will be charged the App's `finalCost`
  - `includeMetadata` _(string[], default [])_: Array of metadata keys to include. See [here](#app-and-function-metadata) for available keys

**Returns:** a Promise that resolves to an App:

```typescript
type App = {
  style?: string;
  html?: string;
  script?: string;
  metadata: object;
};
```

`metadata` includes the keys specified in `includeMetadata` as well as `userBalance` and `userBalanceRemainingDays`.

### requestFunction

Execute a Function and returns the result.

**Arguments:**

- `fn` _(**required**, string)_: Function to call, either in the form author.name@version or just author.name, in which case the latest version is used
- `args` _(**required**, any)_: Arguments to pass to the called Function
- `options` _(object)_:
  - `maxCost` _(number, default 0.001)_: Maximum cost you're willing to pay for the Function call, which should be at least the Function's `minCost`. Cannot exceed $1.00
  - `stream` _(boolean, default false)_: Whether to stream the result
  - `includeMetadata` _(string[], default [])_: Array of metadata keys to include. See [here](#app-and-function-metadata) for available keys
  - `includeUserInfo` _(string[], default [])_: Array of user info keys to include. Supported values:
    - "userId": Include the user ID

**Returns:** a Promise that includes the Function result and metadata. The type depends on the `stream` option.

- `stream: false`: `Promise<{result: any, metadata: object}>`. This is the default behavior. Resolves to an object with keys `result` and `metadata`
- `stream: true`: `Promise<AsyncIterable<{result: any} | {metadata: object}>>`. Resolves to an AsyncIterable, which can be consumed using a `for await...of` loop. Each streamed chunk is an object with either a `result` key or a `metadata` key, not both. `result` is populated on all chunks except the final chunk, while `metadata` is populated on only the final chunk

`metadata` includes the keys specified in `includeMetadata` as well as `userBalance` and `userBalanceRemainingDays`.

### requestMetadata

Retrieve App and Function metadata.

**Arguments:**

- `identifier` _(**required**, string)_: can take the forms:
  - author.name@version: retrieve a specific App or Function version
  - author.name: retrieve the latest App or Function version
  - author: retrieve the latest version of all Apps and Functions published by the author. Use `kind` to specify whether to retrieve Apps or Functions
- `includeMetadata` _(**required**, string[])_: Array of metadata keys to include. See [here](#app-and-function-metadata) for available keys
- `options` _(object)_:
  - `kind` _("app" | "function")_: Whether to retrieve App or Function metadata. If not provided, both are retrieved. Only relevant when `query` specifies only an author
  - `includePrivate` _(boolean, default false)_: Whether to retrieve private Apps and Functions. Assistants should not allow Apps to set this to true

**Returns:** a Promise that resolves to an array of objects with the keys specified in `includeMetadata`

## Storing and Retrieving Data

Magic Sandbox provides Sandbox functions for storing and retrieving key/value pairs. Each App has its own isolated storage, ensuring that keys used by one App don't interfere with keys used by another. You can use another App's storage by passing `app` in `options`, though these requests are subject to user approval. Furthermore, put and delete requests that specify an `app` that has not been called with `requestApp` will throw an error.

Each App can store up to 10 MB of data. There is no concept of App version used for storage, so author.App@1.0.0 and author.App@1.0.1 store data in the same location.

### requestPutData

Store a key/value pair.

**Arguments:**

- `key` _(**required**, string)_: Key to store
- `val` _(**required**, any)_: Value to store. May not be `null`. Will be serialized using [msgpackr's](https://github.com/kriszyp/msgpackr) implementation of the [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
- `options` _(object)_:
  - `app` _(string)_: App to use for storage
  - `evictionPolicy` _(string)_: Controls behavior if the put would cause the app to exceed its storage limit. Supported values:
    - undefined (default): Does not evict any key/value pairs and returns a "Database size limit exceeded" error
    - "fifo": Evict the oldest key/value pairs as needed to make room for the new key/value pair

**Returns:** a Promise that resolves to true

### requestDeleteData

Delete a key/value pair.

**Arguments:**

- `key` _(**required**, string)_: Key to delete
- `options` _(object)_:
  - `app` _(string)_: App to use for storage

**Returns:** a Promise that resolves to true

### requestGetData

Retrieve a key/value pair.

**Arguments:**

- `key` _(**required**, string)_: Key to retrieve
- `options` _(object)_:
  - `app` _(string)_: App to use for storage

**Returns:** a Promise that resolves to the previously stored value or `undefined`

### requestGetAllData

Retrieve all key/value pairs.

**Arguments:**

- `options` _(object)_:
  - `app` _(string)_: App to use for storage

**Returns:** a Promise that resolves to an object mapping keys to values

### requestGetAllKeysData

Retrieve all keys.

**Arguments:**

- `options` _(object)_:
  - `app` _(string)_: App to use for storage

**Returns:** a Promise that resolves to an array of keys

## Other Sandbox Functions

### requestFetch

Make a fetch request.

**Arguments:**

- `resource`
- `options`

See the [fetch docs](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API). Only the following `options` are supported: `body`, `headers`, `integrity`, `method`, `priority`, and `redirect`.

Additionally, `options` accepts a `responseType` option used to parse the response body:

- "auto" (default): Parse as json or string according to the Content-Type header. If the Content-Type header is not present, returns an arrayBuffer
- "json": Parse the response as JSON
- "string": Decode the response as a UTF-8 string
- "bytes": Return the raw bytes as an ArrayBuffer

**Returns:** a Promise that resolves to a SerializedResponse, since the Response object itself cannot be serialized and passed into the Sandbox.

```typescript
type SerializedResponse = {
  body: any; // parsed according to responseType
  status: number;
  headers: { [headerName: string]: string };
};
```

### requestOpenUrl

Open a URL in a new tab. Traditional links can't be opened in the Sandbox, so use `requestOpenUrl` instead.

```html
<!-- don't do this -->
<a href="https://example.com">Click me</a>

<!-- do this instead -->
<a onclick="requestOpenUrl('https://example.com')">Click me</a>
```

**Arguments:**

- `url` _(**required**, string)_: URL to open

**Returns:** a Promise that resolves to true

### requestPublish

Publish a Function or App.

**Arguments:**

- `magicJson` _(**required**, object)_: See [Apps](#apps) and [Functions](#functions) for details

**Returns:** a Promise that resolves to true

### requestDownload

Download a file.

**Arguments:**

- `filename` _(**required**, string)_: filename to use for the downloaded file
- `content` _(**required**, BlobPart)_: content of the file. Can be a string, or see [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob) for accepted types

**Returns:** a Promise that resolves to true

### requestUrlParams

Get or update URL parameters.

**Arguments:**

- `params` _(object | null, default undefined)_:
  - If `undefined`, returns current URL parameters without making changes
  - If an object, key/value pairs to use to update the URL parameters. Setting a value to `null` will remove that parameter
  - If `null`, removes all URL parameters

**Returns:** a Promise that resolves to an object containing the URL parameters after making any updates in `params`.

**Notes:**

- The special key `hash` is reserved for the URL hash. So a URL like `?hash=foo#bar` will return `{hash: "bar"}`. Avoid using `hash` in the query string to avoid conflicts
- Keys that begin with an underscore (e.g. `_app`) are reserved for Magic Sandbox use. These cannot be modified by Apps

### requestSandbox

A convenience function to call other Sandbox functions.

**Arguments:**

- `request` _(**required**, string)_: the Sandbox function to call. "app" calls `requestApp`, "function" calls `requestFunction`, "putData" calls `requestPutData`, etc.
- `args` _(any)_: the arguments to pass to the Sandbox function

**Returns:** a Promise that resolves to the result from the Sandbox function

## Error Handling

If a Sandbox function throws an error, it will have the following properties:

- `name` (string): "RequestSandboxError"
- `message` (string): a message describing the error
- `data?` (object): an optional object containing additional error data
  - `minCost?` (number): provided if calling `requestApp` or `requestFunction` with a `maxCost` that is less than the App or Function's `minCost`

# Assistants

This section provides an overview of the Assistant - you don't need to know these details to create an App or Function, though you may find it helpful context.

You can create your own Assistant. See [magicsandbox.Assistant](https://github.com/magicsandbox-ai/magicsandbox/tree/main/apps/Assistant) for an example implementation. In the future, we'd like to make `magicsandbox.Assistant` more modular and easily extendable.

Assistants are simply Apps that are executed in the Sandbox immediately when the user loads the page. Like any other App, the Sandbox restrictions apply, but Sandbox functions like `requestApp` are available. The key difference though is that Magic Sandbox always approve Sandbox requests made by the Assistant. This gives Assistants the unchecked ability to spend the user's balance and modify their data, which is why it's so critical that users trust their Assistant.

There are no hard restrictions on what exactly an Assistant does or doesn't do. That said, the remainder of this section details the features implemented by `magicsandbox.Assistant`, many of which you may want to implement if creating your own Assistant.

#### Create a UI, handle user input, and execute Apps

The Assistant is almost completely responsible for the UI - Magic Sandbox does not provide any UI beyond the navigation bar at the top of the page. The Assistant should create a UI that can handle user input and execute Apps. To execute Apps safely, the Assistant needs to create a child Sandbox. The [react-sandbox](https://github.com/magicsandbox-ai/magicsandbox/tree/main/packages/js/react-sandbox) package provides helpers to make this easier.

When the Assistant's `init` function is called, it receives a `user` argument, which is an object with keys:

- `name`: the user's username
- `userBalance`: the user's balance
- `userBalanceRemainingDays`: the number of days remaining until the user's balance resets. `undefined` for unauthenticated users

The Assistant is responsible for setting `_app` with `requestUrlParams`.

If interacting with Apps via `init`, `context`, and `api`, the Assistant should be aware of the basic details of the Magic Sandbox platform and have access to the [Sandbox](#sandbox) documentation. Apps are not expected to provide this context.

When the user clicks on the Magic Sandbox logo in the top left of the page (which is outside of the Sandbox), rather than doing a slow reload of the entire page, Magic Sandbox sends a "reload" message to the Assistant. The Assistant should reset its state appropriately.

#### Handle Sandbox requests from Apps

When an App calls a Sandbox function, a message is sent to its parent. The Assistant should listen for these messages and approve the request, deny it, or ask the user for confirmation. If approved, the Assistant should forward the request to Magic Sandbox and return the response back to the App. The [react-sandbox](https://github.com/magicsandbox-ai/magicsandbox/tree/main/packages/js/react-sandbox) package provides helpers to make this easier.

Assistants should consider the following risks when handling Sandbox requests:

- **Financial risk** (`requestApp`, `requestFunction`): Assistants should control how much Apps are allowed to spend. Assistants should allow Apps to spend the difference between `minCost` and `finalCost` without requiring additional confirmation
- **Publishing risk** (`requestPublish`): Assistants should always ask for user approval when `requestPublish` is called. A malicious App could publish a broken or malicious new version of an App or Function against the author's will
- **Privacy risk** (`requestGetData`, `requestGetAllData`, `requestGetAllKeysData`): Assistants should ask for user approval before allowing cross-author reads
- **Data loss risk** (`requestPutData`, `requestDeleteData`): Assistants should ask for user approval before allowing cross-author writes. Assistants can take backups of data by providing a `backup` option to the data Sandbox functions. This backup storage is isolated from the Assistant's main storage, has a size limit of 1 GB, and is not backed up in the cloud or synced to other devices
- **Download risk** (`requestDownload`): Assistants should always ask for user approval when `requestDownload` is called
- **Network risk** (`requestApp`, `requestFunction`, `requestMetadata`, `requestFetch`, `requestOpenUrl`, `requestPublish`): Assistants should rate limit network requests to prevent abuse

Assistants should also implement the following:

- Identify the App calling `requestFunction`
- Prevent Apps from setting `includePrivate` to true when calling `requestMetadata`
- Identify the App calling data Sandbox functions
- Prevent Apps from accessing backup storage
- Prevent Apps from setting `_app` when calling `requestUrlParams`

# Advanced Topics

## API Logs

If you want to create a log that the Assistant can see within your app's API, rather than `console.log`, use the global `assistant.log` method. For example, to implement a method where the Assistant can request to view the contents of a note by providing its id:

```javascript
app.api.logNote = (id) => {
  assistant.log(notes[id]);
};
```

The Assistant can then see the log in its next message and use it to provide a response to the user.

The following log methods are available - they're similar to their corresponding `console` methods except for `assistant.full`:

- `assistant.log`
- `assistant.error`
- `assistant.warn`
- `assistant.info`
- `assistant.debug`
- `assistant.full`: Assistants may truncate logs to avoid using too many tokens - using the `assistant.full` method is an indication that this log should not be truncated

## Intercepting Assistant Scripts

It's possible to intercept Assistant scripts and modify them before they're executed, but the API is not yet stable. Please create an [issue](https://github.com/magicsandbox-ai/magicsandbox/issues/new?template=Blank+issue) and share your use case if you'd like to do this.

## Variable Costs

Magic Sandbox enables Functions to charge variable costs:

1. When a Function is published, it specifies a `minCost`, the minimum cost the publisher will accept.
2. When a Function is called, the caller specifies `maxCost`, the maximum cost they're willing to pay.
   - Magic Sandbox ensures that `maxCost` is greater than or equal to the Function's `minCost`
3. When the Function executes, it can specify `finalCost`, the actual cost the user will be charged.
   - Magic Sandbox ensures `finalCost` is between $0.001 and `maxCost`
   - If `finalCost` is not specified, it defaults to `minCost`
   - `requestApp` does not support variable costs and always charges `minCost`

To specify `finalCost`, you must:

- Return a command object, which is an object with two keys: `result` and `__command`. `result` will be sent to the user, while `__command` is used by the server
- Include an `x-command-object` header in your response

```typescript
type CommandObject = {
  result?: any; //sent to the user
  __command: {
    //used by the server
    finalCost: number;
  };
};
```

The command object cannot exceed 100KB. If you have a large result you want to send to the user, you'll need to [stream](#streaming-json) it.

## Streaming JSON

When streaming over a network, the client may not receive chunks that correspond to your writes; your writes may be combined or split across multiple chunks. This will cause issues if streaming with `decode` set to "json" or "msgpack".

The Sandbox can reconstruct your writes and properly decode the chunks if you prefix each chunk with its length. You can do this by:

1. Including an `x-length-prefix` header in your response
2. Prefixing each chunk of your response with its 4-byte length (big-endian uint32)
3. If streaming a command object, the final chunk must be prefixed with the special 4-byte sequence [0xFF, 0xFF, 0xFF, 0xFF] (four 255 bytes).

Rather than implement this yourself, you can use the [JavaScript](https://github.com/magicsandbox-ai/magicsandbox/tree/main/packages/js/streaming) or [Python](https://github.com/magicsandbox-ai/magicsandbox/tree/main/packages/python/magicsandbox_streaming) helpers and do something like:

```javascript
import { createLengthPrefixTransform } from "@magicsandbox.ai/streaming";
import { pipeline } from "stream/promises";
// ...
const source = somehowGetReadable(); // your readable stream
res.setHeader("x-length-prefix", "true"); // your response writable stream
await pipeline(source, createLengthPrefixTransform(), res);
// for a command object: createLengthPrefixTransform({ finalObject: true })
```

```python
from magicsandbox import length_prefix_transform
from fastapi.responses import StreamingResponse
# ...
source = somehow_get_async_iterable() # your async iterable
return StreamingResponse(length_prefix_transform(source), headers={"x-length-prefix": "true"})
# for a command object: length_prefix_transform(source, final_object=True)
```

Consult your specific server framework's documentation for details.

## App and Function Metadata

Below are the metadata keys that are available for Apps and Functions:

```typescript
type Metadata = {
  id: string; //author.name@version
  author: string;
  name: string;
  version: string;
  major: number;
  minor: number;
  patch: number;
  kind: "app" | "function";
  description: string;
  documentation: string;
  type: string;
  minCost: number;
  finalCost: number;
  status: "active" | "deprecated" | "inactive";
  decode: "json" | "msgpack" | "string" | "bytes";
};
```

App and Function metadata is made publicly available unless the App or Function's `private` key is set to true. This enables things like building an App or Function that can search for relevant Apps or Functions given some criteria.

### Accessing Public Metadata

Make a GET request to `https://magicsandbox.ai/magics` and include the header `Authorization: Bearer <apiKey>`, where `<apiKey>` is your API key, which you can generate [here](https://magicsandbox.ai/api-key). Ensure your client is configured to follow redirects.

The public metadata is updated hourly. Requesting the public metadata more frequently than hourly may result in an error. If you need more frequent updates, you'll need to publish a Function with the `subscribeToUpdates` key set to true.

### Subscribing to Updates

If you set `subscribeToUpdates` to true, your endpoint will receive updates when users publish or update Apps or Functions.

- The request is a POST to `endpoint/update`, so if your endpoint is `https://example.com/my-function`, you'll receive updates at `https://example.com/my-function/update`
- Includes headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <hashedKey>`, see [endpoint](#endpoint)
- Includes a `Metadata` body

## Limits

- Function timeout: 60 seconds
- Maximum requestFunction arguments size: 1 MB
- Maximum Function response size: 10 MB
- Maximum command object size: 100 KB
- Maximum publishing size: 50 MB
- Maximum App storage: 10 MB
- Maximum Assistant backup storage: 1 GB
