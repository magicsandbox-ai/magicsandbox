import fs from "fs/promises";
import path from "path";
import { exampleAppFiles, exampleFunctionFiles } from "./exampleFiles.js";

async function findNearestPackageJson(startPath) {
  let currentPath = startPath;
  while (currentPath !== path.dirname(currentPath)) {
    // Stop at root directory
    try {
      const pkgPath = path.join(currentPath, "package.json");
      await fs.access(pkgPath);
      return pkgPath;
    } catch {
      currentPath = path.dirname(currentPath);
    }
  }
  return null;
}

async function updatePackageJson(magicPath) {
  const pkgPath = await findNearestPackageJson(magicPath);
  if (!pkgPath) {
    console.warn(
      'No package.json found. You may want to run "npm init" first.',
    );
    return;
  }
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));
    pkg.scripts = pkg.scripts || {};
    if (!pkg.scripts.dev) {
      pkg.scripts.dev = "magicsandbox dev";
    }
    if (!pkg.scripts.publish) {
      pkg.scripts.publish = "magicsandbox publish";
    }
    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  } catch (error) {
    console.warn("Failed to update package.json:", error.message);
  }
}

async function init(magicPath, isFunction = false) {
  try {
    const dirName = path.basename(magicPath);
    if (!dirName) throw new Error("Invalid path");

    try {
      const files = await fs.readdir(magicPath);
      if (files.length > 0) {
        throw new Error(
          `Directory ${magicPath} already exists and is not empty. Please choose a different path or delete the existing directory.`,
        );
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        // ENOENT means directory doesn't exist, which is what we want
        throw error;
      }
    }
    await fs.mkdir(magicPath, { recursive: true });
    const template = isFunction ? exampleFunctionFiles : exampleAppFiles;
    for (const [filename, content] of Object.entries(template)) {
      const filePath = magicPath + "/" + filename;
      let fileContent = content;
      if (filename === "magic.json5") {
        fileContent = content.replace("name: ''", `name: '${dirName}'`);
      }
      await fs.writeFile(filePath, fileContent);
    }
    await updatePackageJson(magicPath);
    console.log(
      `Successfully created ${isFunction ? "Function" : "App"} in ${magicPath}`,
    );
    console.log("\nNext steps:");
    if (isFunction) {
      console.log(
        "1. Update the endpoint, description, and documentation in magic.json5",
      );
      console.log(
        `2. Run "npm run publish ${dirName}" to publish your Function`,
      );
    } else {
      console.log(
        `1. Run "npm run dev ${dirName}" to start the development server`,
      );
      console.log("2. Open https://magicsandbox.ai?app=magicsandbox.DevLocal");
      console.log("3. Edit your App files and see changes live\n");
    }
  } catch (error) {
    console.error("Failed to initialize:", error);
    process.exit(1);
  }
}

export { init };
