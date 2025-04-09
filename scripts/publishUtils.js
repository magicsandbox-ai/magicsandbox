import { execSync } from "child_process";

function prePublish(path, commitMessage) {
  const currentBranch = execSync("git rev-parse --abbrev-ref HEAD")
    .toString()
    .trim();
  if (currentBranch !== "dev") {
    throw new Error("Must publish from dev branch");
  }
  try {
    execSync(`git ls-files --error-unmatch ${path}`);
  } catch {
    throw new Error(`Invalid path: ${path}`);
  }
  // if commit message provided, dev doesn't have to be clean
  if (!commitMessage) {
    try {
      execSync(`git diff-index --quiet HEAD ${path}`);
    } catch {
      throw new Error("Path must be clean before publishing");
    }
  }
}

function postPublish(path, tag, commitMessage) {
  try {
    // if commit message provided, commit changes in dev first
    if (commitMessage) {
      execSyncLog(`git add ${path}`);
      execSyncLog(`git commit -m "${commitMessage}"`);
    }
    execSyncLog(`git commit --allow-empty -m "Publishing ${tag}"`); //add publishing commit to dev
    execSyncLog("git checkout main");
    execSyncLog(`git checkout dev -- ${path}`); //overwrite path files in main from dev
    execSyncLog(`git add ${path}`);
    execSyncLog(`git commit --allow-empty --no-verify -m "Publishing ${tag}"`);
    execSyncLog("git push");
  } finally {
    execSyncLog("git checkout dev");
  }
}

function execSyncLog(command) {
  console.log(command);
  execSync(command, { stdio: "inherit" });
}

function getTagTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export { prePublish, postPublish, getTagTimestamp };
