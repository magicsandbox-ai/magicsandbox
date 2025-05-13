import { execSync } from "child_process";

function prePublish({ commitMessage, force } = {}) {
  // if commit message provided, doesn't have to be clean
  // if force, doesn't have to be clean
  if (!commitMessage && !force) {
    try {
      execSync("git update-index --refresh"); //in case file is touched but not changed (magic.json)
      execSync("git diff-index --quiet HEAD --");
    } catch {
      throw new Error("Working directory must be clean before publishing");
    }
  }
}

function postPublish(tags, commitMessage) {
  // if commit message provided, commit changes first
  if (commitMessage) {
    execSyncLog(`git commit -a -m "${commitMessage}"`);
  }
  const tagArray = Array.isArray(tags) ? tags : [tags];
  for (const tag of tagArray) {
    execSyncLog(`git tag ${tag}`);
  }
  execSyncLog("git push --atomic origin main --tags");
}

function execSyncLog(command) {
  console.log(command);
  execSync(command, { stdio: "inherit" });
}

function getTagTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export { prePublish, postPublish, getTagTimestamp };
