import { dev, isRunning } from "@magicsandbox.ai/dev";
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
    //Start the `@magicsandbox.ai/dev` development server for MyApp if it's not already running
    let appUrl, devServerUrl;
    const response = await isRunning(appPath);
    if (response) {
      appUrl = response.appUrl;
      devServerUrl = response.devServerUrl;
      console.log(`Using existing dev server at ${devServerUrl}`);
    } else {
      server = await dev({
        magicPath: appPath,
        debug,
        port,
        url,
        autoOpen: false,
      });
      appUrl = server.appUrl;
      devServerUrl = server.devServerUrl;
    }
    //If you haven't already, create a playwright.config.js file in MyApp/tests for you
    const playwrightConfigPath = path.join(testsPath, "playwright.config.js");
    if (!fs.existsSync(playwrightConfigPath)) {
      const defaultPlaywrightConfig = `import { defineConfig } from '@playwright/test';
export default defineConfig({
  timeout: 60000,
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
            MAGICSANDBOX_TEST_URL: appUrl,
            MAGICSANDBOX_DEV_SERVER_URL: devServerUrl,
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
