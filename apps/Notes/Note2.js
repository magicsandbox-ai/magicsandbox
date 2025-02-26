import React, { useState } from "react";
import { EditorState } from "prosemirror-state";
import { DecorationSet, Decoration } from "prosemirror-view";
import { Transform } from "prosemirror-transform";
import { Slice } from "prosemirror-model";
import {
  schema,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import { exampleSetup } from "prosemirror-example-setup";
import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
} from "@handlewithcare/react-prosemirror";
import { diffArrays } from "diff";

/*
documents serialized to markdown
assistant generates changes using markdown
  could be new note or find/replace
take diff of markdown documents
somehow display those diffs
  create a transaction
    node.replace?
    transaction vs transformation?
  add marks?
  widget? nodeviews? schema?
  maybe a highlight?


ctrl+enter to escape code. or escape then enter
  or keep space at bottom always? or handle down arrow?
handle tabs in lists to indent
deleting input rules?
menu? 
  Make sure you load style/prosemirror.css as a stylesheet when using prosemirror-view
*/

// const originalContent = "### Hello World!\n\n test";
// const newContent = "## Goodbye!\n\n test";
// const diff = diffLines(originalContent, newContent);

function Note() {
  const [editorState, setEditorState] = useState(
    EditorState.create({
      doc: defaultMarkdownParser.parse("### Hello World!\ntest"),
      plugins: [...exampleSetup({ schema, menuBar: false }), reactKeys()],
    }),
  );
  const [diff, setDiff] = useState(null);

  function update() {
    if (diff) {
      //simulate approving changes
      const newDoc = defaultMarkdownParser.parse(diff.newContent);
      const tr = editorState.tr.replace(
        0,
        editorState.doc.content.size,
        new Slice(newDoc.content, 0, 0),
      );
      setEditorState((s) => s.apply(tr));
      setDiff(null);
    } else {
      const originalContent = defaultMarkdownSerializer.serialize(
        editorState.doc,
      );
      const newContent = [
        ...originalContent.split("\n\n").slice(1),
        Date.now(),
      ].join("\n\n");
      const diff = diffArrays(
        originalContent.split("\n\n"),
        newContent.split("\n\n"),
        { oneChangePerToken: true },
      );
      const diffedContent = diff
        .map((change) => {
          if (change.added) {
            return `%%added%%\n\n${change.value}`;
          } else if (change.removed) {
            return `%%removed%%\n\n${change.value}`;
          } else {
            return change.value;
          }
        })
        .join("\n\n");
      const newDoc = defaultMarkdownParser.parse(diffedContent);
      let prevNode;
      const decorations = [];
      const deletes = [];
      newDoc.content.forEach((node, pos) => {
        if (prevNode) {
          decorations.push({
            from: pos,
            to: pos + node.nodeSize,
            attrs: {
              class: prevNode,
            },
          });
          prevNode = null;
        } else if (
          node.textContent === "%%added%%" ||
          node.textContent === "%%removed%%"
        ) {
          deletes.push({
            from: pos,
            to: pos + node.nodeSize,
          });
          if (node.textContent === "%%added%%") {
            prevNode = "added";
          } else {
            prevNode = "removed";
          }
        } else {
          prevNode = null;
        }
      });
      const transform = new Transform(newDoc);
      for (const d of deletes) {
        transform.delete(
          transform.mapping.map(d.from),
          transform.mapping.map(d.to),
        );
      }
      const decorationSet = DecorationSet.create(
        transform.doc,
        decorations.map((d) =>
          Decoration.node(
            transform.mapping.map(d.from),
            transform.mapping.map(d.to),
            d.attrs,
          ),
        ),
      );
      const transaction = editorState.tr.replace(
        0,
        editorState.doc.content.size,
        new Slice(transform.doc.content, 0, 0),
      );
      setEditorState((s) => s.apply(transaction));
      setDiff({
        originalContent,
        newContent,
        decorationSet,
      });
    }
  }

  return (
    <ProseMirror
      state={editorState}
      dispatchTransaction={(tr) => {
        const newState = editorState.apply(tr);
        setEditorState(newState);
        console.log(defaultMarkdownSerializer.serialize(newState.doc)); //todo save updated doc
      }}
      decorations={() => diff?.decorationSet}
      editable={() => !diff}
    >
      <Button onClick={update} />
      <ProseMirrorDoc />
    </ProseMirror>
  );
}

function Button({ onClick }) {
  return <button onClick={onClick}>Click me</button>;
}

export default Note;
