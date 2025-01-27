import { promises as fsPromises } from "fs";
import JSON5 from "json5";
import path from "path";

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

async function writeMagicJson(magicPath, magicObj) {
  const magicJsonPath = await getMagicJsonPath(magicPath);
  let stringify = JSON5.stringify;
  if (magicJsonPath.endsWith(".json")) {
    stringify = JSON.stringify;
  }
  await fsPromises.writeFile(
    magicJsonPath,
    stringify(magicObj, undefined, 2),
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

export { readMagicJson, writeMagicJson, fileExists, readFile };
