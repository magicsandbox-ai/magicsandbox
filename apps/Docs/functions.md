# Magic Functions

Magic Functions are the backend equivalent to Magic Apps. Magic Apps can call Magics Functions, and Magic Functions can call other Magic Functions.

Like Magic Apps, Magic Functions are also just JSON objects. See [shared keys](#shared-keys-between-magic-apps-and-magic-functions) above for the keys you can include.

Magic Sandbox currently only supports Magic Functions that you host on your own server using `endpoint`. `name`, `version`, and `endpoint` are required keys for Magic Functions.

### endpoint (**required**) (string)

HTTPS URL that Magic Sandbox will call to execute your backend code:

- The request is a POST that will timeout after 60 seconds
- Includes headers:
  - `Content-Type: application/json`
  - If you have an API key, `Authorization: Bearer <hashedKey>`, where `<hashedKey>` is the SHA-256 hash of your API key encoded as a hexadecimal string. You can generate an API key [here](https://magicsandbox.ai/api-key). See below code snippets that generate `hashedKey`.
- Includes the body `{ fn, args, options, app }`, where:
  - `fn`, `args`, `options` were the arguments to [requestFunction](#requestFunction)
  - `app` is the name of the App that is calling the Function. Note: this is provided by the user's Assistant and is not verified by Magic Sandbox.

```javascript
const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");
```

```python
hashed_key = hashlib.sha256(api_key.encode()).hexdigest()
```

### documentation (string)

Documentation of how to use your Function.

### decode (string) (default 'json')

Specifies how to decode the response from your Function's endpoint. Supported values:

- `'json'` (default): Parse the response as JSON. If parsing fails, the response will be returned as a string.
- `'string'`: Decode the response as a UTF-8 string
- `'bytes'`: Return the raw bytes as an ArrayBuffer

### stream (boolean) (default false)

Whether your Function supports streaming.

Special care should be taken when streaming with decode set to 'json'. See [Streaming JSON](#streaming-json) for details.

### subscribeToUpdates (boolean) (default false)

Whether you want your endpoint to receive updates when users publish or update Apps or Functions. See [Subscribing to Updates](#subscribing-to-updates) for details.
