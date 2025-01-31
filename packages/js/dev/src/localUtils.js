import { promises as fsPromises } from "fs";
import JSON5 from "json5";
import path from "path";
import { updateMagicJson as _updateMagicJson } from "./utils.js";

async function getMagicJsonPath(magicPath) {
  if (await fileExists(magicPath, "magic.json5")) {
    return path.join(magicPath, "magic.json5");
  }
  return path.join(magicPath, "magic.json");
}

async function readMagicJson(magicPath) {
  const magicJsonPath = await getMagicJsonPath(magicPath);
  const data = await fsPromises.readFile(magicJsonPath, "utf8");
  return JSON5.parse(data);
}

async function updateMagicJson(magicPath, updater) {
  const magicJsonPath = await getMagicJsonPath(magicPath);
  const magicJsonString = await fsPromises.readFile(magicJsonPath, "utf8");
  await fsPromises.writeFile(
    magicJsonPath,
    _updateMagicJson(magicJsonString, updater),
    "utf8",
  );
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

export { readMagicJson, updateMagicJson, fileExists, readFile };
