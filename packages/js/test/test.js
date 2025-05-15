import "dotenv/config";
import { test as base, expect } from "@playwright/test";

const test = base.extend({
  appOptions: [{}, { option: true }],
  app: async ({ page, appOptions }, use) => {
    const { autoInit = true, autoConfirm = false } = appOptions;
    if (!process.env.MAGICSANDBOX_API_KEY) {
      throw new Error("MAGICSANDBOX_API_KEY environment variable is required");
    }
    let url = process.env.MAGICSANDBOX_TEST_URL;
    if (!autoInit) {
      url += "&devLocalAutoInit=false";
    }
    const baseUrl = url.split("?")[0].toLowerCase();
    await page.route(
      (routeUrl) => {
        return routeUrl.toString().toLowerCase().startsWith(baseUrl);
      },
      async (route, request) => {
        if (request.url() == baseUrl + "/metadata") {
          route.fulfill({ json: {} }); //so app doesn't attempt to sync data
        } else if (request.url().startsWith(baseUrl + "/push-data")) {
          route.fulfill({ json: {} }); //otherwise auth error
        } else {
          const headers = await request.allHeaders();
          route.continue({
            headers: {
              ...headers,
              Authorization: `Bearer ${process.env.MAGICSANDBOX_API_KEY}`,
            },
          });
        }
      },
    );
    await page.goto(url);
    await waitForFrame(page);
    const assistant = page.mainFrame().childFrames()[0];
    await waitForFrame(assistant);
    if (autoConfirm) {
      await assistant.evaluate(() => {
        window._AUTO_CONFIRM = true;
      });
    }
    const devLocal = assistant.childFrames()[0];
    await waitForFrame(devLocal);
    const app = devLocal.childFrames()[0];
    await waitForMessage(app);
    await use(app);
  },
});

export { test };

async function waitForFrame(page) {
  await expect(page.locator("iframe")).toHaveCount(1, { timeout: 10000 });
}

async function waitForMessage(app) {
  const promise = createDeferredPromise();
  const page = app.page();
  await page.exposeFunction("_handleCustomEvent", async (eventDataKeys) => {
    if (eventDataKeys.includes("script")) {
      promise.resolve();
    }
  });
  await app.evaluate(() => {
    window.addEventListener("message", (event) => {
      /*
      while trying to fix an unrelated bug, I had a theory that event was not being passed correctly to handleCustomEvent because it was too large
      this github issue also hints that large payloads could be an issue: https://github.com/microsoft/playwright/issues/28146
      the bug was unrelated, but it's probably still better to pass only eventDataKeys into handleCustomEvent rather than the whole event
      */
      const eventDataKeys = Object.keys(event.data || {});
      window._handleCustomEvent(eventDataKeys);
    });
  });
  return await promise;
}

function createDeferredPromise() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.resolve = resolve;
  promise.reject = reject;
  return promise;
}
