import { prePublish, postPublish } from "./publishUtils.js";
import { execSync } from "child_process";

/*
npm run publish-python:prod magicsandbox_streaming
*/

const path = `packages/python/${process.argv[2]}`;

prePublish();

const version = execSync(
  "python3 -c \"import configparser; c = configparser.ConfigParser(); c.read('pyproject.toml'); print(c['project']['version'])\"",
  { cwd: path },
)
  .toString()
  .trim();

const tag = `${path}@${version}`;

execSync("pipenv shell && flit build", { cwd: path, stdio: "inherit" });
execSync("pipenv run flit publish", { cwd: path, stdio: "inherit" });

postPublish(tag);
