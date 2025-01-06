//todo kill this file

function createDeferredPromise(timeout, timeoutMessage) {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  if (timeout) {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage || "Deferred promise timed out"));
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

const dollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAsDollars(amount) {
  return dollarFormatter.format(amount);
}

export { createDeferredPromise, formatAsDollars };
