import React, { useState } from "react";
import { EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
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
import { diffLines } from "diff";

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
      doc: defaultMarkdownParser.parse("### Hello World!"),
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
        ...originalContent.split("\n").slice(1),
        Date.now(),
      ].join("\n");
      const diff = diffLines(originalContent, newContent);
      setDiff({
        originalContent,
        newContent,
        decorations,
      });
      //add annotations / metadata somehow
      const diffedContent = diff
        .map((change) => {
          const symbol = change.added ? "+" : change.removed ? "-" : "";
          return `${symbol}${change.value}`;
        })
        .join("\n");
      const newDoc = defaultMarkdownParser.parse(diffedContent);
      const tr = editorState.tr.replace(
        0,
        editorState.doc.content.size,
        new Slice(newDoc.content, 0, 0),
      );
      setEditorState((s) => s.apply(tr));
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
      decorations={() => diff?.decorations}
      editable={() => Boolean(diff)}
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
