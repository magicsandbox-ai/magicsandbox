import { dev } from "@magicsandbox.ai/dev";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

async function cli(appPath, debug, port, url) {
  let server;
  try {
    //Run `npx playwright install` to ensure the Playwright browsers used for testing are installed and updated
    execSync("npx playwright install");
    //Start the `@magicsandbox.ai/dev` development server for MyApp
    server = await dev({
      magicPath: appPath,
      debug,
      port,
      url,
      autoOpen: false,
    });
    //If you haven't already, create a playwright.config.js file in MyApp/tests for you
    const playwrightConfigPath = path.join(
      appPath,
      "tests",
      "playwright.config.js",
    );
    try {
      fs.accessSync(playwrightConfigPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        const defaultPlaywrightConfig = `import { defineConfig } from '@playwright/test';
export default defineConfig({});
`;
        fs.writeFileSync(playwrightConfigPath, defaultPlaywrightConfig, "utf8");
      } else {
        throw error;
      }
    }
    //Run the tests in MyApp/tests
    execSync("npx playwright test", {
      cwd: path.join(appPath, "tests"),
      env: {
        ...process.env,
        MAGICSANDBOX_TEST_URL: server.url,
      },
    });
  } catch (error) {
    console.error("Failed to run tests:", error);
    process.exit(1);
  } finally {
    server?.close?.();
  }
}

export { cli };
