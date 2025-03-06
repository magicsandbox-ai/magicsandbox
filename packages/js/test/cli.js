import { dev } from "@magicsandbox.ai/dev";
import { execSync, exec } from "child_process";
import path from "path";
import fs from "fs";

async function cli(appPath, debug, port, url, playwrightArgs) {
  let server;
  try {
    const testsPath = path.join(appPath, "tests");
    if (!fs.existsSync(testsPath)) {
      throw new Error(`${testsPath} directory not found`);
    }
    //Run `npx playwright install` to ensure the Playwright browsers used for testing are installed and updated
    execSync("npx playwright install", { cwd: testsPath, stdio: "inherit" });
    //Start the `@magicsandbox.ai/dev` development server for MyApp
    server = await dev({
      magicPath: appPath,
      debug,
      port,
      url,
      autoOpen: false,
    });
    //If you haven't already, create a playwright.config.js file in MyApp/tests for you
    const playwrightConfigPath = path.join(testsPath, "playwright.config.js");
    if (!fs.existsSync(playwrightConfigPath)) {
      const defaultPlaywrightConfig = `import { defineConfig } from '@playwright/test';
export default defineConfig({
  timeout: 120000,
});
`;
      fs.writeFileSync(playwrightConfigPath, defaultPlaywrightConfig, "utf8");
    }
    //Run the tests in MyApp/tests
    await new Promise((resolve, reject) => {
      const testProcess = exec(
        `npx playwright test ${playwrightArgs.join(" ")}`,
        {
          cwd: testsPath,
          env: {
            ...process.env,
            MAGICSANDBOX_TEST_URL: server.url,
            MAGICSANDBOX_DEV_SERVER_URL: server.devServerUrl,
          },
        },
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        },
      );
      testProcess.stdout.pipe(process.stdout);
      testProcess.stderr.pipe(process.stderr);
    });
  } catch (error) {
    console.error("Failed to run tests:", error);
    process.exit(1);
  } finally {
    server?.close?.();
  }
}

export { cli };
