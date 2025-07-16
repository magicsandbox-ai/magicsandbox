import {
  DecorationSet,
  Decoration,
  type DecorationAttrs,
} from "prosemirror-view";
import { Transform } from "prosemirror-transform";
import { type Node } from "prosemirror-model";
import { diffArrays } from "diff";
import { parse } from "./prosemirrorMarkdown.ts";

// function handleDiff(
//   prevContent: string,
//   content: string,
// ): {
//   doc: Node;
//   decorationSet: DecorationSet;
// } {
//   const diff = diffArrays(prevContent.split("\n"), content.split("\n"), {
//     oneChangePerToken: true,
//   });
//   const diffedContent = diff
//     .map((change) => {
//       if (change.added) {
//         return `%%added%%\n${change.value}`;
//       } else if (change.removed) {
//         return `%%removed%%\n${change.value}`;
//       } else {
//         return change.value;
//       }
//     })
//     .join("\n");
//   let doc: Node;
//   try {
//     doc = parse(diffedContent);
//   } catch (error) {
//     console.error(error);
//     doc = parse("");
//   }
//   let prevNode: "added" | "removed" | undefined;
//   const decorations: {
//     type: "node" | "inline";
//     from: number;
//     to: number;
//     attrs: DecorationAttrs;
//   }[] = [];
//   const deletes: { from: number; to: number }[] = [];
//   doc.content.forEach((node, pos) => {
//     if (prevNode) {
//       decorations.push({
//         type: "node",
//         from: pos,
//         to: pos + node.nodeSize,
//         attrs: {
//           class: prevNode,
//         },
//       });
//       prevNode = undefined;
//     } else if (
//       node.textContent === "%%added%%" ||
//       node.textContent === "%%removed%%"
//     ) {
//       deletes.push({
//         from: pos,
//         to: pos + node.nodeSize,
//       });
//       if (node.textContent === "%%added%%") {
//         prevNode = "added";
//       } else {
//         prevNode = "removed";
//       }
//     } else {
//       prevNode = undefined;
//     }
//     //%%added%% and %%removed%% are not treated as separate nodes inside a code block, so we have to fix it
//     if (node.type.name === "code_block") {
//       const matches = node.textContent.matchAll(
//         /(%%(?:added|removed)%%\n?)(.*)/dg,
//       );
//       for (const match of matches) {
//         //we add 1 to pos because the start of the code block counts as one token
//         //delete the first capturing group (%%added%% or %%removed%%)
//         deletes.push({
//           from: pos + 1 + match.indices![1]![0],
//           to: pos + 1 + match.indices![1]![1],
//         });
//         //add a decoration to the second capturing group (the text)
//         if (match[2]) {
//           decorations.push({
//             type: "inline",
//             from: pos + 1 + match.indices![2]![0],
//             to: pos + 1 + match.indices![2]![1],
//             attrs: {
//               class: match[1]!.startsWith("%%added%%") ? "added" : "removed",
//             },
//           });
//         }
//       }
//     }
//   });
//   const transform = new Transform(doc);
//   for (const d of deletes) {
//     transform.delete(
//       transform.mapping.map(d.from),
//       transform.mapping.map(d.to),
//     );
//   }
//   doc = transform.doc;
//   const decorationSet = DecorationSet.create(
//     doc,
//     decorations.map((d) =>
//       d.type === "node"
//         ? Decoration.node(
//             transform.mapping.map(d.from),
//             transform.mapping.map(d.to),
//             d.attrs,
//             d.attrs, //spec - used for testing
//           )
//         : Decoration.inline(
//             transform.mapping.map(d.from),
//             transform.mapping.map(d.to),
//             d.attrs,
//             d.attrs, //spec - used for testing
//           ),
//     ),
//   );
//   return {
//     doc,
//     decorationSet,
//   };
// }

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
