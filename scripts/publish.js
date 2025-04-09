import { prePublish, postPublish } from "./publishUtils.js";
import { publish } from "@magicsandbox.ai/dev";

/*
npm run publish:prod assistant
npm run publish:prod functions/llm
*/

let path = process.argv[2];

if (!path.startsWith("apps/") && !path.startsWith("functions/")) {
  path = `apps/${path}`; //default to apps, for functions specify the whole path
}

prePublish();

const magicObj = await publish(path);
const tag = `${path}@${magicObj.version}`;

postPublish(path, tag);

process.exit(0); //think this is needed because esbuild keeps the process alive
