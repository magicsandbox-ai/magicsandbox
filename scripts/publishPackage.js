import { execSync } from "child_process";

/*
npm run publish-package:prod dev
*/

const path = `packages/js/${process.argv[2]}`;

const currentBranch = execSync("git rev-parse --abbrev-ref HEAD")
  .toString()
  .trim();
if (currentBranch !== "dev") {
  throw new Error("Must publish from dev branch");
}

try {
  execSync("git diff-index --quiet HEAD --");
} catch {
  throw new Error("Working directory must be clean before publishing");
}

try {
  execSync("npm publish --access public", { cwd: path });

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

  execSync("git checkout main");
  execSync(`git checkout dev -- ${path}`); //overwrite path files in main from dev
  execSync(`git add ${path}`);
  execSync(`git commit --no-verify -m 'Publishing package ${tag}'`);
  execSync(`git tag ${tag}`);
  execSync("git push --atomic origin main --tags");
  execSync("git checkout dev");

  console.log(`Successfully published package ${tag}`);
} catch (error) {
  console.error("\x1b[31mError during publishing:", error.message, "\x1b[0m");
  execSync("git checkout dev");
  process.exit(1);
}
