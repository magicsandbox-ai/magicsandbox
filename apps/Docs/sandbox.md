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

**Returns:** a Promise that resolves to an App:

```typescript
type App = {
  style?: string;
  html?: string;
  script?: string;
  metadata: AppMetadata;
};

type AppMetadata = {
  app: string;
  finalCost: number;
  status: "active" | "deprecated";
  userBalance: number;
  userBalanceRemainingDays: number;
};
```

### requestFunction

Executes a Magic Function and returns the result.

**Arguments:**

- `fn` _(**required**, string)_: Magic Function to call, either in the form author.name@version or just author.name, in which case the latest version is used.
- `args` _(**required**, any)_: Arguments to pass to the called Function.
- `options` _(object)_:
  - `maxCost` _(number, default 0.001)_: Maximum cost you're willing to pay for the Function call, which should be at least the Function's `minCost`. Cannot exceed $1.00.
  - `stream` _(boolean, default false)_: Whether to stream the result.
  - `includeUserInfo` _(object)_: An object with keys indicating additional user info to pass to the Function:
    - `userId` _(boolean, default false)_: Whether to include the user ID.

**Returns:** a Promise that includes the Function result and metadata. The type depends on the `stream` option.

- `stream: false`: `Promise<{result: any, metadata: FunctionMetadata}>`. This is the default behavior. Resolves to an object with keys `result` and `metadata`.
- `stream: true`: `Promise<AsyncIterable<{result: any} | {metadata: FunctionMetadata}>>`. Resolves to an AsyncIterable, which can be consumed using a `for await...of` loop. Each streamed chunk is an object with either a `result` key or a `metadata` key, not both. `result` is populated on all chunks except the final chunk, while `metadata` is populated on only the final chunk.

```typescript
type FunctionMetadata = {
  fn: string;
  finalCost: number;
  status: "active" | "deprecated";
  userBalance: number;
  userBalanceRemainingDays: number;
};
```

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
