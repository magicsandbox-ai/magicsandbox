import { tagParser } from "@magicsandbox.ai/streaming";
import { context } from "./context.js";
import docs from "@magicsandbox.ai/docs/docs.md";
import { getHeadings } from "@magicsandbox.ai/docs";

function updateFiles(privateApi, updateString) {
  const newFiles = { ...privateApi.files };
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
            console.warn("Consecutive <find> tag:", content);
          }
          find = content;
        } else if (tag === "replace") {
          if (find) {
            newFiles[filename] = newFiles[filename].replace(find, content);
            find = null;
          } else {
            console.warn("<replace> tag without <find> tag:", content);
          }
        }
      }
      if (find) {
        console.warn("<find> tag without <replace> tag:", find);
      }
      if (invalidFileUpdateString) {
        console.warn(
          "When using <find> and <replace> tags, anything outside of a tag is ignored",
        );
      }
    }
  }
  if (invalidUpdateString) {
    console.warn("Anything in the updateString outside of a tag is ignored");
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
  console.full(
    getHeadings(docs, ["Magic Apps", "Publishing", "Advanced Topics"]),
  );
}

export { updateFiles, additionalContext, advancedDocs };
