import dotenv from "dotenv";
import { promises as fsPromises } from "fs";
import JSON5 from "json5";
import { handleShared } from "./buildApp.js";
import { buildAppLocal, fileExists, readFile } from "./buildAppLocal.js";
import path from "path";

async function getApiKey(magicPath) {
  const envPaths = [];
  let currentPath = magicPath;
  while (currentPath !== path.dirname(currentPath)) {
    // Stop at root directory
    const envPath = path.join(currentPath, ".env");
    try {
      await fsPromises.access(envPath);
      envPaths.push(envPath);
    } catch {
      // no .env file found, keep going
    }
    currentPath = path.dirname(currentPath);
  }
  dotenv.config({ path: envPaths }); //first value wins
}

async function publish(magicPath, debug) {
  try {
    await getApiKey(magicPath);
    if (!process.env.MAGICSANDBOX_API_KEY) {
      throw new Error("Environment variable MAGICSANDBOX_API_KEY is not set");
    }
    let magicObj, kind;
    try {
      ({ appObj: magicObj } = await buildAppLocal(`apps/${folder}`, debug));
      kind = "app";
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      const filePath = `functions/${folder}/magic.json5`;
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
  } catch (error) {
    console.error("Failed to publish:", error.message);
    process.exit(1);
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

export { publish };
