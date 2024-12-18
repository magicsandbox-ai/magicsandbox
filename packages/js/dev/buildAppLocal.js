import "dotenv/config";
import { promises as fsPromises } from "fs";
import * as esbuild from "esbuild";
import JSON5 from "json5";
import { buildApp } from "./buildApp.js";
import path from "path";
import { processTailwind } from "../../shared/tailwindPlugin.js";
import { pathToFileURL } from "url";

async function buildAppLocal(folder, debug, context) {
  let filePath = `${folder}/magic.json5`;
  let dir = path.dirname(path.resolve(filePath));
  const magicObj = await readJson(filePath);
  const _fileExists = (filename) => fileExists(dir, filename);
  const _readFile = (filename) => readFile(dir, filename);
  if (await _fileExists("tailwind.config.js")) {
    const tailwindConfig = await import(
      pathToFileURL(path.join(dir, "tailwind.config.js"))
    );
    magicObj.tailwindConfig = tailwindConfig.default;
  }
  magicObj.tailwindConfig.content = magicObj.tailwindConfig.content || [
    `${dir.replace(/\\/g, "/")}/**/*.js`,
  ];
  const { appObj, context: newContext } = await buildApp({
    appObj: magicObj,
    esbuild: esbuild,
    esbuildOptions: {
      absWorkingDir: dir,
      minify: process.env.NODE_ENV === "production",
      sourcemap: !(process.env.NODE_ENV === "production"),
      metafile: debug,
    },
    onComplete: debug ? saveMetafile : undefined,
    context,
    fileExists: _fileExists,
    readFile: _readFile,
    processTailwind,
  });
  if (debug) {
    await fsPromises.writeFile(
      "__publishDebug__.json",
      JSON.stringify(appObj),
      "utf8",
    );
    // console.log(
    //   JSON.stringify(
    //     functionObj,
    //     (_, val) => {
    //       return typeof val === 'string' ? val.slice(0, 100) : val;
    //     },
    //     2
    //   )
    // );
  }
  return { appObj, context: newContext };
}

async function readJson(filePath) {
  const data = await fsPromises.readFile(filePath, "utf8");
  return JSON5.parse(data, (_, value) => {
    if (typeof value === "string") {
      return value.replace(/process\.env\.(\w+)/g, (_, p1) => process.env[p1]);
    }
    return value;
  });
}

async function fileExists(dir, filename) {
  try {
    await fsPromises.access(path.join(dir, filename));
    return true;
  } catch {
    return false;
  }
}
async function readFile(dir, filename) {
  return await fsPromises.readFile(path.join(dir, filename), "utf-8");
}

async function saveMetafile(result) {
  if (result.metafile) {
    await fsPromises.writeFile(
      "metafile.json",
      JSON.stringify(result.metafile),
      "utf8",
    );
    // await fsPromises.writeFile(
    //   'metafile.js',
    //   result.outputFiles[0].text,
    //   'utf8'
    // );
    await fsPromises.writeFile(
      "metafile.txt",
      await esbuild.analyzeMetafile(result.metafile, { verbose: true }),
      "utf8",
    );
  }
}

export { buildAppLocal, fileExists, readFile };
