import { promises as fsPromises } from "fs";
import * as esbuild from "esbuild";
import { readMagicJson, fileExists, readFile } from "./localUtils.js";
import { buildApp } from "./buildApp.js";
import path from "path";
import { processTailwind } from "@magicsandbox.ai/esbuild-plugin-tailwind";
import { pathToFileURL } from "url";
import { isEqual } from "es-toolkit";
import { installDependencies } from "./install.js";

async function buildAppLocal({
  magicPath,
  debug,
  contextRef = { current: {} },
  prod,
}) {
  const now = new Date();
  let log = () => {};
  // if (debug) {
  //   log = console.log;
  // }
  const magicObj = await readMagicJson(magicPath);
  if (magicObj.update) {
    console.log("Build skipped when update is true");
    return { appObj: magicObj };
  }
  log(new Date() - now, "readMagicJson");
  if (
    magicObj.dependencies &&
    !isEqual(magicObj.dependencies, contextRef.current.dependencies)
  ) {
    console.log("Installing dependencies...");
    await installDependencies(magicPath, magicObj);
  }
  contextRef.current.dependencies = magicObj.dependencies;
  log(new Date() - now, "installDependencies");
  const _fileExists = (filename) => fileExists(magicPath, filename);
  const _readFile = (filename) => readFile(magicPath, filename);
  let tailwindPath;
  if (await _fileExists("tailwind.config.js")) {
    tailwindPath = "tailwind.config.js";
  } else if (await _fileExists("tailwind.config.mjs")) {
    tailwindPath = "tailwind.config.mjs";
  }
  if (tailwindPath) {
    const tailwindConfig = await import(
      pathToFileURL(path.join(magicPath, tailwindPath)) + `#${Date.now()}` //break the cache in case this has changed
    );
    magicObj.tailwindConfig = tailwindConfig.default;
  }
  magicObj.tailwindConfig = {
    content: magicObj.tailwindConfig?.content || [
      `${magicPath.replace(/\\/g, "/")}/**/*.{html,js,jsx,ts,tsx}`,
    ],
    ...magicObj.tailwindConfig,
  };
  if (magicObj.excludeContent) {
    magicObj.tailwindConfig.content = [
      ...magicObj.tailwindConfig.content,
      ...magicObj.excludeContent.map(
        (c) => `!${magicPath.replace(/\\/g, "/")}/${c}`,
      ),
    ];
  }
  if (
    !magicObj.tailwindConfig.content.some((c) => c?.includes("node_modules"))
  ) {
    magicObj.tailwindConfig.content.push("!**/node_modules/**");
  }
  log(new Date() - now, "tailwindConfig");
  console.log("Building app...");
  const { appObj, context } = await buildApp({
    appObj: magicObj,
    esbuild: esbuild,
    esbuildOptions: {
      absWorkingDir: magicPath,
      minify: prod,
      sourcemap: !prod,
      metafile: debug,
    },
    onComplete: debug ? (result) => saveMetafile(result, magicPath) : undefined,
    context: contextRef.current.context,
    fileExists: _fileExists,
    readFile: _readFile,
    processTailwind,
    now,
    log,
  });
  contextRef.current.context = context;
  log(new Date() - now, "buildApp");
  if (debug) {
    await fsPromises.writeFile(
      path.join(magicPath, "_debug_magic.json"),
      JSON.stringify(appObj, undefined, 2),
      "utf8",
    );
  }
  return { appObj };
}

async function saveMetafile(result, magicPath) {
  if (result.metafile) {
    await fsPromises.writeFile(
      path.join(magicPath, "_debug_metafile.json"),
      JSON.stringify(result.metafile),
      "utf8",
    );
    await fsPromises.writeFile(
      path.join(magicPath, "_debug_metafile.txt"),
      await esbuild.analyzeMetafile(result.metafile, { verbose: true }),
      "utf8",
    );
  }
}

export { buildAppLocal };
