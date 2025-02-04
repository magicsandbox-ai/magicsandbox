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

todo updateUrl in requestApp

todo reload

todo expectations on magic. what context assistant is expected to have vs. what app provides

todo initialized with userBalance and userBalanceRemainingDays

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
  "magicsandbox.Assistant", //app
  "author.App", //key
  await requestGetAllData("author.App"), //val
  { evictionPolicy: "fifo", backup: true }, //options
);

//retrieve backup
requestGetData("magicsandbox.Assistant", "author.App", { backup: true });
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
