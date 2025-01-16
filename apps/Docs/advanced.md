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

- [Charge the caller a variable cost](todo)

You do this using a command object, which is an object with two keys: `result` and `__command`. `result` will be sent to the user, while `__command` is interpreted by the server.

```typescript
type CommandObject = {
  result: any; //will be sent to the user
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

## Public App and Function Metadata

todo add details on publishing full list to S3 periodically

todo `private` does not appear here

### Subscribing to Updates

If you set `subscribeToUpdates` to true, your endpoint will receive updates when users publish or update Apps or Functions. This enables you to create metaFunctions like [magicsandbox.findApp](todo), which takes user input and finds an App that best matches it.

- The request is a POST to `endpoint/update`, so if your endpoint is `https://example.com/my-function`, you'll receive updates at `https://example.com/my-function/update`.
- Includes headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <hashedKey>`, see [endpoint](todo).
- Includes a `MagicMetadata` body

```typescript
type MagicMetadata = {
  id: string; //author.name@version
  author: string;
  name: string;
  version: string;
  kind: "app" | "function";
  description: string;
  documentation: string;
  type: string;
  minCost: number;
  status: "active" | "deprecated" | "inactive";
  decode: "json" | "string" | "bytes";
  stream: boolean;
};
```

## Questions or Feedback

For additional questions or feedback, please create an issue on [GitHub](todo) or reach out to help@magicsandbox.com or feedback@magicsandbox.com. We'd love to hear from you!
