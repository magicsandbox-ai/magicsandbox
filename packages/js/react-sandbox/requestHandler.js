const minimumMinCost = 0.001;
const maximumMaxCost = 1;

/**
 * Validates the request and adds default values by mutating `data`
 */
function validateAndDefaultRequest(request, data, assistant, app) {
  const requiredKeys = {
    app: ["app"],
    function: ["fn", "args"],
    putData: ["key", "val"],
    deleteData: ["key"],
    getData: ["key"],
    getAllData: [],
    getAllKeysData: [],
    fetch: ["resource"],
    openUrl: ["url"],
    publish: ["magicObj"],
    download: ["filename", "content"],
    urlParams: [],
  };
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
  // todo more type checking - like making sure urlParams params is an object
  if (request === "app") {
    data.options = {
      maxCost: data.options?.maxCost || minimumMinCost,
      includeMetadata: data.options?.includeMetadata || [],
    };
    if (data.options.maxCost > maximumMaxCost) {
      return `maxCost must be less than or equal to ${maximumMaxCost}`;
    }
  } else if (request === "function") {
    data.options = {
      maxCost: data.options?.maxCost || minimumMinCost,
      stream: data.options?.stream || false,
      includeMetadata: data.options?.includeMetadata || [],
      includeUserInfo: data.options?.includeUserInfo || [],
    };
    if (data.options.maxCost > maximumMaxCost) {
      return `maxCost must be less than or equal to ${maximumMaxCost}`;
    }
    if (assistant && app) {
      data.options.app = app; //assistant provides app calling requestFunction
    }
  } else if (
    assistant &&
    [
      "putData",
      "deleteData",
      "getData",
      "getAllData",
      "getAllKeysData",
    ].includes(request)
  ) {
    data.options = {
      ...data.options,
      app: data.options?.app || app, //assistant provides app calling requestData
    };
    delete data.options.backup; //assistants should not allow apps to access backup storage
  } else if (request === "fetch") {
    data.options = {
      ...data.options,
      responseType: data.options?.responseType || "auto",
    };
  } else if (assistant && request === "urlParams" && data.params) {
    data.params = Object.fromEntries(
      Object.entries(data.params).filter(([key]) => !key.startsWith("_")), //params that start with _ are reserved
    );
  }
  if (
    assistant &&
    (request === "app" || request === "function") &&
    !data.options.includeMetadata.includes("finalCost")
  ) {
    //assistants need to know the final cost
    data.options.includeMetadata.push("finalCost");
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
          response = sandboxRef.current.streamData(response);
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
      if (!data.options.app && appObjRef.current.author) {
        //in case we don't find data with e.g. getData, set options.app for the call to requestSandbox
        data.options.app = `${appObjRef.current.author}.${appObjRef.current.name}`;
      }
      const app =
        data.options.app ||
        `${appObjRef.current.author}.${appObjRef.current.name}`;
      if (request === "putData") {
        if (data.val === null) {
          sandboxRef.current.postMessage(sandboxId, {
            id,
            error: { message: "Cannot put null data" },
          });
          return;
        }
        //todo enforce size limit? use msgpack? support evictionPolicy?
        requestDataRef.current[app] = requestDataRef.current[app] || {};
        requestDataRef.current[app][data.key] = structuredClone(data.val);
        sandboxRef.current.postMessage(sandboxId, { id, response: true });
        return;
      } else if (request === "deleteData") {
        delete requestDataRef.current[app]?.[data.key];
        sandboxRef.current.postMessage(sandboxId, { id, response: true });
        return;
      } else if (request === "getData") {
        response = requestDataRef.current[app]?.[data.key];
        if (response !== undefined) {
          sandboxRef.current.postMessage(sandboxId, { id, response });
          return;
        }
        //otherwise, fall through to requestSandbox
      } else if (request === "getAllData") {
        response = requestDataRef.current[app];
        if (response !== undefined) {
          sandboxRef.current.postMessage(sandboxId, { id, response });
          return;
        }
      } else if (request === "getAllKeysData") {
        response = requestDataRef.current[app];
        if (response !== undefined) {
          sandboxRef.current.postMessage(sandboxId, {
            id,
            response: Object.keys(response),
          });
          return;
        }
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
      response = sandboxRef.current.streamData(response);
    }
    sandboxRef.current.postMessage(sandboxId, { id, response, error });
  } catch (error) {
    console.error(error);
  }
}

export { validateAndDefaultRequest, requestHandler };
