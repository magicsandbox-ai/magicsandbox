/* global requestSandbox */

import { validateAndDefaultRequest } from 'shared/utils.js';

export default async function requestHandler({
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
    if (appObjRef.current.cacheRequests !== false && request === 'app') {
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
      request === 'function'
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
        'putData',
        'deleteData',
        'getData',
        'getAllData',
        'getAllKeysData',
      ].includes(request)
    ) {
      let app = data.app.split('@')[0];
      app = app.split('.')[1]; //todo allow author in advanced options
      if (appObjRef.current?.name === app) {
        //todo document shortcomings of this approach: does not check size, eviction policy, assistant may reject writes, etc.
        //todo should even do this?
        if (request === 'putData') {
          requestDataRef.current[data.key] = data.value;
          response = true;
        } else if (request === 'deleteData') {
          delete requestDataRef.current[data.key];
          response = true;
        } else if (request === 'getData') {
          response = requestDataRef.current[data.key];
        } else if (request === 'getAllData') {
          response = requestDataRef.current;
        } else if (request === 'getAllKeysData') {
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
    if (request === 'app') {
      requestAppRef.current = { cacheKey, response, error };
    } else if (request === 'function') {
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
