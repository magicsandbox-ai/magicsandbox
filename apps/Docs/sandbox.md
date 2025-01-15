# Sandbox

As described on the [About](todo) page, to protect the user, Magic Apps execute in a Sandbox. The Sandbox is implemented as an iframe with a sandbox attribute. The Sandbox environment is restrictive but provides a number of global functions that enable you to bypass these restrictions. Each of these Sandbox functions has a name that begins with `request`, reflecting the fact that they may fail if not approved. The Assistant is responsible for approving Sandbox requests, either automatically if determined to be safe or by asking for user confirmation.

The Sandbox has the following high level restrictions and associated Sandbox functions:

- Limited network access. APIs like `fetch` don't work, and you can't use traditional links.
  - Use `requestApp` and `requestFunction` to call other Magic Apps and Magic Functions
  - Use `requestFetch` to fetch data from another website
  - Use `requestOpenUrl` to open a link in a new tab
  - Use `requestPublish` to publish a Magic Function
  - Note: currently there are limited ways that your App can access the network without using a Sandbox function. You should not rely on these, as they may be blocked at any time without warning.
- No direct access to web storage APIs.
  - Use `requestPutData`, `requestDeleteData`, `requestGetData`, `requestGetAllData`, and `requestGetAllKeysData` to store and retrieve data
- Permissions to use certain browser features like creating popups or accessing the camera may be blocked. We expect the allowed permissions to evolve over time. Please share any [feedback](todo) you have.

todo error handling - RequestSandboxError

## Calling Magic Apps and Functions

### requestApp(app, options?) => Promise<{style?: string, html?: string, script?: string, metadata: {app: string, finalCost: number}}>

Retrieves a Magic App's `style`, `html`, and `script`.

**Arguments:**

- `app` (**required**) (string): Magic App to call, either in the form author.name@version or just author.name, in which case the latest version is used.
- `options` (object):
  - `maxCost` (number) (default 0.001): Maximum cost you're willing to pay for the App call, which should be at least the App's minCost. Magic Apps can't charge variable costs, so you'll be charged the App's minCost.

**Returns:** a Promise that resolves to an App:

```typescript
type App = {
  style?: string;
  html?: string;
  script?: string;
  metadata: { app: string; finalCost: number; status: "active" | "deprecated" };
};
```

### requestFunction(fn, args, options?) => Promise

Executes a Magic Function and returns the result.

**Arguments:**

- `fn` (**required**) (string): Magic Function to call, either in the form author.name@version or just author.name, in which case the latest version is used.
- `args` (**required**) (any): Arguments to pass to the called Function.
- `options` (object):
  - `maxCost` (number) (default 0.001): Maximum cost you're willing to pay for the Function call, which should be at least the Function's minCost. Refer to [variable costs](todo) for more details.
  - `stream` (boolean) (default false): Whether to stream the result.

**Returns:** a Promise that includes the result from the Function and metadata about the Function call. The type depends on the `stream` option.

- `stream: false`: `Promise<{result: any, metadata: Metadata}>`. This is the default behavior. Resolves to an object with keys `result` and `metadata`.
- `stream: true`: `Promise<AsyncIterable<{result: any} | {metadata: Metadata}>>`. Resolves to an AsyncIterable, which can be consumed using a `for await...of` loop. Each streamed chunk is an object with either a `result` key or a `metadata` key, not both. `result` is populated on all chunks except the final chunk, while `metadata` is populated on only the final chunk. See [magicsandbox.Chat](todo) for an example.

Metadata:

- fn: string, resolved with version
- finalCost: number
- status: "active" | "deprecated"

From your endpoint, you can call requestFunction by:

- Making a POST request to magicsandbox.ai/endpoint-request-function
- Authenticating using an [API key](todo)
- Including in the body:
  - `fn`, `args`, `options`: the arguments to requestFunction

## Storing and Retrieving Data

