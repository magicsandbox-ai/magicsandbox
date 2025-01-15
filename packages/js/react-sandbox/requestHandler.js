/* global requestSandbox, requestApp */

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
    } else if (request === "putData" || request === "deleteData") {
      if (!appObjRef.current?.writeData?.enabled) {
        //don't write, store in requestDataRef
        //todo serialize, disallow null, what else to match behavior?
        if (request === "putData") {
          requestDataRef.current.db[data.app] =
            requestDataRef.current.db[data.app] || {};
          requestDataRef.current.db[data.app][data.key] = data.val;
        } else if (request === "deleteData") {
          delete requestDataRef.current.db[data.app]?.[data.key];
        }
        sandboxRef.current.postMessage(sandboxId, { id, response: true });
        return;
      } else if (!requestDataRef.current.requestedApp) {
        //requestApp must be called before we can write to database
        try {
          await requestApp(data.app, {
            maxCost: appObjRef.current?.writeData?.requestAppMaxCost,
          });
        } catch (error) {
          console.error("requestApp error", error);
          //probably requestSandbox will fail but perhaps author has called requestApp themselves, so don't throw
        } finally {
          requestDataRef.current.requestedApp = true;
        }
        //fall through to requestSandbox
      }
    } else if (
      request === "getData" ||
      request === "getAllData" ||
      request === "getAllKeysData"
    ) {
      //for reads, we return data in requestDataRef if found
      if (request === "getData") {
        response = requestDataRef.current.db[data.app]?.[data.key];
      } else if (request === "getAllData") {
        response = requestDataRef.current.db[data.app];
      } else if (request === "getAllKeysData") {
        response = requestDataRef.current.db[data.app];
        if (response !== undefined) {
          response = Object.keys(response);
        }
      }
      if (response !== undefined) {
        //found, return
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
