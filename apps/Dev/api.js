import { tagParser } from "@magicsandbox.ai/streaming";
import { context } from "./context.js";
import docs from "@magicsandbox.ai/docs/docs.md";
import { getHeadings } from "@magicsandbox.ai/docs";
import JSON5 from "json5";

function createApp(appState, name, description, createString) {
  const version = "0.1.0";
  const existingNames = new Set(appState.apps.map((app) => app.split("@")[0]));
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
      description: "${description}"
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
  appState.setApps((apps) => [...apps, app]);
  appState.setSelectedApp(app);
  appState.setFiles(files);
  appState.setMerges({});
  appState.setSelectedFilename("magic.json");
  appState.handlePutData(app, files);
  appState.handlePutData("selectedApp", app);
  appState.build(JSON5.parse(files["magic.json"]));
}

function updateFiles(appState, updateString) {
  const newFiles = { ...appState.files };
  let invalidUpdateString = false;
  const updatedFiles = new Set();
  for (const { tag: filename, content: fileUpdateString } of tagParser(
    updateString,
  )) {
    if (filename === undefined) {
      if (fileUpdateString.trim() !== "") {
        invalidUpdateString = true;
      }
      continue;
    }
    updatedFiles.add(filename);
    if (!fileUpdateString.trim().startsWith("<find>")) {
      //update the whole file
      //we need to look specifically for <find> rather than use tagParser because the file might be HTML or JSX and the tags are false positives
      newFiles[filename] = fileUpdateString;
    } else {
      if (!(filename in newFiles)) {
        assistant.error(
          "File not found. Can only use <find> and <replace> tags for existing files:",
          filename,
        );
        continue;
      }
      let find;
      let invalidFileUpdateString = false;
      for (const { tag, content } of tagParser(fileUpdateString)) {
        if (tag === undefined) {
          if (content.trim() !== "") {
            invalidFileUpdateString = true;
          }
          continue;
        }
        if (tag === "find") {
          if (find) {
            assistant.error("Consecutive <find> tag:", content);
          }
          find = content;
        } else if (tag === "replace") {
          if (find) {
            const newContent = newFiles[filename].replace(
              find.trim(),
              content.trim(),
            );
            if (newContent === newFiles[filename]) {
              assistant.error("Could not find text to replace:", find);
            } else {
              newFiles[filename] = newContent;
            }
            find = null;
          } else {
            assistant.error("<replace> tag without <find> tag:", content);
          }
        }
      }
      if (find) {
        assistant.error("<find> tag without <replace> tag:", find);
      }
      if (invalidFileUpdateString) {
        assistant.warn(
          "When using <find> and <replace> tags, anything outside of a tag is ignored",
        );
      }
    }
  }
  if (invalidUpdateString) {
    assistant.warn("Anything in the updateString outside of a tag is ignored");
  }
  appState.setFiles(newFiles);
  //merges are the original files (kind of poorly named), so we want to keep any outstanding original files rather than overwrite them
  appState.setMerges({
    ...Object.fromEntries(
      Object.entries(appState.files).filter(([filename]) =>
        updatedFiles.has(filename),
      ),
    ),
    ...appState.merges,
  });
}

function additionalContext(appState, { files, code }) {
  assistant.full(context(appState, { files, code }));
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
