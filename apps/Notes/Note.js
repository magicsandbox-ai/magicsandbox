import React, {
  useSyncExternalStore,
  useState,
  useRef,
  useEffect,
} from "react";
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
import Approve from "./Approve.js";

/*
menu? need prosemirror-view/style/prosemirror.css? just need container relative?
display keyboard shortcuts somewhere
allow creating links
plugin to display ctrl+enter to exit code block when selection is in code block (maybe even then only on enter), instead of on hover
escaping/deleting blocks in general can be kind of annoying
pasting images?
*/

let diffPlugin;

function Note({ notesState }) {
  const currentNode = useSyncExternalStore(
    notesState.subscribe("currentNode"),
    notesState.getSnapshot("currentNode"),
  );

  const [editorState, setEditorState] = useState(null);
  const [diff, setDiff] = useState(null);

  const currentNodeRef = useRef(null);
  const editorStateRef = useRef({});

  useEffect(() => {
    if (currentNode.type !== "note") return;
    const { content, prevContent } = currentNode;
    if (
      content === currentNodeRef.current?.content &&
      prevContent === currentNodeRef.current?.prevContent
    ) {
      return;
    }
    let newDoc, newDiff;
    if (prevContent === null || content === prevContent) {
      newDoc = defaultMarkdownParser.parse(content);
      newDiff = null;
    } else {
      const diff = diffArrays(
        prevContent.split("\n\n"),
        content.split("\n\n"),
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
      newDoc = defaultMarkdownParser.parse(diffedContent);
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
      newDoc = transform.doc;
      const decorationSet = DecorationSet.create(
        newDoc,
        decorations.map((d) =>
          Decoration.node(
            transform.mapping.map(d.from),
            transform.mapping.map(d.to),
            d.attrs,
          ),
        ),
      );
      newDiff = {
        prevContent,
        content,
        decorationSet,
      };
    }
    setDiff(newDiff);
    let newEditorState;
    if (currentNode.uuid === currentNodeRef.current?.uuid) {
      newEditorState = editorState;
    } else {
      if (currentNodeRef.current?.uuid) {
        editorStateRef.current[currentNodeRef.current.uuid] = editorState; //save current state
      }
      newEditorState = editorStateRef.current[currentNode.uuid]; //get new state
    }
    if (newEditorState) {
      const transaction = newEditorState.tr.replace(
        0,
        newEditorState.doc.content.size,
        new Slice(newDoc.content, 0, 0),
      );
      if (newDiff) {
        //creating a diff
        //the document is a mishmash of content and prevContent
        //DiffStep essentially flags the transaction and ensures we don't call updateNode with content set to a mishmash
        transaction.step(new DiffStep("create", newDiff));
      } else if (
        prevContent === null &&
        currentNodeRef.current &&
        currentNodeRef.current.prevContent !== null
      ) {
        //either accepting or rejecting a diff
        //apply a DiffStep so we can reverse it if needed
        transaction.step(new DiffStep("apply", diff));
      }
      setEditorState(newEditorState.apply(transaction));
    } else {
      const historyPlugin = history();
      diffPlugin = createDiffPlugin(historyPlugin);
      setEditorState(
        EditorState.create({
          doc: newDoc,
          plugins: [
            reactKeys(),
            ...exampleSetup({
              schema,
              menuBar: false,
              mapKeys: { "Mod-[": "Shift-Tab", "Mod-]": "Tab" }, //indenting lists
              history: false, //set up manually so we can reference it
            }),
            historyPlugin,
            diffPlugin,
          ],
        }),
      );
    }
    currentNodeRef.current = currentNode;
  }, [currentNode]);

  if (currentNode.type !== "note") return null;
  if (editorState === null) return null; //null on initial render
  return (
    <div className="flex grow flex-col p-3">
      <h1 className="mb-2 cursor-default border-b border-stone-300 pb-1 text-2xl font-bold leading-none">
        {currentNode.path}
      </h1>
      <ProseMirror
        state={editorState}
        dispatchTransaction={(tr) => {
          const newState = editorState.apply(tr);
          setEditorState(newState);
          let content, prevContent;
          const diffState = diffPlugin.getState(newState);
          if (diffState) {
            setDiff(diffState);
            ({ content, prevContent } = diffState);
          } else {
            content = serialize(newState.doc);
            prevContent = null;
          }
          //the call to updateNode will update currentNode, but we want to ignore it because we already applied the change
          //so set currentNodeRef, which is used to return early from the useEffect if the change is already applied
          currentNodeRef.current.content = content;
          currentNodeRef.current.prevContent = prevContent;
          notesState.updateNode({
            uuid: currentNode.uuid,
            content,
            prevContent,
          });
        }}
        decorations={() => diff?.decorationSet}
        editable={() => !diff}
      >
        <ProseMirrorDoc />
      </ProseMirror>
      {diff && (
        <Approve
          containerClassName="gap-6"
          approveText="Approve changes to this note"
          approveOnClick={() => notesState.approveChange(currentNode.uuid)}
          rejectText="Reject changes to this note"
          rejectOnClick={() => notesState.rejectChange(currentNode.uuid)}
        />
      )}
    </div>
  );
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

function createDiffPlugin(historyPlugin) {
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
          return diffStep.state;
        }
      },
    },
  });
}

class DiffStep extends Step {
  constructor(type, state) {
    super();
    this.type = type;
    this.state = state;
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
