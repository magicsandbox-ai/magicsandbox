# Magic Sandbox Documentation

This technical documentation is aimed at developers interested in writing code that runs on Magic Sandbox. For non-technical user support, please see the [About](https://magicsandbox.ai?_app=magicsandbox.About) page. This documentation assumes you have already read through the About page and are familiar with Magic Sandbox at a high level.

1. [Magic Apps](#magic-apps)
2. [Magic Functions](#magic-functions)
3. [Publishing](#publishing)
4. [Sandbox](#sandbox)
5. [Assistants](#assistants)
6. [Advanced Topics](#advanced-topics)

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

Set to true to make your App or Function private. This just means your App or Function won't be published publicly (more info [here](#public-metadata)). Anyone who knows your App or Function name can still call it, which enables sharing with others without publishing publicly. To keep your App or Function truly private, give it a hard to guess name and keep it a secret by treating the name like a password.

### status

_(string, default 'active')_

Controls the availability of your App or Function. Supported values:

- 'active' (default): App or Function is fully available.
- 'deprecated': App or Function is available but users receive deprecation warnings.
- 'inactive': Function cannot be called. Apps cannot currently be made inactive.

## Making your App Magic

As you can see, a Magic App is just typical HTML/CSS/JavaScript along with some metadata. What makes the App magic is how it works with the Assistant by exposing a global `app` object that includes:

- `app.init` (() => string?): an optionally async function called when the App is first loaded with URL parameters as an argument. It can optionally return a context string that's used by the Assistant to dynamically initialize the App.
- `app.context` (() => string): an optionally async function called when the user chats with the Assistant after the App is loaded. It returns a context string that's used by the Assistant to answer the user's question or to execute a script to dynamically update the App.
- `app.api` (object): an object that exposes your App's API to the Assistant.

You can think of the context string returned by `app.init` and `app.context` as your App's documentation, but it might not be just a hardcoded string - you can update it dynamically based on the current state of your App.

Let's look at a simple example.Notes App and walk through its lifecycle:

```javascript
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

async function init() {
  // get the notes here so they're available in the initial context call
  // if we used a useEffect inside App, they wouldn't be available
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

When you export `init`, `context`, and `api` from your `script`, both [magicsandbox.Dev](#magicsandboxdev) and [@magicsandbox.ai/dev](#magicsandboxaidev) will assign them to the global `app` object during the build process. If you use an alternative approach to publishing your App, you'll need to handle this yourself.

Assistants are aware of the basic details of the Magic Sandbox platform and have access to the [Sandbox](#sandbox) documentation, so you don't need to provide that in your App's context.

# Magic Functions

Magic Functions are server-side functions that can be called by Magic Apps or other Magic Functions. Unlike Magic Apps, which run on the frontend (the user's browser), Magic Functions run on the backend.

Like Magic Apps, Magic Functions are also just JSON objects. See [shared keys](#shared-keys-between-apps-and-functions) for the keys you can include.

Magic Sandbox currently only supports Magic Functions that you host on your own server. `name`, `version`, and `endpoint` are required keys for Magic Functions.

## Magic Function keys

### endpoint

_(**required**, string)_

HTTPS URL that Magic Sandbox will call to execute your backend code:

- The request is a POST that will timeout after 60 seconds
- Includes headers:
  - `Content-Type: application/json`
  - If you have an API key, `Authorization: Bearer <hashedKey>`, where `<hashedKey>` is the SHA-256 hash of your API key encoded as a hexadecimal string. You can generate an API key [here](https://magicsandbox.ai/api-key). See below code snippets that generate `hashedKey`.
- Includes the body `{ id, args, options, userInfo, app }`, where:
  - `id` is the fully resolved Function name, author.name@version
  - `args`, `options` were the arguments to [requestFunction](#requestFunction)
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

_(string, default 'json')_

Specifies how to decode the response from your Function's endpoint. Supported values:

- 'json' (default): Parse the response as JSON. If parsing fails, the response will be returned as a string.
- 'msgpack': Parse the response using [msgpack](https://github.com/kriszyp/msgpackr?tab=readme-ov-file#structured-cloning). If parsing fails, `requestFunction` will throw an error.
- 'string': Decode the response as a UTF-8 string
- 'bytes': Return the raw bytes as an ArrayBuffer

See [Streaming JSON](#streaming-json) for details on streaming with decode set to 'json'.

### subscribeToUpdates

_(boolean, default false)_

Whether you want your endpoint to receive updates when users publish or update Apps or Functions. See [Subscribing to Updates](#subscribing-to-updates) for details.

## Calling other Magic Functions

From your endpoint, you can call other Magic Functions by making a POST request to `magicsandbox.ai/request-function`. Your request should include the following:

- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <apiKey>`, where `<apiKey>` is your API key, which you can generate [here](https://magicsandbox.ai/api-key)
- Body:
  - An object with keys `fn`, `args`, and `options`, the arguments to [requestFunction](#requestFunction)

# Publishing

## magicsandbox.Dev

The App [magicsandbox.Dev](https://magicsandbox.ai?_app=magicsandbox.Dev) is an easy way to create and publish Magic Apps without installing anything on your computer. It provides a live preview so you can test your App as you develop and includes a button for easy publishing.

With magicsandbox.Dev, you'll edit a `magic.json` file. This file can include all of the keys documented in [Magic Apps](#magic-apps), like `script`, `style`, and `html`. However, trying to edit code inside of a JSON file is inconvenient, so `magic.json` accepts additional keys enabling you to edit code using separate files instead. For example, rather than editing `script` in `magic.json` directly, you can create multiple JavaScript files. When magicsandbox.Dev builds your App, it will combine all of your files and populate `script`, `style`, and `html` for you.

### magic.json

#### scriptFile

_(string, default 'index.js')_

Main filename for `script` code. magicsandbox.Dev bundles your JavaScript files using esbuild using `scriptFile` as the entrypoint.

#### html

_(string, default '<div id="root"></div>')_

Unlike when publishing to Magic Sandbox directly, magicsandbox.Dev provides a default value for `html` if you don't specify `html` or have an `htmlFile`.

#### htmlFile

_(string, default 'index.html')_

Filename containing `html` code.

#### style

_(string, default '@tailwind base; @tailwind components; @tailwind utilities;')_

Unlike when publishing to Magic Sandbox directly, magicsandbox.Dev provides a default value for `style`, assuming you're using Tailwind if you don't specify `style` or have a `styleFile`.

#### styleFile

_(string, default 'index.css')_

Filename containing `style` code.

#### tailwindConfig

_(object, default below)_

Options to pass to [Tailwind](https://v3.tailwindcss.com/docs/configuration). Currently only Tailwind v3 is supported.

magicsandbox.Dev does not support configuring `content`. By default, all files ending in `.js`, `.jsx`, or `.html` are included. You can add an `excludeContent` key to exclude files:

```javascript
{
  excludeContent: ['utils.js', 'index.html],
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

#### cacheRequests (boolean) (default true)

Whether to cache `requestApp` and `requestFunction` calls, which can save cost when making repeated calls during development. Set to false to disable.

#### author (string)

To read from the database using e.g. `requestGetData`, magicsandbox.Dev needs to know the App to use for storage in the form 'author.name', so you must set the `author` key. Alternatively, you can set `options.app` when calling `requestGetData`.

Note that magicsandbox.Dev only maintains writes made with `requestPutData` or `requestDeleteData` in memory, not saved to the database. They can be retrieved by later calls to `requestGetData` but will be lost upon refresh. magicsandbox.Dev does not currently enforce the 10 MB database size limit.

#### dependencies (object)

Version ranges to use for the packages you import. magicsandbox.Dev supports import statements that use [semver ranges](https://github.com/npm/node-semver#versions):

```javascript
import React from "react@^18";
```

However, if you import a package across multiple files, it can be easier to manage the version in `magic.json` using the `dependencies` key:

```javascript
{
  "dependencies": {
    "react": "^18"
  }
}
```

todo dependencies takes precedence over the version ranges specified in the import statements

#### overrides (object)

Version ranges to use for all imports, enabling you to override the dependencies of your dependencies. If you're familiar with the behavior of `overrides` in npm, note that magicsandbox.Dev currently supports only a subset of the functionality that npm does:

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

#### esbuildOptions (object) (default below)

Options to pass to [esbuild](https://esbuild.github.io/api/#build).

The default values below can be overridden, except for `entryPoints`, `write`, and `plugins`:

```javascript
{
  entryPoints: [scriptFile], //cannot be overridden
  write: false, //cannot be overridden
  plugins: [magicsandbox.Dev.customPlugins], //cannot be overridden
  bundle: true,
  globalName: 'app', //assigns exports (i.e. context, api) to this global variable
  loader: { '.js': 'jsx' },
  target: 'es2020',
  minify: publishing ? true : false, //true when building for publishing, false when building for live preview
  sourcemap: publishing ? false : true, //false when building for publishing, true when building for live preview
};
```

#### debug (boolean) (default false)

Enable additional logging to debug the build.

#### cdn (string) (default 'esm.sh')

The CDN to use for the build. Supported values are `esm.sh` and `jsdelivr `.

#### optimizedTreeShaking (boolean) (default true)

Whether to further minify the build by tree shaking unused imports, which requires two build passes. This is only supported for `cdn` `esm.sh`.

#### update (boolean) (default false)

Whether to update the App when publishing. magicsandbox.Dev will skip the build, as `script`, `html`, and `style` cannot be updated. See [Updating Magic Apps and Functions](#updating-magic-apps-and-functions) for details.

### magicsandbox.Dev advanced details

#### JSON5

The `magic.json` file can be written in JSON5.

#### Why are my builds sometimes slow?

magicsandbox.Dev parses your import statements and bundles external dependencies like React separately. When you rebuild your App, if the external dependencies haven't changed, magicsandbox.Dev will skip bundling external dependencies, making the rebuild extremely fast. If your external dependencies have changed, magicsandbox.Dev will fetch and bundle them again, making the build slower.

#### Debugging

When using magicsandbox.Dev, your code runs in an iframe that's nested several layers deep. Because of this, it can be difficult to find your code in the Sources tab in Chrome's devtools.

The easiest way to debug your code in Chrome is to add a `debugger` statement and run your code with devtools open, which will open your file in the Sources tab. Your files will all be prefixed with 'MagicApp', like 'MagicApp:index.js'.

#### Peer dependencies

magicsandbox.Dev handles peer dependencies differently than npm. Consider the following dependency graph:

```
root -> (peer@1, dep1, dep2)
dep1 -> (PEER: peer@1)
dep2 -> (peer@2, dep3)
dep3 -> (PEER: peer@2)
```

npm places peer dependencies at or above the dependent package, creating the following tree:

```
root
  +-- peer@1
  +-- dep1
  +-- dep2
      +-- peer@2
      +-- dep3
```

magicsandbox.Dev currently takes a simplified approach, assuming a package marked as a peer dependency should only resolve to a single version throughout the tree. It will create the following tree and emit a warning that dep2's and dep3's version ranges for peer@2 are ignored:

```
root
  +-- peer@1
  +-- dep1
  +-- dep2
  +-- dep3
```

This is actually more convenient for peer dependencies like React when you want to ensure only a single version is used globally. However, it may not support more advanced use cases. Please [create an issue](https://github.com/magicsandbox-ai/magicsandbox/issues/new?template=Blank+issue) if you have any feedback.

## @magicsandbox.ai/dev

The package [@magicsandbox.ai/dev](https://www.npmjs.com/package/@magicsandbox.ai/dev) is a command-line tool for creating and publishing Magic Apps locally. Refer to the docs for more details.

## Custom Methods

You can develop your own methods for publishing Magic Apps and Functions. Remember, only the keys documented in [Magic Apps](#magic-apps) and [Magic Functions](#magic-functions) are supported when publishing to the server. `magic.json` keys like `scriptFile` are not supported.

### Custom Magic App

Rather than using magicsandbox.Dev, you can create your own Magic App to publish Magic Apps and Functions using [requestPublish](#requestPublish).

### Custom Local Development

You can publish Magic Apps and Functions locally by making a POST request to `magicsandbox.ai/publish`. Your request should include the following:

- URL parameters:
  - `kind`: 'app' or 'function'
  - `name`: App or Function name
  - `version`: App or Function version
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <apiKey>`, where `<apiKey>` is your API key, which you can generate [here](https://magicsandbox.ai/api-key)
- Body:
  - the App or Function JSON object

Here's an example:

```javascript
fetch(
  `https://magicsandbox.ai/publish?kind=app&name=${appObj.name}&version=${appObj.version}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(appObj),
  },
);
```

## Updating Magic Apps and Functions

You can update Magic Apps and Functions by publishing again with the same name and version.

Updates have the following restrictions:

- `script`, `html`, `style`: cannot be updated. Publish a new version instead.
- Apps cannot be changed to Functions or vice versa.

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

The Sandbox is implemented as an iframe with a sandbox attribute. The Sandbox environment is restrictive but provides a number of global functions that enable you to bypass these restrictions. Each of these Sandbox functions has a name that begins with `request`, reflecting the fact that they may fail if not approved. The Assistant is responsible for approving Sandbox requests, either automatically if determined to be safe or by asking for user confirmation.

The Sandbox has the following high level restrictions and associated Sandbox functions:

- Limited network access. APIs like `fetch` don't work, and you can't use traditional links.
  - Use `requestApp` and `requestFunction` to call other Magic Apps and Magic Functions
  - Use `requestFetch` to fetch data from another website
  - Use `requestOpenUrl` to open a link in a new tab
  - Use `requestPublish` to publish a Magic Function
  - Note: currently there are limited ways that your App can access the network without using a Sandbox function. You should not rely on these, as they may be blocked at any time without warning.
- No direct access to web storage APIs.
  - Use `requestPutData`, `requestDeleteData`, `requestGetData`, `requestGetAllData`, and `requestGetAllKeysData` to store and retrieve data
- Permissions to use certain browser features like creating popups or accessing the camera may be blocked. We expect the allowed permissions to evolve over time. Please share any feedback you have by creating an [issue](https://github.com/magicsandbox-ai/magicsandbox/issues/new?template=Blank+issue).

## Calling Magic Apps and Functions

### requestApp

Retrieves a Magic App's `style`, `html`, `script`, and `metadata`.

**Arguments:**

- `app` _(**required**, string)_: Magic App to call, either in the form author.name@version or just author.name, in which case the latest version is used.
- `options` _(object)_:
  - `maxCost` _(number, default 0.001)_: Maximum cost you're willing to pay for the App call, which should be at least the App's `minCost`. Cannot exceed $1.00. Magic Apps can't charge variable costs, so the user will be charged the App's `finalCost`.
  - `includeMetadata` _(string[], default [])_: Array of metadata keys to include. See [here](#app-and-function-metadata) for available keys.

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

Executes a Magic Function and returns the result.

**Arguments:**

- `fn` _(**required**, string)_: Magic Function to call, either in the form author.name@version or just author.name, in which case the latest version is used.
- `args` _(**required**, any)_: Arguments to pass to the called Function.
- `options` _(object)_:
  - `maxCost` _(number, default 0.001)_: Maximum cost you're willing to pay for the Function call, which should be at least the Function's `minCost`. Cannot exceed $1.00.
  - `stream` _(boolean, default false)_: Whether to stream the result.
  - `includeMetadata` _(string[], default [])_: Array of metadata keys to include. See [here](#app-and-function-metadata) for available keys.
  - `includeUserInfo` _(string[], default [])_: Array of user info keys to include. Supported values:
    - 'userId': Include the user ID

**Returns:** a Promise that includes the Function result and metadata. The type depends on the `stream` option.

- `stream: false`: `Promise<{result: any, metadata: object}>`. This is the default behavior. Resolves to an object with keys `result` and `metadata`.
- `stream: true`: `Promise<AsyncIterable<{result: any} | {metadata: object}>>`. Resolves to an AsyncIterable, which can be consumed using a `for await...of` loop. Each streamed chunk is an object with either a `result` key or a `metadata` key, not both. `result` is populated on all chunks except the final chunk, while `metadata` is populated on only the final chunk.

`metadata` includes the keys specified in `includeMetadata` as well as `userBalance` and `userBalanceRemainingDays`.

## Storing and Retrieving Data

Magic Sandbox provides Sandbox functions for storing and retrieving key/value pairs. Each Magic App has its own isolated storage, ensuring that keys used by one App don't interfere with keys used by another.

You can use another App's storage by passing `app` in `options`, though these requests are subject to user approval. Furthermore, put and delete requests that specify an `app` that has not been called with `requestApp` will throw an error.

Each Magic App can store up to 10 MB of data. There is no concept of App version used for storage, so author.App@1.0.0 and author.App@1.0.1 store data in the same location.

### requestPutData

Store a key/value pair.

**Arguments:**

- `key` _(**required**, string)_: Key to store
- `val` _(**required**, any)_: Value to store. May not be `null` and will be serialized using [msgpackr's](https://github.com/kriszyp/msgpackr) implementation of the [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).
- `options` _(object)_:
  - `app` _(string)_: App to use for storage
  - `evictionPolicy` _(string)_: Controls behavior if the put would cause the app to exceed its storage limit. Supported values:
    - undefined _(default)_: Does not evict any key/value pairs and returns a 'Database size limit exceeded' error.
    - 'fifo': Evict the oldest key/value pairs as needed to make room for the new key/value pair.

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

- 'auto' (default): Parse as json or string according to the Content-Type header. If the Content-Type header is not present, returns an arrayBuffer.
- 'json': Parse the response as JSON
- 'string': Decode the response as a UTF-8 string
- 'bytes': Return the raw bytes as an ArrayBuffer

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

Publish a Magic Function or Magic App.

**Arguments:**

- `magicJson` _(**required**, object)_: See [Magic Apps](#magic-apps) and [Magic Functions](#magic-functions) for details.

**Returns:** a Promise that resolves to true

### requestDownload

Download a file.

**Arguments:**

- `filename` _(**required**, string)_: filename to use for the downloaded file
- `content` _(**required**, BlobPart)_: content of the file. Can be a string, or see [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob) for accepted types.

**Returns:** a Promise that resolves to true

### requestUrlParams

Get or update URL parameters.

**Arguments:**

- `params` _(object | null, default undefined)_:
  - If `undefined`, returns current URL parameters without making changes
  - If an object, key/value pairs to use to update the URL parameters. Setting a value to `null` will remove that parameter.
  - If `null`, removes all URL parameters

**Returns:** a Promise that resolves to an object containing the URL parameters after making any updates in `params`.

Note: URL parameters that begin with an underscore (e.g. `_app`) are reserved for Magic Sandbox use. These parameters cannot be modified by Apps.

### requestSandbox

A convenience function to call other Sandbox functions.

**Arguments:**

- `request` _(**required**, string)_: the Sandbox function to call. 'app' calls requestApp, 'function' calls requestFunction, 'putData' calls requestPutData, etc.
- `args` _(any)_: the arguments to pass to the Sandbox function

**Returns:** a Promise that resolves to the result from the Sandbox function

## Error Handling

If a Sandbox function throws an error, it will have the following properties:

- `name` (string): "RequestSandboxError"
- `message` (string): a message describing the error
- `data?` (object): an optional object containing additional error data
  - `minCost?` (number): provided if calling requestApp or requestFunction with a maxCost that is less than the App or Function's minCost

# Assistants

**Note:** you don't need to know all these details to create a Magic App or Function (though you may find it helpful context). This section is aimed at those who want to develop their own Assistant. See [magicsandbox.Assistant](todo) for an example Assistant implementation.

Assistants are simply Magic Apps that are executed in a Sandbox immediately when the user loads the page. Like any other Magic App, the Sandbox restrictions apply, but Sandbox functions like requestApp are available. The key difference though is that Magic Sandbox always approve Sandbox requests made by the Assistant. This gives Assistants enormous power, which is why it's so critical that users trust their Assistant.

There are no hard restrictions on what exactly an Assistant does, but Assistants should typically do at least two things:

1. Create a UI to accept user input and handle user input by executing other Magic Apps. To execute Magic Apps safely, the Assistant needs to create its own child Sandbox.
2. Handle requests from Magic Apps executing in the child Sandbox.

The rest of this section assumes you're following this basic pattern. We'll use the following terminology:

- Magic Sandbox: the top level webpage that the user loads in their browser. The parent of the Assistant Sandbox.
- Assistant Sandbox: the Sandbox iframe that the Assistant runs in. The parent of the App Sandbox.
- App Sandbox: the Sandbox iframe that Magic Functions run in.

A typical series of interactions between the three looks like this:

1. Magic Sandbox creates Assistant Sandbox and executes the Assistant
2. Assistant Sandbox creates UI and App Sandbox
3. Assistant Sandbox handles user input and determines Magic App to call
4. Assistant Sandbox calls `requestApp`
5. Magic Sandbox responds with the App returned by `requestApp`
6. Assistant Sandbox executes the App in the App Sandbox
7. App Sandbox calls a Sandbox function, e.g. `requestFetch`
8. Assistant Sandbox approves the request or asks the user for confirmation
9. Assistant Sandbox forwards the request to Magic Sandbox
10. Magic Sandbox responds with the result of the Sandbox function
11. Assistant Sandbox forwards the response to the App Sandbox

## Handling User Input and Executing Magic Functions

Magic Sandbox does not provide any UI beyond the navigation bar at the top of the page, so it's up to the Assistant to create a UI that can accept user input, parse, and handle user input. Features like `!magic` and other bangs are implemented by magicsandbox.Assistant, not by Magic Sandbox.

Let's say your Assistant has handled some user input and determined a Magic App to call. The Assistant must create a child App Sandbox to execute the Magic App safely. The [Sandbox](todo) component provides some helpers to make this easier, or you can create an iframe yourself with src set to 'frame.html'.

The 'frame.html' file loads [frame.js](todo), which sets up a listener in the App Sandbox. The listener enables the Assistant to control the App Sandbox by listening for an object with specific keys and taking action based on those keys:

- `script`: App Sandbox will execute the script
- `style`: App Sandbox will append the style to the document's head
- `html`: App Sandbox will append the html to the document's body
- `args`: App Sandbox will save the object to the global `args` variable

todo url params

todo reload

todo expectations on magic. what context assistant is expected to have vs. what app provides

todo initialized with userBalance and userBalanceRemainingDays

todo providing app for data functions. when assistants use them, they must provide options.app

## Handling Sandbox Requests

When the App Sandbox calls a Sandbox function like requestFetch, it uses postMessage to send a message to its parent, the Assistant Sandbox, that looks like this:

```javascript
{
  id: number,
  msg: {
    request: 'fetch',
    data: { resource, options },
  },
}
```

The App Sandbox then listens for a response from the Assistant Sandbox including the same id. So an Assistant needs to:

1. Listen for messages from the App Sandbox
2. Approve the request, deny it, or ask the user for confirmation
3. Forward the request to its parent, Magic Sandbox
4. Forward the response from Magic Sandbox to the App Sandbox

```javascript
async function handleRequest(event) {
  // 1. listen for messages
  if (event.source !== appSandbox.contentWindow) return;
  if (!(event.data.id && event.data.msg?.request)) return;
  const { id, msg } = event.data;
  const { request, data } = msg;
  // 2. approve/deny/ask for confirmation. a proper implementation should batch requests when asking for user confirmation
  const confirmed = await handleConfirm(request, data);
  let response;
  if (!confirmed) {
    response = { error: "User denied the request" };
  } else {
    delete data.options?.backup; //don't allow apps to access backup storage
    if (request === "function") {
      data.options.app = currentApp; //identify the app that called requestFunction
    }
    // 3. forward the request
    response = await requestSandbox(request, data);
  }
  // 4. forward the response
  event.source.postMessage({ id, response }, "*");
}

window.addEventListener("message", handleRequest);
```

todo update with proper error handling

### Providing App to requestFunction calls

Assistants are responsible for identifying the App that called requestFunction. Assistants should pass an additional `app` option to requestFunction and prevent Apps from setting this option without user approval.

### Guidelines for Approving Sandbox Requests

Assistants should consider the following risks when approving Sandbox requests:

#### Financial Risk

**Relevant Sandbox functions: requestApp, requestFunction**

Assistants should track the cost incurred by requestApp and requestFunction over time and prompt users for approval when exceeding reasonable thresholds.

todo budget

#### Publishing Risk

**Relevant Sandbox functions: requestPublish**

Publishing Magic Apps and Functions is potentially dangerous. A malicious App could publish a broken or malicious new version of an App or Function, or deprecate an App or Function against the author's will. Assistants should always ask for user approval when requestPublish is called.

#### Privacy Risk

**Relevant Sandbox functions: requestGetData, requestGetAllData, requestGetAllKeysData**

Assistants should ask for user approval before allowing cross-author reads.

Currently, there are ways for Apps to access the network without using a Sandbox function, so Assistants should assume that Apps can exfiltrate any data they can access. Assistants should therefore block reads (e.g. requestGetData) as needed rather than attempting to block exfiltration (e.g. requestFetch).

#### Data Loss Risk

**Relevant Sandbox functions: requestPutData, requestDeleteData**

Assistants should ask for user approval before allowing cross-author writes.

Like any other Magic App, Assistants can use the data Sandbox functions to store data. Assistants however can supply a `backup` option to the data Sandbox functions to access a separate storage location with a much higher limit of 1 GB. This backup storage is isolated from the Assistant's main storage and is not backed up in the cloud or synced to other devices. Assistants can backup data to protect against data loss risk:

```javascript
//take backup of all of author.App's data
requestPutData(
  "author.App", //key
  await requestGetAllData({ app: "author.App" }), //val
  { app: "magicsandbox.Assistant", evictionPolicy: "fifo", backup: true }, //options
);

//retrieve backup
requestGetData("author.App", { app: "magicsandbox.Assistant", backup: true });
```

Assistants should not allow Apps access to this backup storage.

#### Download Risk

**Relevant Sandbox functions: requestDownload**

Assistants should prompt the user for approval when the App Sandbox attempts to download a file.

#### Rate Limiting

**Relevant Sandbox functions: requestApp, requestFunction, requestFetch, requestOpenUrl, requestPublish**

Assistants should provide rate limiting to network requests to prevent abuse.

trust? track denials in addition to thumbs down

todo handling url params

# Advanced Topics

## Limits

- 10 MB of storage per Magic Function
- 1 GB of storage per Assistant
- 10 seconds runtime per request

etc

## Streaming JSON

When streaming over a network, the client may not receive chunks that correspond to your writes; your writes may be combined or split across multiple chunks. This will cause issues if streaming with `decode` set to 'json':

```javascript
//on your server
res.write(JSON.stringify({ msg: "hello" }));
res.end(JSON.stringify({ msg: " world!" }));

//in Sandbox
for await (const chunk of result) {
  console.log(chunk);
}
//could print:
//'{"msg":"hello"}{"msg":" world!"}'
```

In this example, the server makes two writes, but they were combined into a single chunk over the network, so the chunks are no longer valid JSON.

The Sandbox can reconstruct your writes and properly parse JSON if you prefix each chunk with its length. You can do this by:

1. Including an `x-length-prefix` header in your response
2. Prefixing each chunk of your response with its 4-byte length (big-endian uint32)

Rather than implement this yourself, you can use the [JavaScript](todo) or [Python](todo) helpers and do something like:

```javascript
import { createLengthPrefixTransform } from "@magicsandbox.ai/streaming";
import { pipeline } from "stream/promises";
// ...
const source = somehowGetReadable(); //your readable stream
res.setHeader("x-length-prefix", "true"); //your response writable stream
await pipeline(source, createLengthPrefixTransform(), res);
```

```python
from magicsandbox import length_prefix_transform
from fastapi.responses import StreamingResponse
# ...
source = somehow_get_async_iterable() #your async iterable
return StreamingResponse(length_prefix_transform(source), headers={'x-length-prefix': 'true'})
```

Consult your specific server framework's documentation for details.

## Command Object

Usually Function results are intended for the user, but there are scenarios where you want to instruct the Magic Sandbox server to do something:

- [Charge the caller a variable cost](#variable-costs)

You do this using a command object, which is an object with two keys: `result` and `__command`. `result` will be sent to the user, while `__command` is interpreted by the server.

```typescript
type CommandObject = {
  result?: any; //will be sent to the user
  __command: {
    //interpreted by the server
    finalCost;
  };
};
```

You have to signal to the server that your response is a command object, which you can do by including an `x-command-object` header in your response. The server will attempt to parse the entire response as a command object.

The command object cannot exceed 100KB. If you have a large result you want to send to the user, consider streaming it instead. You can stream a result that includes a command object by:

1. Including an `x-length-prefix` header in your response
2. Prefixing each chunk of your response with its 4-byte length (big-endian uint32)
3. Except for the final chunk, which must be prefixed with the special 4-byte sequence [0xFF, 0xFF, 0xFF, 0xFF] (four 255 bytes). The server will attempt to parse the final chunk as a command object.

Rather than implement this yourself, you can use the [JavaScript](todo) or [Python](todo) helpers and do something like:

```javascript
import { createLengthPrefixTransform } from "@magicsandbox.ai/streaming";
import { pipeline } from "stream/promises";
// ...
const source = somehowGetReadable(); //your readable stream
res.setHeader("x-length-prefix", "true"); //your response writable stream
await pipeline(
  source,
  createLengthPrefixTransform({ finalObject: true }), //prefix final chunk with 0xFFFFFFFF
  res,
);
```

```python
from magicsandbox import length_prefix_transform
from fastapi.responses import StreamingResponse
# ...
source = somehow_get_async_iterable() #your async iterable
return StreamingResponse(
  length_prefix_transform(source, final_object=True), #prefix final chunk with 0xFFFFFFFF
  headers={'x-length-prefix': 'true'}
);
```

## Variable Costs

Magic Sandbox enables Functions to charge variable costs:

1. When a Function is published, it specifies a minCost, the minimum cost the publisher will accept.
2. When a Function is called, the caller specifies maxCost, the maximum cost they're willing to pay.
   - Magic Sandbox ensures that maxCost is greater than or equal to the Function's minCost.
3. When the Function executes, it can specify finalCost, the actual cost the user will be charged.
   - Magic Sandbox ensures finalCost is between $0.001 and maxCost.
   - If finalCost is not specified, it defaults to minCost.
   - requestApp does not support variable costs and always charges minCost.

Variable costs are implemented using a [Command Object](todo). Here's an example:

```javascript
function main(args, options) {
  const length = Math.min(args.input.length, options.maxCost / 0.001);
  return {
    result: args.input.slice(0, length).toUpperCase(),
    __command: {
      finalCost: length * 0.001,
    },
  };
}
```

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

### Public Metadata

todo add details on publishing full list to S3 periodically

todo `private` does not appear here

### Subscribing to Updates

If you set `subscribeToUpdates` to true, your endpoint will receive updates when users publish or update Apps or Functions. This enables you to create metaFunctions like [magicsandbox.findApp](todo), which takes user input and finds an App that best matches it.

- The request is a POST to `endpoint/update`, so if your endpoint is `https://example.com/my-function`, you'll receive updates at `https://example.com/my-function/update`.
- Includes headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <hashedKey>`, see [endpoint](todo).
- Includes a `Metadata` body

todo app.messageHandler

## Questions or Feedback

For additional questions or feedback, please [create an issue](https://github.com/magicsandbox-ai/magicsandbox/issues/new?template=Blank+issue). We'd love to hear from you!
