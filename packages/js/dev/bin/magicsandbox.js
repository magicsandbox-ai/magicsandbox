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

const urlOption = new Option("--url <url>")
  .default("https://magicsandbox.ai")
  .hideHelp();

program
  .command("dev")
  .description("Start dev server for a Magic App")
  .argument("<path>", "Path to App directory (relative to --dir if specified)")
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .option("--debug", "Debug build")
  .option("-p, --port <number>", "Port to run dev server on", "3000")
  .addOption(urlOption)
  .action((appPath, options) => {
    dev(
      handlePath(appPath, options.dir),
      options.debug,
      parseInt(options.port),
      options.url,
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
  .addOption(urlOption)
  .action(async (appPath, options) => {
    await publish(handlePath(appPath, options.dir), options.debug, options.url);
  });

program
  .command("install")
  .description("Install dependencies for a Magic App or Function")
  .argument(
    "<path>",
    "Path to App/Function directory (relative to --dir if specified)",
  )
  .argument("<packages...>", "Packages to install")
  .option("-d, --dir <directory>", "Base directory", process.cwd())
  .action(async (appPath, packages, options) => {
    await install(handlePath(appPath, options.dir), packages);
  });

program.parse();

function handlePath(appPath, dir) {
  const absoluteDir = path.resolve(dir);
  const fullPath = path.join(absoluteDir, appPath);
  return fullPath;
}
