import "dotenv/config";
import { readMagicJson, fileExists, readFile } from "./utils.js";
import { handleShared } from "./buildApp.js";
import { buildAppLocal } from "./buildAppLocal.js";

async function publish(magicPath, debug) {
  try {
    if (!process.env.MAGICSANDBOX_API_KEY) {
      throw new Error("Environment variable MAGICSANDBOX_API_KEY is not set");
    }
    let magicObj = await readMagicJson(magicPath);
    let kind;
    if (magicObj.endpoint) {
      kind = "function";
      await handleShared(
        magicObj, //mutates magicObj
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
    console.log("Published successfully");
  } catch (error) {
    console.error("Failed to publish:", error.message);
    process.exit(1);
  }
}

export { publish };
