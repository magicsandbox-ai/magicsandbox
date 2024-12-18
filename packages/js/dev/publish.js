import "dotenv/config";
import { promises as fsPromises } from "fs";
import JSON5 from "json5";
import { handleShared } from "./buildApp.js";
import { buildAppLocal, fileExists, readFile } from "./buildAppLocal.js";
import path from "path";

//npm run publish Assistant Develop

await Promise.all(process.argv.slice(2).map((folder) => publish(folder, true)));

async function publish(folder, debug) {
  let magicObj, kind;
  try {
    ({ appObj: magicObj } = await buildAppLocal(
      `src/magics/apps/${folder}`,
      debug,
    ));
    kind = "app";
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    const filePath = `src/magics/functions/${folder}/magic.json5`;
    const dir = path.dirname(path.resolve(filePath));
    try {
      magicObj = await readJson(filePath);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`magic.json5 not found in ${folder}`);
      }
      throw error;
    }
    await handleShared(
      magicObj,
      (filename) => fileExists(dir, filename),
      (filename) => readFile(dir, filename),
    );
    kind = "function";
  }
  const response = await fetch(
    encodeURI(
      `${process.env.MAIN_URL}/publish?kind=${kind}&name=${magicObj.name}&version=${magicObj.version}`,
    ),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MAGICSANDBOX_API_KEY}`,
      },
      body: JSON.stringify(magicObj),
    },
  );
  if (!response.ok) {
    let errorMessage;
    try {
      ({ errorMessage } = await response.json());
    } catch {
      errorMessage = "Unexpected response from server";
    }
    throw new Error(`Error: ${response.status} ${errorMessage}`);
  }
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

process.exit(0); //need this I think because of esbuild context staying alive
