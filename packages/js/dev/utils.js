import "dotenv/config";
import { promises as fsPromises } from "fs";
import JSON5 from "json5";
import path from "path";

async function readMagicJson(magicPath) {
  let data;
  try {
    data = await fsPromises.readFile(
      path.join(magicPath, "magic.json5"),
      "utf8",
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    data = await fsPromises.readFile(
      path.join(magicPath, "magic.json"),
      "utf8",
    );
  }
  return JSON5.parse(data, (_, value) => {
    if (typeof value === "string") {
      return value.replace(/process\.env\.(\w+)/g, (_, p1) => process.env[p1]); //todo kill this?
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

export { readMagicJson, fileExists, readFile };
