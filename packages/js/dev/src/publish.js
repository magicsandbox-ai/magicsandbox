import "dotenv/config";
import { readMagicJson, fileExists, readFile } from "./localUtils.js";
import { maybeReadFile } from "./utils.js";
import { buildAppLocal } from "./buildAppLocal.js";
import path from "path";
import fsPromises from "fs/promises";

async function publish(magicPath, debug, url) {
  try {
    if (!process.env.MAGICSANDBOX_API_KEY) {
      throw new Error("Environment variable MAGICSANDBOX_API_KEY is not set");
    }
    let magicObj = await readMagicJson(magicPath);
    let kind;
    if (magicObj.endpoint) {
      kind = "function";
      magicObj.documentationFile = magicObj.documentationFile || "README.md";
      await maybeReadFile(
        magicObj, //mutates magicObj
        "documentation",
        (filename) => fileExists(magicPath, filename),
        (filename) => readFile(magicPath, filename),
      );
    } else {
      kind = "app";
      ({ appObj: magicObj } = await buildAppLocal({
        magicPath,
        debug,
        prod: true,
      }));
    }
    if (debug) {
      await fsPromises.writeFile(
        path.join(magicPath, "_debug_magic.json"),
        JSON.stringify(magicObj, undefined, 2),
        "utf8",
      );
    }
    console.log("Publishing...");
    const response = await fetch(
      encodeURI(
        `${url}/publish?kind=${kind}&name=${magicObj.name}&version=${magicObj.version}`,
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
    console.log("Published successfully!");
    process.exit(0); //think this is needed because esbuild keeps the process alive
  } catch (error) {
    console.error("Failed to publish:", error);
    process.exit(1);
  }
}

export { publish };
