import { readMagicJson, writeMagicJson, fileExists } from "./localUtils.js";
import { execSync } from "child_process";
import path from "path";
import { promises as fsPromises } from "fs";

async function install(magicPath, packages) {
  const magicObj = await readMagicJson(magicPath);
  await installDependencies(magicPath, magicObj, packages);
  console.log("Installed successfully!");
}

async function installDependencies(magicPath, magicObj, packages) {
  if (await fileExists(magicPath, "package.json")) {
    throw new Error(
      "Cannot include dependencies in magic.json if package.json exists",
    );
  }
  await fsPromises.writeFile(
    path.join(magicPath, "package.json"),
    JSON.stringify(
      {
        ...magicObj,
        private: true, //prevent accidental publishing to npm
      },
      undefined,
      2,
    ), //todo don't use all the keys?
    "utf8",
  );
  let command = "npm install";
  if (packages) {
    command += ` ${packages.join(" ")}`;
  }
  execSync(command, { cwd: magicPath });
  let pjson = await fsPromises.readFile(
    path.join(magicPath, "package.json"),
    "utf8",
  );
  pjson = JSON.parse(pjson);
  magicObj.dependencies = pjson.dependencies;
  await writeMagicJson(magicPath, magicObj);
  await fsPromises.unlink(path.join(magicPath, "package.json"));
}

export { install, installDependencies };
