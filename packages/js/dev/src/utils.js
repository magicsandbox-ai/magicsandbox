import * as fleece from "golden-fleece";

/**
 * If key does not exist and keyFile exists, set key to keyFile contents
 */
async function maybeReadFile(appObj, key, fileExists, readFile) {
  if (!appObj[key] && (await fileExists(appObj[`${key}File`]))) {
    appObj[key] = await readFile(appObj[`${key}File`]);
  }
}

function updateMagicJson(magicJsonString, updater) {
  const magicJsonObj = fleece.evaluate(magicJsonString);
  updater(magicJsonObj);
  return fleece.patch(magicJsonString, magicJsonObj);
}

export { maybeReadFile, updateMagicJson };
