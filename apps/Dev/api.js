import { tagParser } from "@magicsandbox.ai/streaming";
import { context } from "./context.js";
import docs from "@magicsandbox.ai/docs/docs.md";
import { getHeadings } from "@magicsandbox.ai/docs";

function updateFiles(privateApi, updateString) {
  const updatedFiles = tagParser(updateString); //todo find/replace
  privateApi.setFiles({ ...privateApi.files, ...updatedFiles });
  //merges are the original files (kind of poorly named), so we want to keep any outstanding original files rather than overwrite them
  privateApi.setMerges({
    ...Object.fromEntries(
      Object.entries(privateApi.files).filter(
        ([filename]) => filename in updatedFiles,
      ),
    ),
    ...privateApi.merges,
  });
}

function additionalContext(privateApi, { files, code }) {
  console.full(context(privateApi, { files, code }));
}

function advancedDocs() {
  console.full(getHeadings(docs, ["Advanced"]));
}

export { updateFiles, additionalContext, advancedDocs };
