import React, { useState } from "react";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
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

const originalContent = "### Hello World!\n\n test";
const newContent = "## Goodbye!\n\n test";
const diff = diffLines(originalContent, newContent);

/*
how to turn on and off? reconfigure?
*/

function diffPlugin() {
  return new Plugin({
    key: new PluginKey("diff"),
    state: {
      init(config, state) {
        return {
          original: defaultMarkdownSerializer.serialize(state.doc),
          diff: [],
        };
      },
      apply(tr, value, oldState, newState) {
        return {
          original: value.original,
          diff: diffLines(
            value.original,
            defaultMarkdownSerializer.serialize(newState.doc),
          ),
        };
      },
    },
    props: {
      decorations(state) {
        return DecorationSet.create(state.doc, [
          Decoration.inline(0, state.doc.content.size, {
            style: "color: purple",
          }),
        ]);
      },
    },
  });
}

const plugins = [...exampleSetup({ schema, menuBar: false }), reactKeys()];

function Note() {
  const [editorState, setEditorState] = useState(
    EditorState.create({
      doc: defaultMarkdownParser.parse(originalContent),
      plugins,
    }),
  );
  //const [editable, setEditable] = useState(true);

  function update() {
    setEditorState(
      editorState.reconfigure({ plugins: [...plugins, diffPlugin()] }),
    );
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
    //setEditable(false);
  }

  return (
    <ProseMirror
      state={editorState}
      dispatchTransaction={(tr) => {
        const newState = editorState.apply(tr);
        setEditorState(newState);
        const diffKey = new PluginKey("diff");
        const { diff = [] } = diffKey.getState(newState) || {};
        if (diff.length === 0) {
          setEditorState(newState.reconfigure({ plugins }));
        }
        //console.log(defaultMarkdownSerializer.serialize(newState.doc));
      }}
      //editable={() => editable}
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
