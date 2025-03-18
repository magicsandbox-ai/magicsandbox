import { promises as fs } from "fs";
import { execSync } from "child_process";

await fs.copyFile("packages/js/docs/docs.md", "apps/Docs/index.md");
execSync("npx magicsandbox docs apps/Docs");
execSync("node cursorrules.js");
