import "dotenv/config";
import { test as base } from "@playwright/test";

const test = base.extend({
  appOptions: [{ autoInit: true }, { option: true }],
  app: async ({ page, appOptions }, use) => {
    let url = process.env.MAGICSANDBOX_TEST_URL;
    if (!appOptions.autoInit) {
      url += "&devLocalAutoInit=false";
    }
    await page.goto(url);
    await page.setExtraHTTPHeaders({
      Authorization: `Bearer ${process.env.MAGICSANDBOX_API_KEY}`,
    });
    const assistant = page.frame("sandbox");
    const devLocal = assistant.childFrames()[0];
    const app = devLocal.childFrames()[0];
    await use(app);
  },
});

export { test };
