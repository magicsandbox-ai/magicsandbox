import { execSync } from "child_process";

function prePublish() {
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
}

function postPublish(path, tag) {
  try {
    execSync("git checkout main");
    execSync(`git checkout dev -- ${path}`); //overwrite path files in main from dev
    execSync(`git add ${path}`);
    execSync(`git commit --no-verify -m 'Publishing ${tag}'`);
    execSync(`git tag ${tag}`);
    execSync("git push --atomic origin main --tags");
    execSync("git checkout dev");
    console.log(`Successfully pushed tag ${tag} to main`);
  } catch (error) {
    execSync("git checkout dev");
    throw error;
  }
}

function getTagTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export { prePublish, postPublish, getTagTimestamp };
