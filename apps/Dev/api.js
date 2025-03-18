import { tagParser } from "@magicsandbox.ai/streaming";
import { context } from "./context.js";
import docs from "@magicsandbox.ai/docs/docs.md";
import { getHeadings } from "@magicsandbox.ai/docs";
import JSON5 from "json5";

function createApp(appState, name, description, createString) {
  const version = "0.1.0";
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
  appState.setApps((apps) => {
    const newApps = [...apps];
    if (!newApps.includes(app)) {
      newApps.push(app);
    }
    return newApps;
  });
  appState.setSelectedApp(app);
  appState.setFiles(files);
  appState.setMerges({});
  appState.setSelectedFilename("magic.json");
  requestPutData(app, files);
  requestPutData("selectedApp", app);
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
  assistant.full(
    getHeadings(docs, ["Apps", "Functions", "Publishing", "Advanced Topics"]),
  );
}

export { createApp, updateFiles, additionalContext, advancedDocs };
