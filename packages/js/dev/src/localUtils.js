import { promises as fsPromises } from "fs";
import JSON5 from "json5";
import path from "path";
import * as fleece from "golden-fleece";

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
  const str = await fsPromises.readFile(magicJsonPath, "utf8");
  const obj = fleece.evaluate(str);
  updater(obj);
  await fsPromises.writeFile(magicJsonPath, fleece.patch(str, obj), "utf8");
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
