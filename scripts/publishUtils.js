import { execSync } from "child_process";

function prePublish(commitMessage) {
  // if commit message provided, doesn't have to be clean
  if (!commitMessage) {
    try {
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