Magic Sandbox provides Sandbox functions for storing and retrieving key/value pairs. Each Magic App has its own isolated storage, ensuring that keys used by one App don't interfere with keys used by another.

All of the data Sandbox functions require an `app` argument, which specifies which App to use for storage, in the form of 'author.app'. Most Apps should just use their own name as the `app` argument. Put and delete requests that specify an `app` that has not been called with requestApp will cause an error.

Each Magic App can store up to 10 MB of data. There is no concept of App version used for storage, so author1.app1@1.0.0 and author1.app1@1.0.1 store data in the same location. If you need separate storage for App versions, you'll have to use the key/value pairs yourself to accomplish that.

### requestPutData (app: string, key: string, val: any, options?) => true

Store a key/value pair using app's storage. val will be serialized using JSON.stringify.

**Options:**

- `evictionPolicy` (string): Controls behavior if the put would cause the app to exceed its storage limit. Supported values:
  - `undefined` (default): Does not evict any key/value pairs and returns a 'Database size limit exceeded' error.
  - `'fifo'`: Evict the oldest key/value pairs as needed to make room for the new key/value pair.

### requestDeleteData (app: string, key: string) => true

Delete a key/value pair using app's storage.

### requestGetData (app: string, key: string) => val: any

Retrieve a key/value pair using app's storage.

### requestGetAllData (app: string) => { [key: string]: any }

Retrieve all key/value pairs using app's storage.

### requestGetAllKeysData (app: string) => string[]

Retrieve all keys using app's storage.

## Other Sandbox Functions

### requestFetch (resource, options?) => Promise<SerializedResponse>

Make a fetch request.

**Arguments:** see the [fetch docs](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

Only the following fetch `options` are supported: `body`, `headers`, `integrity`, `method`, `priority`, `redirect`.

Additionally, `options` accepts an additional `responseType` option used to parse the response body:

- `auto` (default): Parse as json or string according to the Content-Type header. If the Content-Type header is not present, returns an arrayBuffer.
- `json`: Parse the response as JSON
- `string`: Decode the response as a UTF-8 string
- `bytes`: Return the raw bytes as an ArrayBuffer

**Returns:** a Promise that resolves to a SerializedResponse, since the Response object itself cannot be serialized and passed into the Sandbox.

```typescript
type SerializedResponse = {
  body: any; // parsed according to responseType
  status: number;
  headers: { [headerName: string]: string };
};
```

### requestOpenUrl (url) => Promise<true>

Open a URL in a new tab. Traditional links don't work in the Sandbox, so use `requestOpenUrl` instead.

Don't do this:

```html
<a href="https://example.com">Click me</a>
```

Do this instead:

```html
<a onclick="requestOpenUrl('https://example.com')">Click me</a>
```

**Arguments**:

- `url` (**required**) (string): URL to open

**Returns:** a Promise that resolves to true

### requestPublish (magicObj) => Promise<true>

Publish a Magic Function or Magic App.

todo

### requestDownload ({ filename: string, url: string, content: BlobPart }) => Promise<true>

Download a file.

**Arguments:** an object with the following keys:

- `filename` (**required**) (string): filename to use for the downloaded file
- `url` (string): URL to download
- `content` (BlobPart): content of the file. Can be a string, or see [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob) for accepted types.

Either `url` or `content` must be provided.

**Returns:** a Promise that resolves to true

### requestUrlParams() => Promise<{ [key: string]: string }>

Retrieve parameters from the URL used to load the page. For example, if the page was loaded using `https://magicsandbox.ai/?input=hello`, then requestUrlParams() would return `{ input: 'hello' }`.

### requestSandbox (request: string, args: any) => Promise<any>

A convenience function to call other Sandbox functions.

**Arguments:** an object with the following keys:

- `request` (**required**) (string): the Sandbox function to call. 'app' calls requestApp, 'function' calls requestFunction, 'putData' calls requestPutData, etc.
- `args` (any): the arguments to pass to the Sandbox function

**Returns:** the result from the Sandbox function
