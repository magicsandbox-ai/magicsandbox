import React, { useState } from "react";
import { EditorState } from "prosemirror-state";
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
  useEditorEffect,
} from "@handlewithcare/react-prosemirror";

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


ctrl+enter to escape code. or escape then enter
  or keep space at bottom always? or handle down arrow?
handle tabs in lists to indent
deleting input rules?
*/

const originalContent = "### Hello World!";
const newContent = "## Goodbye!";

function EditorEffectHandler() {
  useEditorEffect((view) => {
    console.log(defaultMarkdownSerializer.serialize(view.state.doc));
  });
  return null;
}

function Note() {
  const [editorState, setEditorState] = useState(
    EditorState.create({
      doc: defaultMarkdownParser.parse(originalContent),
      plugins: [...exampleSetup({ schema, menuBar: false }), reactKeys()],
    }),
  );

  function update() {
    const newDoc = defaultMarkdownParser.parse(newContent);
    const tr = editorState.tr.replace(
      0,
      editorState.doc.content.size,
      new Slice(newDoc.content, 0, 0),
    );
    setEditorState((s) => s.apply(tr));
  }

  return (
    <ProseMirror
      state={editorState}
      dispatchTransaction={(tr) => {
        setEditorState((s) => s.apply(tr));
      }}
    >
      <EditorEffectHandler />
      <Button onClick={update} />
      <ProseMirrorDoc />
    </ProseMirror>
  );
}

function Button({ onClick }) {
  return <button onClick={onClick}>Click me</button>;
}

export default Note;
