const minimumMinCost = 0.001;
const maximumMaxCost = 1;

/**
 * Validates the request and adds default values by mutating `data`
 */
function validateAndDefaultRequest(request, data, options = {}) {
  const { assistant, app, includeMetadata } = options;
  const requiredKeys = {
    app: ["app"],
    function: ["fn", "args"],
    metadata: ["identifier", "includeMetadata"],
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
  } else if (request === "metadata") {
    data.options = {
      kind: data.options?.kind,
      includePrivate: data.options?.includePrivate || false,
    };
    if (assistant) {
      data.options.includePrivate = false; //assistants should not allow apps to set includePrivate to true
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
  if (includeMetadata && (request === "app" || request === "function")) {
    for (const key of includeMetadata) {
      if (!data.options.includeMetadata.includes(key)) {
        data.options.includeMetadata.push(key);
      }
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
    const validation = validateAndDefaultRequest(request, data);
    let response;
    if (validation) {
      sandboxRef.current.postMessage(sandboxId, {
        id,
        error: { message: validation },
      });
      return;
    }
    let cacheKey;
    if (appObjRef.current.cacheRequests && request === "app") {
      cacheKey = data.app;
      if (cacheKey === requestAppRef.current.cacheKey) {
        sandboxRef.current.postMessage(sandboxId, {
          id,
          response: requestAppRef.current.response,
          error: requestAppRef.current.error,
        });
        return;
      }
    } else if (appObjRef.current.cacheRequests && request === "function") {
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
      if (!data.options?.app && appObjRef.current.author) {
        data.options = {
          ...data.options,
          app: `${appObjRef.current.author}.${appObjRef.current.name}`,
        };
      }
      const app = data.options?.app;
      if (requestDataRef.current[app] === undefined) {
        //initialize requestDataRef[app]
        try {
          if (app) {
            const allData = await requestSandbox("getAllData", {
              options: { app },
            });
            requestDataRef.current[app] = allData || {};
          } else {
            requestDataRef.current[app] = {};
          }
        } catch (e) {
          console.warn(`Failed to initialize data for ${app}:`, e);
          requestDataRef.current[app] = {};
        }
      }
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
        sandboxRef.current.postMessage(sandboxId, { id, response });
        return;
      } else if (request === "getAllData") {
        response = requestDataRef.current[app] || {};
        sandboxRef.current.postMessage(sandboxId, { id, response });
        return;
      } else if (request === "getAllKeysData") {
        response = Object.keys(requestDataRef.current[app] || {});
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
      response = sandboxRef.current.streamData(response);
    }
    sandboxRef.current.postMessage(sandboxId, { id, response, error });
  } catch (error) {
    console.error(error);
  }
}

export { validateAndDefaultRequest, requestHandler };
