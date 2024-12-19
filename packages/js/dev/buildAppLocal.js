import { promises as fsPromises } from "fs";
import * as esbuild from "esbuild";
import { readMagicJson, fileExists, readFile } from "./utils.js";
import { buildApp } from "./buildApp.js";
import path from "path";
import { processTailwind } from "@magicsandbox.ai/esbuild-plugin-tailwind";
import { pathToFileURL } from "url";
import { exec as _exec } from "child_process";
import { promisify } from "util";

const exec = promisify(_exec);

async function buildAppLocal({ magicPath, debug, context, prod }) {
  const magicObj = await readMagicJson(magicPath);
  if (magicObj.dependencies) {
    await installDependencies(magicPath, magicObj);
  }
  const _fileExists = (filename) => fileExists(magicPath, filename);
  const _readFile = (filename) => readFile(magicPath, filename);
  if (await _fileExists("tailwind.config.js")) {
    const tailwindConfig = await import(
      pathToFileURL(path.join(magicPath, "tailwind.config.js"))
    );
    magicObj.tailwindConfig = tailwindConfig.default;
  }
  magicObj.tailwindConfig.content = magicObj.tailwindConfig.content || [
    `${magicPath.replace(/\\/g, "/")}/**/*.js`,
  ];
  const { appObj, context: newContext } = await buildApp({
    appObj: magicObj,
    esbuild: esbuild,
    esbuildOptions: {
      absWorkingDir: magicPath,
      minify: prod,
      sourcemap: !prod,
      metafile: debug,
    },
    onComplete: debug ? (result) => saveMetafile(result, magicPath) : undefined,
    context,
    fileExists: _fileExists,
    readFile: _readFile,
    processTailwind,
  });
  if (debug) {
    await fsPromises.writeFile(
      path.join(magicPath, "_debug_app.json"),
      JSON.stringify(appObj, undefined, 2),
      "utf8",
    );
  }
  return { appObj, context: newContext };
}

async function installDependencies(magicPath, magicObj) {
  if (fileExists(magicPath, "package.json")) {
    throw new Error(
      "Cannot include dependencies in magic.json if package.json exists",
    );
  }
  await fsPromises.writeFile(
    path.join(magicPath, "package.json"),
    JSON.stringify(magicObj, undefined, 2), //todo don't use all the keys?
    "utf8",
  );
  await exec("npm install", { cwd: magicPath });
  await fsPromises.unlink(path.join(magicPath, "package.json"));
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
