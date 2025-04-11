import { prePublish, postPublish } from "./publishUtils.js";
import { execSync } from "child_process";

/*
npm run publish-python:prod magicsandbox_streaming
*/

const packageName = process.argv[2];
const path = `packages/python/${packageName}`;

prePublish();

const version = execSync(
  "python3 -c \"import configparser; c = configparser.ConfigParser(); c.read('pyproject.toml'); print(c['project']['version'])\"",
  { cwd: path },
)
  .toString()
  .trim();

const tag = `${packageName}@${version}`;

execSync(
  `pipenv shell && flit -f ${path}/pyproject.toml build && flit -f ${path}/pyproject.toml publish`,
  {
    stdio: "inherit",
  },
);

postPublish(tag);
