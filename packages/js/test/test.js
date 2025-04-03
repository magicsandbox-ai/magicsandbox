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

    await assistant
      .getByRole("button", { name: "Open the app magicsandbox.DevLocal" })
      .click();
    const devLocal = assistant.childFrames()[0];
    await waitForFrame(devLocal);
    const app = devLocal.childFrames()[0];
    await waitForCustomEvent(app.page(), "message");
    await use(app);
  },
});

export { test };

async function waitForFrame(page) {
  await expect(page.locator("iframe")).toHaveCount(1, { timeout: 10000 });
}

async function waitForCustomEvent(page, event) {
  const promise = createDeferredPromise();
  await page.exposeFunction("_handleCustomEvent", async (event) => {
    promise.resolve(event);
    await page.evaluate(() => {
      window.removeEventListener(event, window._handleCustomEvent);
    });
  });
  await page.evaluate((event) => {
    window.addEventListener(event, window._handleCustomEvent);
  }, event);
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
