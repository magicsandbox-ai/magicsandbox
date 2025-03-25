import "dotenv/config";
import { test as base, expect } from "@playwright/test";

async function waitForFrame(page) {
  await expect(page.locator("iframe")).toHaveCount(1, { timeout: 10000 });
}

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
    const devLocal = assistant.childFrames()[0];
    const buildCompletePromise = devLocal
      .page()
      .waitForEvent("requestfinished", (request) => {
        return request
          .url()
          .startsWith(process.env.MAGICSANDBOX_DEV_SERVER_URL);
      });
    await assistant
      .getByRole("button", { name: "Open the app magicsandbox.DevLocal" })
      .click();
    await buildCompletePromise;
    //request is finished, but the messages have to be passed through all the frames
    //so wait an extra second
    //todo this is not ideal - maybe listen for an event in the devlocal or app frame?
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const app = devLocal.childFrames()[0];
    await use(app);
  },
});

export { test };
