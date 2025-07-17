import {
  DecorationSet,
  Decoration,
  type DecorationAttrs,
} from "prosemirror-view";
import { Transform } from "prosemirror-transform";
import { type Node } from "prosemirror-model";
import { diffArrays } from "diff";
import { parse } from "./prosemirrorMarkdown.ts";

function handleDiff(
  prevContent: string,
  content: string,
): {
  doc: Node;
  decorationSet: DecorationSet;
} {
  const diff = diffArrays(prevContent.split("\n"), content.split("\n"), {
    oneChangePerToken: true,
  });
  const diffedContent = diff
    .map((change) => {
      const value = change.value.join(""); //I'm pretty sure there's only ever one element in the array?
      if (change.added && !isCodeFence(value)) {
        return `${value}%%added%%`;
      } else if (change.removed && !isCodeFence(value)) {
        return `${value}%%removed%%`;
      } else {
        return value;
      }
    })
    .join("\n");
  let doc: Node;
  try {
    doc = parse(diffedContent);
  } catch (error) {
    console.error(error);
    doc = parse("");
  }
  const decorations: {
    from: number;
    to: number;
    attrs: DecorationAttrs;
  }[] = [];
  const deletes: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    //a code block can have multiple lines of text, so we need to handle it differently
    if (node.type.name === "code_block") {
      pos += 1; //add 1 because the start of the code block counts as one token
      const lines = node.textContent.split("\n");
      for (const line of lines) {
        if (line.endsWith("%%added%%")) {
          decorations.push({
            from: pos,
            to: pos + line.length,
            attrs: { class: "added" },
          });
          deletes.push({
            from: pos + line.length - "%%added%%".length,
            to: pos + line.length,
          });
        } else if (line.endsWith("%%removed%%")) {
          decorations.push({
            from: pos,
            to: pos + line.length,
            attrs: { class: "removed" },
          });
          deletes.push({
            from: pos + line.length - "%%removed%%".length,
            to: pos + line.length,
          });
        }
        pos += line.length + 1; //add 1 because of the newline
      }
      return false; //don't descend
    } else if (node.text) {
      if (node.text.endsWith("%%added%%")) {
        decorations.push({
          from: pos,
          to: pos + node.nodeSize,
          attrs: { class: "added" },
        });
        deletes.push({
          from: pos + node.nodeSize - "%%added%%".length,
          to: pos + node.nodeSize,
        });
      } else if (node.text.endsWith("%%removed%%")) {
        decorations.push({
          from: pos,
          to: pos + node.nodeSize,
          attrs: { class: "removed" },
        });
        deletes.push({
          from: pos + node.nodeSize - "%%removed%%".length,
          to: pos + node.nodeSize,
        });
      }
    }
  });
  const transform = new Transform(doc);
  for (const d of deletes) {
    transform.delete(
      transform.mapping.map(d.from),
      transform.mapping.map(d.to),
    );
  }
  const transformedDoc = transform.doc;
  const decorationSet = DecorationSet.create(
    transformedDoc,
    decorations.map((d) =>
      Decoration.inline(
        transform.mapping.map(d.from),
        transform.mapping.map(d.to),
        d.attrs,
        d.attrs, //spec - used for testing
      ),
    ),
  );
  return {
    doc: transformedDoc,
    decorationSet,
  };
}

export { handleDiff };

function isCodeFence(s: string) {
  return s.startsWith("```") || s.startsWith("~~~");
}
