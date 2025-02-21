function createDeferredPromise(timeout, timeoutMessage) {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.resolved = false;
  let wrappedResolve;
  if (timeout) {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage || "Deferred promise timed out"));
    }, timeout);
    wrappedResolve = (value) => {
      clearTimeout(timeoutId);
      resolve(value);
      promise.resolved = true;
    };
  } else {
    wrappedResolve = (value) => {
      resolve(value);
      promise.resolved = true;
    };
  }
  promise.resolve = wrappedResolve;
  promise.reject = reject;
  return promise;
}

export { createDeferredPromise };
