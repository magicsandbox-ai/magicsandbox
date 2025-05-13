import { prePublish, postPublish, getTagTimestamp } from "./publishUtils.js";
import { publish } from "@magicsandbox.ai/dev";
import { join } from "path";

/*
npm run publish:prod assistant -- -f
npm run publish:prod functions/llm
*/

let path = process.argv[2];

const force = process.argv.includes("-f");

if (!path.startsWith("apps/") && !path.startsWith("functions/")) {
  path = `apps/${path.charAt(0).toUpperCase() + path.slice(1)}`; //default to apps, for functions specify the whole path
}

prePublish({ force });

const magicObj = await publish(join(process.cwd(), path));
const tag = `${path}@${magicObj.version}-${getTagTimestamp()}`;

postPublish(tag);

process.exit(0); //think this is needed because esbuild keeps the process alive
