import { tagParser } from "@magicsandbox.ai/streaming";
import { context } from "./context.js";
import docs from "@magicsandbox.ai/docs/docs.md";
import { getHeadings } from "@magicsandbox.ai/docs";

function updateFiles(privateApi, updateString) {
  const newFiles = { ...privateApi.files };
  // const updatedFiles = tagParser(updateString); //todo find/replace
  let invalidUpdateString = false;
  const updatedFiles = new Set();
  for (const [filename, fileUpdateString] of Object.entries(
    tagParser(updateString),
  )) {
    if (filename === undefined && fileUpdateString) {
      invalidUpdateString = true;
    }
    newFiles[filename] = code;
  }
  privateApi.setFiles(newFiles);
  //merges are the original files (kind of poorly named), so we want to keep any outstanding original files rather than overwrite them
  privateApi.setMerges({
    ...Object.fromEntries(
      Object.entries(privateApi.files).filter(([filename]) =>
        updatedFiles.has(filename),
      ),
    ),
    ...privateApi.merges,
  });
}

function additionalContext(privateApi, { files, code }) {
  console.full(context(privateApi, { files, code }));
}

function advancedDocs() {
  console.full(getHeadings(docs, ["Advanced"])); //todo
}

export { updateFiles, additionalContext, advancedDocs };
