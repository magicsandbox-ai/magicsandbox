import "dotenv/config";
import { test as base, expect } from "@playwright/test";

async function waitForFrame(page) {
  await expect(page.locator("iframe")).toHaveCount(1);
}

const test = base.extend({
  appOptions: [{ autoInit: true }, { option: true }],
  app: async ({ page, appOptions }, use) => {
    if (!process.env.MAGICSANDBOX_API_KEY) {
      throw new Error("MAGICSANDBOX_API_KEY environment variable is required");
    }
    let url = process.env.MAGICSANDBOX_TEST_URL;
    if (!appOptions.autoInit) {
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
    const assistant = page.frame("sandbox");
    await waitForFrame(assistant);
    const devLocal = assistant.childFrames()[0];
    const responsePromise = devLocal
      .page()
      .waitForResponse(process.env.MAGICSANDBOX_DEV_SERVER_URL);
    await assistant.getByRole("button", { name: "Approve" }).click(); //approve opening of DevLocal
    await responsePromise;
    const app = devLocal.childFrames()[0];
    await use(app);
  },
});

export { test };
