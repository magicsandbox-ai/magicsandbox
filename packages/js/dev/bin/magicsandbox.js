#!/usr/bin/env node

import { init, dev, publish } from "../src/index.js";
import { Command } from "commander";
import path from "path";

const program = new Command();

program
  .command("init")
  .description("Set up a new Magic App or Function")
  .argument(
    "<path>",
    "Path to App/Function directory (relative to --dir if specified)",
  )
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .option("--function", "Create a Function instead of an App")
  .action(async (appPath, options) => {
    await init(handlePath(appPath, options.dir), options.function);
  });

program
  .command("dev")
  .description("Start dev server for a Magic App")
  .argument("<path>", "Path to App directory (relative to --dir if specified)")
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .option("-p, --port <number>", "Port to run dev server on", "3000")
  .option("--debug", "Debug build")
  .action((appPath, options) => {
    dev(
      handlePath(appPath, options.dir),
      parseInt(options.port),
      options.debug,
    );
  });

program
  .command("publish")
  .description("Publish a Magic App or Function")
  .argument(
    "<path>",
    "Path to App/Function directory (relative to --dir if specified)",
  )
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .option("--debug", "Debug build")
  .option("--url <url>", "URL to publish to", "https://magicsandbox.ai")
  .action(async (appPath, options) => {
    await publish(handlePath(appPath, options.dir), options.debug, options.url);
  });

program.parse();

function handlePath(appPath, dir) {
  const absoluteDir = path.resolve(dir);
  const fullPath = path.join(absoluteDir, appPath);
  return fullPath;
}
