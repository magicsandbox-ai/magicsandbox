interface DeferredPromise<T> extends Promise<T> {
  resolved: boolean;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

function createDeferredPromise<T>(
  timeout?: number,
  timeoutMessage?: string,
): DeferredPromise<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  }) as DeferredPromise<T>;
  promise.resolved = false;

  let wrappedResolve: (value: T) => void;
  if (timeout) {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage || "Deferred promise timed out"));
    }, timeout);

    wrappedResolve = (value: T) => {
      clearTimeout(timeoutId);
      resolve(value);
      promise.resolved = true;
    };
  } else {
    wrappedResolve = (value: T) => {
      resolve(value);
      promise.resolved = true;
    };
  }

  promise.resolve = wrappedResolve;
  promise.reject = reject;

  return promise;
}

export { createDeferredPromise, type DeferredPromise };
export { validateAndDefaultRequest } from "./requestHandler.js";
