import { execSync } from "child_process";
import { publish } from "@magicsandbox.ai/dev";

/*
npm run publish assistant
npm run publish functions/llm
*/

let path = process.argv[2];

if (!path.startsWith("apps/") && !path.startsWith("functions/")) {
  path = `apps/${path}`; //default to apps, for functions specify the whole path
}

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
  const magicObj = await publish(path);
  const tag = `${path}@${magicObj.version}`;

  execSync("git checkout main");
  execSync(`git checkout dev -- ${path}`); //overwrite path files in main from dev
  execSync(`git add ${path}`);
  execSync(`git commit --no-verify -m 'Publishing ${tag}'`);
  execSync(`git tag ${tag}`);
  execSync("git push --atomic origin main --tags");
  execSync("git checkout dev");

  console.log(`Successfully pushed ${tag}`);
} catch (error) {
  console.error("\x1b[31mError during publishing:", error.message, "\x1b[0m");
  execSync("git checkout dev");
  process.exit(1);
}
