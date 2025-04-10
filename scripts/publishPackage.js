import { prePublish, postPublish } from "./publishUtils.js";
import { execSync } from "child_process";

/*
npm run publish-package:prod dev
*/

const path = `packages/js/${process.argv[2]}`;

prePublish();

const pkg = JSON.parse(execSync("npm pkg get", { cwd: path }));
const tag = `${pkg.name}@${pkg.version}`;

const deps = ["dependencies", "peerDependencies", "devDependencies"];
for (const dep of deps) {
  if (pkg[dep]) {
    for (const key in pkg[dep]) {
      if (pkg[dep][key].startsWith("file:")) {
        throw new Error(`Local path found in ${dep}: ${pkg[dep][key]}`);
      }
    }
  }
}

execSync("npm publish --access public", { cwd: path, stdio: "inherit" });

postPublish(tag);
