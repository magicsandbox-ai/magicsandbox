import React, { useState } from "react";
import { EditorState, Plugin } from "prosemirror-state";
import { DecorationSet, Decoration } from "prosemirror-view";
import { Transform, Step, StepResult } from "prosemirror-transform";
import { Slice } from "prosemirror-model";
import {
  schema,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import { exampleSetup } from "prosemirror-example-setup";
import { history } from "prosemirror-history";
import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
} from "@handlewithcare/react-prosemirror";
import { diffArrays } from "diff";

/*
menu? need prosemirror-view/style/prosemirror.css? just need container relative?
display keyboard shortcuts somewhere
allow creating links
plugin to display ctrl+enter to exit code block when selection is in code block (maybe even then only on enter), instead of on hover
escaping/deleting blocks in general can be kind of annoying
pasting images?
*/

function Note({ currentNodeId, nodesRef }) {
  const [editorState, setEditorState] = useState(() => {
    const historyPlugin = history();
    return EditorState.create({
      doc: defaultMarkdownParser.parse(
        nodesRef.current[currentNodeId].content || "",
      ),
      plugins: [
        reactKeys(),
        ...exampleSetup({
          schema,
          menuBar: false,
          mapKeys: { "Mod-[": "Shift-Tab", "Mod-]": "Tab" }, //indenting lists
          history: false, //set up manually so we can pass to diffPlugin
        }),
        historyPlugin,
        diffPlugin(historyPlugin),
      ],
    });
  });
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
      tr.step(new DiffStep("apply", () => setDiff(diff)));
      setEditorState((s) => s.apply(tr));
      setDiff(null);
    } else {
      const originalContent = serialize(editorState.doc);
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
      transaction.step(
        new DiffStep("create", () =>
          setDiff({
            originalContent,
            newContent,
            decorationSet,
          }),
        ),
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
        console.log(serialize(newState.doc)); //todo save updated doc
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

/**
 * Serialize a Prosemirror document to a markdown string
 *
 * Prosemirror's markdown serializer and parser don't preserve empty lines,
 * so first replace all empty paragraphs in the doc with a zero width space
 */
function serialize(doc) {
  const emptyParagraphs = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph" && node.textContent === "") {
      emptyParagraphs.push(pos);
    }
  });
  const transform = new Transform(doc);
  for (const pos of emptyParagraphs) {
    transform.insert(transform.mapping.map(pos), schema.text("\u200B"));
  }
  return defaultMarkdownSerializer.serialize(transform.doc);
}

function diffPlugin(historyPlugin) {
  return new Plugin({
    state: {
      init() {
        return;
      },
      apply(tr) {
        const diffStep = tr.steps.find((step) => step instanceof DiffStep);
        if (!diffStep) return;
        const { redo = true } = tr.getMeta(historyPlugin) || {};
        if (
          (diffStep.type === "create" && redo) ||
          (diffStep.type === "apply" && !redo)
        ) {
          diffStep?.callback();
        }
      },
    },
  });
}

class DiffStep extends Step {
  constructor(type, callback) {
    super();
    this.type = type;
    this.callback = callback;
  }
  apply(doc) {
    return StepResult.ok(doc);
  }
  invert() {
    return this;
  }
  map() {
    return this;
  }
  toJSON() {
    return {};
  }
  fromJSON() {
    return new DiffStep();
  }
}

Step.jsonID("diff", DiffStep);
