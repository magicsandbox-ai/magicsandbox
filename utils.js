/* global Intl */

import { config } from './config.js';

function createDeferredPromise(timeout, timeoutMessage) {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  if (timeout) {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage || 'Deferred promise timed out'));
    }, timeout);
    const wrappedResolve = (value) => {
      clearTimeout(timeoutId);
      resolve(value);
    };
    promise.resolve = wrappedResolve;
  } else {
    promise.resolve = resolve;
  }
  promise.reject = reject;
  return promise;
}

const dollarFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAsDollars(amount) {
  return dollarFormatter.format(amount);
}

/**
 * Validates the request and adds default values by mutating `data`
 */
function validateAndDefaultRequest(request, data, assistant) {
  const requiredKeys = {
    app: ['app'],
    function: ['fn', 'args'],
    putData: ['app', 'key', 'val'],
    deleteData: ['app', 'key'],
    getData: ['app', 'key'],
    getAllData: ['app'],
    getAllKeysData: ['app'],
    fetch: ['resource'],
    openUrl: ['url'],
    publish: ['magicObj'],
    download: ['options'],
    urlParams: [],
  };
  if (assistant) {
    delete requiredKeys.urlParams; //assistants should not allow access to urlParams
    delete data?.options?.backup; //assistants should not allow access to backup storage
  }
  if (!(request in requiredKeys)) {
    return 'Invalid request';
  }
  data = data || {};
  const missingKeys = requiredKeys[request].filter(
    (key) => data[key] === undefined
  );
  if (missingKeys.length > 0) {
    return `Missing required keys: ${missingKeys.join(', ')}`;
  }
  if (request === 'app') {
    data.options = {
      maxCost: data.options?.maxCost || config.minimumMinCost,
    };
  } else if (request === 'function') {
    data.options = {
      maxCost: data.options?.maxCost || config.minimumMinCost,
      stream: data.options?.stream || false,
      includeUserInfo: data.options?.includeUserInfo || false,
    };
  } else if (request === 'fetch') {
    data.options = {
      ...data.options,
      responseType: data.options?.responseType || 'auto',
    };
  } else if (request === 'download') {
    if (
      !(data.options.filename && (data.options.url || data.options.content))
    ) {
      return 'filename and either url or content are required';
    }
  }
}

export { createDeferredPromise, formatAsDollars, validateAndDefaultRequest };
