import { docs } from "../../packages/js/docs/index.js"; //"@magicsandbox.ai/docs";

const paths = [
  "./overview.md",
  "./apps.md",
  "./functions.md",
  "./publishing.md",
  "./sandbox.md",
  "./assistants.md",
  "./advanced.md",
];

await docs(paths, import.meta.url);

console.log("Docs built. Run npm run publish docs to publish.");
