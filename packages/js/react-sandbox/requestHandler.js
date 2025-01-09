/* global requestSandbox */

const minimumMinCost = 0.001;

/**
 * Validates the request and adds default values by mutating `data`
 */
function validateAndDefaultRequest(request, data, assistant) {
  const requiredKeys = {
    app: ["app"],
    function: ["fn", "args"],
    putData: ["app", "key", "val"],
    deleteData: ["app", "key"],
    getData: ["app", "key"],
    getAllData: ["app"],
    getAllKeysData: ["app"],
    fetch: ["resource"],
    openUrl: ["url"],
    publish: ["magicObj"],
    download: ["options"],
    urlParams: [],
  };
  if (assistant) {
    delete data?.options?.backup; //assistants should not allow access to backup storage
  }
  if (!(request in requiredKeys)) {
    return "Invalid request";
  }
  data = data || {};
  const missingKeys = requiredKeys[request].filter(
    (key) => data[key] === undefined,
  );
  if (missingKeys.length > 0) {
    return `Missing required keys: ${missingKeys.join(", ")}`;
  }
  if (request === "app") {
    data.options = {
      maxCost: data.options?.maxCost || minimumMinCost,
    };
  } else if (request === "function") {
    data.options = {
      maxCost: data.options?.maxCost || minimumMinCost,
      stream: data.options?.stream || false,
      includeUserInfo: data.options?.includeUserInfo || false,
    };
  } else if (request === "fetch") {
    data.options = {
      ...data.options,
      responseType: data.options?.responseType || "auto",
    };
  } else if (request === "download") {
    if (
      !(data.options.filename && (data.options.url || data.options.content))
    ) {
      return "filename and either url or content are required";
    }
  }
}

async function requestHandler({
  event,
  sandboxRef,
  appObjRef,
  requestAppRef,
  requestFunctionRef,
  requestDataRef,
}) {
  try {
    if (!(event.data.id && event.data.msg?.request)) return;
    const sandboxId = sandboxRef.current.getSandboxId();
    const { id, msg } = event.data;
    const { request, data } = msg;
    const validation = validateAndDefaultRequest(request, data, true);
    let response;
    if (validation) {
      sandboxRef.current.postMessage(sandboxId, {
        id,
        error: { message: validation },
      });
      return;
    }
    let cacheKey;
    if (appObjRef.current.cacheRequests !== false && request === "app") {
      cacheKey = data.app;
      if (cacheKey === requestAppRef.current.cacheKey) {
        sandboxRef.current.postMessage(sandboxId, {
          id,
          response: requestAppRef.current.response,
          error: requestAppRef.current.error,
        });
        return;
      }
    } else if (
      appObjRef.current.cacheRequests !== false &&
      request === "function"
    ) {
      cacheKey = JSON.stringify({
        function: data.function,
        args: data.args,
        options: data.options,
      });
      if (cacheKey === requestFunctionRef.current.cacheKey) {
        response = requestFunctionRef.current.response;
        if (response?.[Symbol.asyncIterator]) {
          response = await sandboxRef.current.streamData(response);
        }
        sandboxRef.current.postMessage(sandboxId, {
          id,
          response,
          error: requestFunctionRef.current.error,
        });
        return;
      }
    } else if (
      [
        "putData",
        "deleteData",
        "getData",
        "getAllData",
        "getAllKeysData",
      ].includes(request)
    ) {
      let app = data.app.split("@")[0];
      app = app.split(".")[1]; //todo allow author in advanced options
      if (appObjRef.current?.name === app) {
        //todo document shortcomings of this approach: does not check size, eviction policy, assistant may reject writes, etc.
        //todo should even do this?
        if (request === "putData") {
          requestDataRef.current[data.key] = data.value;
          response = true;
        } else if (request === "deleteData") {
          delete requestDataRef.current[data.key];
          response = true;
        } else if (request === "getData") {
          response = requestDataRef.current[data.key];
        } else if (request === "getAllData") {
          response = requestDataRef.current;
        } else if (request === "getAllKeysData") {
          response = Object.keys(requestDataRef.current);
        }
        sandboxRef.current.postMessage(sandboxId, { id, response });
        return;
      }
    }
    let error;
    try {
      response = await requestSandbox(request, data);
    } catch (e) {
      error = { message: e.message, data: e.data };
    }
    if (request === "app") {
      requestAppRef.current = { cacheKey, response, error };
    } else if (request === "function") {
      requestFunctionRef.current = { cacheKey, response, error };
    }
    if (response?.[Symbol.asyncIterator]) {
      response = await sandboxRef.current.streamData(response);
    }
    sandboxRef.current.postMessage(sandboxId, { id, response, error });
  } catch (error) {
    console.error(error);
  }
}

export { validateAndDefaultRequest, requestHandler };
