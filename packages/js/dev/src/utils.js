/**
 * If key does not exist and keyFile exists, set key to keyFile contents
 */
async function maybeReadFile(appObj, key, fileExists, readFile) {
  if (!appObj[key] && (await fileExists(appObj[`${key}File`]))) {
    appObj[key] = await readFile(appObj[`${key}File`]);
  }
}

export { maybeReadFile };
