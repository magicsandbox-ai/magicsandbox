import { tagParser } from "@magicsandbox.ai/streaming";
import { ChangeSet, Text, type ChangeSpec } from "@codemirror/state";

function handleUpdateString(
  updateString: string,
  files: Record<string, string>,
  changeSets: Record<string, ChangeSet>,
) {
  let invalidUpdateString = false;
  const newFiles = { ...files };
  const newChangeSets = { ...changeSets };
  const changeSpecs: Record<string, ChangeSpec> = {};
  for (const { tag: filename, content: fileUpdateString } of tagParser(
    updateString,
  )) {
    if (filename === undefined) {
      if (fileUpdateString.trim() !== "") {
        invalidUpdateString = true;
      }
      continue;
    }
    if (!fileUpdateString.trim().startsWith("<find>")) {
      //update the whole file
      //we need to look specifically for <find> rather than use tagParser because the file might be HTML or JSX and the tags are false positives
      if (filename in newFiles) {
        changeSpecs[filename] = [
          {
            from: 0,
            to: newFiles[filename]!.length,
            insert: fileUpdateString,
          },
        ];
      } else {
        changeSpecs[filename] = [
          {
            from: 0,
            insert: fileUpdateString,
          },
        ];
      }
      newFiles[filename] = fileUpdateString;
    } else {
      if (!(filename in newFiles)) {
        assistant.error(
          "File not found. Can only use <find> and <replace> tags for existing files:",
          filename,
        );
        continue;
      }
      let find: string | undefined;
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
            const newContent = newFiles[filename]!.replace(
              find.trim(),
              content.trim(),
            );
            if (newContent === newFiles[filename]) {
              assistant.error("Could not find text to replace:", find);
            } else {
              newFiles[filename] = newContent;
            }
            find = undefined;
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
  for (const [filename, changeSpec] of Object.entries(changeSpecs)) {
    const originalDoc = Text.of(files[filename]?.split("\n") || [""]);
    const newChangeSet = ChangeSet.of(changeSpec, originalDoc.length);
    //we store the changeSet to get from the current document to the original document, so we need to invert it
    const invertedChangeSet = newChangeSet.invert(originalDoc);
    if (changeSets[filename]) {
      //then if there is already an existing changeSet, we compose them
      newChangeSets[filename] = invertedChangeSet.compose(changeSets[filename]);
    } else {
      newChangeSets[filename] = invertedChangeSet;
    }
  }
  return { newFiles, newChangeSets };
}

export { handleUpdateString };
