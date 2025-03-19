#!/usr/bin/env node

import { init, dev, publish, install } from "../src/index.js";
import { Command, Option } from "commander";
import path from "path";

/*
todos:
- make path optional?
*/

const program = new Command();

program
  .command("init")
  .description("Set up a new Magic Sandbox App or Function")
  .argument(
    "<path>",
    "Path to App/Function directory (relative to --dir if specified)",
  )
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .option("--function", "Create a Function instead of an App")
  .action(async (appPath, options) => {
    await init(handlePath(appPath, options.dir), options.function);
  });

const urlOption = new Option("--url <url>")
  .default("https://magicsandbox.ai")
  .hideHelp();

program
  .command("dev")
  .description("Start dev server for a Magic Sandbox App")
  .argument("<path>", "Path to App directory (relative to --dir if specified)")
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .option("--debug", "Debug build")
  .option("-p, --port <number>", "Port to run dev server on", "3000")
  .addOption(urlOption)
  .action((appPath, options) => {
    dev({
      magicPath: handlePath(appPath, options.dir),
      debug: options.debug,
      port: parseInt(options.port),
      url: options.url,
    });
  });

program
  .command("publish")
  .description("Publish a Magic Sandbox App or Function")
  .argument(
    "<path>",
    "Path to App/Function directory (relative to --dir if specified)",
  )
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .option("--debug", "Debug build")
  .addOption(urlOption)
  .action(async (appPath, options) => {
    await publish(handlePath(appPath, options.dir), options.debug, options.url);
  });

program
  .command("install")
  .description("Install dependencies for a Magic Sandbox App or Function")
  .argument(
    "<path>",
    "Path to App/Function directory (relative to --dir if specified)",
  )
  .argument("<packages...>", "Packages to install")
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .action(async (appPath, packages, options) => {
    await install(handlePath(appPath, options.dir), packages);
  });

program
  .command("docs")
  .description("Build a Magic Sandbox App from a documentation Markdown file")
  .argument("<path>", "Path to App directory (relative to --dir if specified)")
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .action(async (appPath, options) => {
    try {
      const buildDocs = await import("@magicsandbox.ai/build-docs");
      await buildDocs.buildDocs(handlePath(appPath, options.dir));
    } catch (error) {
      if (error.code === "ERR_MODULE_NOT_FOUND") {
        console.error(
          "To use the docs command, install @magicsandbox.ai/build-docs:",
        );
        console.error(`npm install "@magicsandbox.ai/build-docs"`);
        process.exit(1);
      }
      throw error;
    }
  });

program
  .command("test")
  .description(
    "Run Playwright tests for a Magic Sandbox App. Additional arguments are passed to the Playwright CLI",
  )
  .argument("<path>", "Path to App directory (relative to --dir if specified)")
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .option("--debug", "Debug build")
  .option("-p, --port <number>", "Port to run dev server on", "3000")
  .addOption(urlOption)
  .allowUnknownOption(true)
  .action(async (appPath, options, command) => {
    try {
      const test = await import("@magicsandbox.ai/test");
      await test.cli(
        handlePath(appPath, options.dir),
        options.debug,
        options.port,
        options.url,
        command.args.slice(1), //first arg is path, rest get passed to playwright
      );
    } catch (error) {
      if (error.code === "ERR_MODULE_NOT_FOUND") {
        console.error(
          "To use the test command, install @magicsandbox.ai/test:",
        );
        console.error(`npm install "@magicsandbox.ai/test"`);
        process.exit(1);
      }
      throw error;
    }
  });

program.parse();

function handlePath(appPath, dir) {
  const absoluteDir = path.resolve(dir);
  const fullPath = path.join(absoluteDir, appPath);
  return fullPath;
}
