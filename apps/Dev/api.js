import { tagParser } from "@magicsandbox.ai/streaming";
import { context } from "./context.js";
import docs from "@magicsandbox.ai/docs/docs.md";
import { getHeadings } from "@magicsandbox.ai/docs";
import JSON5 from "json5";
import { handleUpdateString } from "./api.ts";

async function createApp(devState, name, description, createString) {
  const version = "0.1.0";
  const existingNames = new Set(devState.apps.map((app) => app.split("@")[0]));
  if (existingNames.has(name)) {
    name = getUniqueName(name, existingNames);
    assistant.warn(
      `User already has an App with this name, so renamed the App to: ${name}`,
    );
  }
  const app = `${name}@${version}`;
  const files = {
    "magic.json": `{
  name: "${name}",
  version: "${version}",
  description: "${description}",
  private: true,
}`,
  };
  let invalidCreateString = false;
  for (const { tag, content } of tagParser(createString)) {
    if (tag === undefined) {
      if (content.trim() !== "") {
        invalidCreateString = true;
      }
      continue;
    }
    files[tag] = content;
  }
  if (invalidCreateString) {
    assistant.warn("Anything in the createString outside of a tag is ignored");
  }
  //todo this is kind of a mess - need to clean up state management (and refs)
  devState.setApps((apps) => [...apps, app]);
  devState.setSelectedApp(app);
  devState.setFiles(files);
  devState.setMerges({});
  devState.setSelectedFilename("magic.json");
  devState.handlePutData(app, files);
  devState.handlePutData("selectedApp", app);
  devState.filesRef.current = files; //this is a hack - build depends on filesRef, but it won't be updated until useEffect runs, so update it now
  await devState.build(JSON5.parse(files["magic.json"]));
}

async function updateFiles(devState, updateString) {
  const { newFiles, newChangeSets } = handleUpdateString(
    updateString,
    devState.files,
    devState.merges,
  );
  devState.setFiles(newFiles);
  devState.setMerges(newChangeSets);
  devState.handlePutData(devState.selectedApp, newFiles);
  devState.filesRef.current = newFiles; //this is a hack - build depends on filesRef, but it won't be updated until useEffect runs, so update it now
  await devState.build(JSON5.parse(newFiles["magic.json"]));
}

function additionalContext(devState, { files, code }) {
  assistant.full(context(devState, { files, code }));
}

function advancedDocs() {
  const processedDocs = getHeadings(docs, [
    "Apps",
    "Functions",
    "Publishing",
    "Advanced Topics",
  ]);
  const faqs = `# magicsandbox.Dev FAQs

## Why are my builds sometimes slow?

magicsandbox.Dev parses your import statements and bundles external dependencies like React separately. When you rebuild your App, if the external dependencies haven't changed, magicsandbox.Dev will skip bundling external dependencies, making the rebuild extremely fast. If your external dependencies have changed, magicsandbox.Dev will fetch and bundle them again, making the build slower.

## How do I debug my code?

When using magicsandbox.Dev, your code runs in an iframe that's nested several layers deep. Because of this, it can be difficult to find your code in the Sources tab in Chrome's devtools.

The easiest way to debug your code in Chrome is to add a \`debugger\` statement and run your code with devtools open, which will open your file in the Sources tab. Your files will all be prefixed with 'MagicApp', like 'MagicApp:index.js'.

## What is the \`magic.json\` syntax? It's not valid JSON.

The \`magic.json\` file can be written in JSON5.
`;
  assistant.full(processedDocs + "\n\n" + faqs);
}

export { createApp, updateFiles, additionalContext, advancedDocs };

function getUniqueName(name, existingNames) {
  const match = name.match(/\d+$/);
  let newName;
  if (match) {
    const number = parseInt(match[0]);
    newName = `${name.slice(0, match.index)}${number + 1}`;
  } else {
    newName = `${name}1`;
  }
  if (existingNames.has(newName)) {
    return getUniqueName(newName, existingNames);
  }
  return newName;
}
