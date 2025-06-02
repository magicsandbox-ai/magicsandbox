import { z } from "zod";
import { isEqual } from "es-toolkit";
import { maybeReadFile } from "./utils.js";

const defaultEsbuildOptions = {
  globalName: "app",
  bundle: true,
  minify: true,
  loader: { ".js": "jsx" },
  target: "es2020",
};

const preBuildSchema = z
  .object({
    name: z.string(),
    version: z.string(),
    scriptFile: z.string().default("index.js"),
    htmlFile: z.string().default("index.html"),
    styleFile: z.string().default("index.css"),
  })
  .passthrough();

const postBuildSchema = z
  .object({
    html: z.string().default('<div id="root"></div>'),
  })
  .passthrough();

async function buildApp({
  appObj,
  esbuild,
  esbuildOptions,
  onComplete = async () => {},
  context,
  //caller must provide these as buildApp can be run in browser
  fileExists,
  readFile,
  processTailwind,
  now,
  log = () => {},
}) {
  now = now || new Date();
  appObj = await getDefaults({ appObj, esbuildOptions, fileExists });
  let result;
  if (!appObj.script && (await fileExists(appObj.scriptFile))) {
    const options = {
      ...appObj.esbuildOptions,
      entryPoints: [appObj.scriptFile],
      write: false,
    };
    ({ result, context } = await rebuild(esbuild, context, options));
    await onComplete(result, appObj);
    appObj.script = result.outputFiles[0].text;
  }
  log(new Date() - now, "esbuild");
  await maybeReadFile(appObj, "html", fileExists, readFile);
  const { processedCss } = await runProcessTailwind(
    appObj,
    fileExists,
    readFile,
    processTailwind,
  );
  log(new Date() - now, "processTailwind");
  appObj.style = processedCss;
  appObj = postBuildSchema.parse(appObj);
  return { appObj, context, result };
}

async function getDefaults({ appObj, esbuildOptions, fileExists }) {
  appObj.esbuildOptions = {
    ...defaultEsbuildOptions,
    ...esbuildOptions,
    ...appObj.esbuildOptions,
  };
  if (!appObj.scriptFile) {
    const scriptFilesExists = await Promise.all([
      fileExists("index.js"),
      fileExists("index.jsx"),
      fileExists("index.ts"),
      fileExists("index.tsx"),
    ]);
    const scriptFiles = [
      "index.js",
      "index.jsx",
      "index.ts",
      "index.tsx",
    ].filter((file, index) => scriptFilesExists[index]);
    if (scriptFiles.length > 0) {
      if (scriptFiles.length > 1) {
        console.warn(
          `Found multiple default scriptFiles: ${scriptFiles.join(", ")}`,
        );
        console.warn(`Using: ${scriptFiles[0]}`);
      }
      appObj.scriptFile = scriptFiles[0];
    }
  }
  appObj = preBuildSchema.parse(appObj);
  return appObj;
}

async function rebuild(esbuild, context, options) {
  let result;
  if (context && isEqual(options, context.previousOptions)) {
    result = await context.rebuild();
  } else {
    const previousOptions = { ...options }; //guard against keys being removed during build
    context = await esbuild.context(options);
    context.previousOptions = previousOptions;
    result = await context.rebuild();
  }
  return { result, context };
}

async function runProcessTailwind(
  appObj,
  fileExists,
  readFile,
  processTailwind,
) {
  await maybeReadFile(appObj, "style", fileExists, readFile);
  let style = appObj.style;
  if (style === undefined) {
    style = "@tailwind base; @tailwind components; @tailwind utilities;";
  }
  if (style.includes("@tailwind")) {
    return await processTailwind(appObj.tailwindConfig || {}, style);
  } else {
    return { processedCss: style }; //processedCss is a misnomer in this case
  }
}

export { buildApp, getDefaults, runProcessTailwind };
