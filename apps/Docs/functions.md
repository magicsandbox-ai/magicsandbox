# Magic Functions

Magic Functions are server-side functions that can be called by Magic Apps or other Magic Functions. Unlike Magic Apps, which run on the frontend (the user's browser), Magic Functions run on the backend.

Like Magic Apps, Magic Functions are also just JSON objects. See [shared keys](#shared-keys-between-magic-apps-and-magic-functions) for the keys you can include.

Magic Sandbox currently only supports Magic Functions that you host on your own server. `name`, `version`, and `endpoint` are required keys for Magic Functions.

## Magic Function keys

### endpoint

_(**required**, string)_

HTTPS URL that Magic Sandbox will call to execute your backend code:

- The request is a POST that will timeout after 60 seconds
- Includes headers:
  - `Content-Type: application/json`
  - If you have an API key, `Authorization: Bearer <hashedKey>`, where `<hashedKey>` is the SHA-256 hash of your API key encoded as a hexadecimal string. You can generate an API key [here](https://magicsandbox.ai/api-key). See below code snippets that generate `hashedKey`.
- Includes the body `{ fn, args, options, app }`, where:
  - `fn`, `args`, `options` were the arguments to [requestFunction](#requestFunction)
  - `app` is the name of the App that is calling the Function. This is provided by the user's Assistant and is not verified by Magic Sandbox.

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

### stream

_(boolean, default false)_

Whether your Function supports streaming.

Special care should be taken when streaming with decode set to 'json'. See [Streaming JSON](#streaming-json) for details.

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
