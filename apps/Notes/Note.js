import React, {
  useSyncExternalStore,
  useState,
  useRef,
  useEffect,
} from "react";
import { EditorState, Plugin } from "prosemirror-state";
import { DecorationSet, Decoration } from "prosemirror-view";
import { Transform, Step, StepResult } from "prosemirror-transform";
import { Slice, Fragment, Node } from "prosemirror-model";
import { parse, serialize, schema } from "./prosemirrorMarkdown.js";
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

function Note({ notesState, showSideBar }) {
  const currentNode = useSyncExternalStore(
    notesState.subscribe("currentNode"),
    notesState.getSnapshot("currentNode"),
  );

  const [editorState, setEditorState] = useState(null);
  const [diff, setDiff] = useState(null);

  const currentNodeRef = useRef(null);
  const editorStateRef = useRef({});
  const transactionTimeoutIdRef = useRef(null);

  useEffect(() => {
    if (currentNode.type !== "note") {
      if (currentNodeRef.current?.uuid) {
        editorStateRef.current[currentNodeRef.current.uuid] = editorState; //save current state
      }
      setEditorState(null);
      currentNodeRef.current = currentNode;
      return;
    }
    const { content, prevContent } = currentNode;
    if (
      content === currentNodeRef.current?.content &&
      prevContent === currentNodeRef.current?.prevContent
    ) {
      return;
    }
    let newDoc, newDiff;
    if (prevContent === null || content === prevContent) {
      newDoc = parse(content);
      newDiff = null;
    } else {
      const diff = diffArrays(prevContent.split("\n"), content.split("\n"), {
        oneChangePerToken: true,
      });
      const diffedContent = diff
        .map((change) => {
          if (change.added) {
            return `%%added%%\n${change.value}`;
          } else if (change.removed) {
            return `%%removed%%\n${change.value}`;
          } else {
            return change.value;
          }
        })
        .join("\n");
      newDoc = parse(diffedContent);
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
      const transaction = newEditorState.tr;
      if (!newEditorState.doc.eq(newDoc)) {
        transaction.replace(
          0,
          newEditorState.doc.content.size,
          new Slice(newDoc.content, 0, 0),
        );
      }
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
      diffPlugin = createDiffPlugin(newDiff, historyPlugin);
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

  function handleTransaction(newState) {
    let content, prevContent;
    const diffState = diffPlugin.getState(newState);
    if (diffState) {
      setDiff(diffState);
      ({ content, prevContent } = diffState);
    } else {
      content = serialize(newState.doc);
      prevContent = null;
    }
    /*
    we need to call updateNode to save any edits
    but a transaction can be just a change in selected text, so first we check if content or prevContent are actually changing
    when we call updateNode, it will update currentNode, but we want to ignore it because we already applied the change
    so we'll update currentNodeRef before calling updateNode
    since we check currentNodeRef in the useEffect and use it to return early
    */
    const newNode = {
      uuid: currentNode.uuid,
    };
    if (content !== currentNodeRef.current?.content) {
      newNode.content = content;
      currentNodeRef.current.content = content;
    }
    if (prevContent !== currentNodeRef.current?.prevContent) {
      newNode.prevContent = prevContent;
      currentNodeRef.current.prevContent = prevContent;
    }
    if (Object.keys(newNode).length > 1) {
      notesState.updateNode(newNode);
    }
  }
  return (
    <main className="flex grow flex-col p-3">
      <div
        className={`mb-2 flex cursor-default items-end justify-between border-b border-stone-300 pb-1 ${showSideBar ? "" : "pl-8"}`}
      >
        <NoteTitle currentNode={currentNode} notesState={notesState} />
        {currentNode.changeDetails && (
          <span className="italic leading-none text-stone-500">
            ({currentNode.changeDetails})
          </span>
        )}
      </div>
      {editorState ? (
        <ProseMirror
          state={editorState}
          dispatchTransaction={(tr) => {
            const newState = editorState.apply(tr);
            setEditorState(newState);
            //avoid serializing the potentially large doc too frequently
            clearTimeout(transactionTimeoutIdRef.current);
            transactionTimeoutIdRef.current = setTimeout(() => {
              handleTransaction(newState);
            }, 100);
          }}
          decorations={() => diff?.decorationSet}
          editable={() => !diff}
          clipboardTextSerializer={(slice) => {
            //prosemirror inserts two newlines by default, we want just one
            //https://github.com/ProseMirror/prosemirror-view/blob/27f1c05d91dfd97ebb72ae879d0fe85df0742db6/src/clipboard.ts#L37
            return slice.content.textBetween(0, slice.content.size, "\n");
          }}
          transformPastedText={(text) => {
            //prosemirror collapses consecutive newlines, use a zero width space to preserve them
            //https://github.com/ProseMirror/prosemirror-view/blob/27f1c05d91dfd97ebb72ae879d0fe85df0742db6/src/clipboard.ts#L58
            return text.replace(/\r\n/g, "\n").replace(/\n(?=\n)/g, "\n\u200b");
          }}
          transformPasted={(slice) => {
            //https://discuss.prosemirror.net/t/an-extra-br-is-added-in-certain-pasted-content/4730
            function recurse(item) {
              if (item instanceof Fragment) {
                const nodes = item.content.map(recurse);
                return Fragment.from(nodes);
              } else if (item instanceof Node) {
                const fragment = recurse(item.content);
                let node;

                if (
                  item.type.isBlock &&
                  item.content.size === 1 &&
                  item.content.content[0].type === schema.nodes.hard_break
                ) {
                  node = item.copy();
                } else {
                  node = item.copy(fragment);
                }

                return node;
              }
            }
            return new Slice(
              recurse(slice.content),
              slice.openStart,
              slice.openEnd,
            );
          }}
        >
          <ProseMirrorDoc />
        </ProseMirror>
      ) : (
        <div className="grow"></div>
      )}
      {currentNode.change && (
        <Approve
          containerClassName="flex-col gap-1.5 md:flex-row md:gap-6"
          approveText={`Approve changes to this ${currentNode.type}`}
          approveOnClick={() => notesState.approveChange(currentNode.uuid)}
          rejectText={`Reject changes to this ${currentNode.type}`}
          rejectOnClick={() => notesState.rejectChange(currentNode.uuid)}
        />
      )}
    </main>
  );
}

function NoteTitle({ currentNode, notesState }) {
  const [renameValue, setRenameValue] = useState(currentNode.name);

  const inputRef = useRef(null);

  function handleRename(e) {
    e.preventDefault();
    const newName = renameValue.trim();
    if (newName.length > 0) {
      notesState.updateNode({
        uuid: currentNode.uuid,
        name: newName,
      });
    } else {
      setRenameValue(currentNode.name);
    }
    inputRef.current.blur();
  }

  const baseClassName = "text-2xl font-bold";

  return (
    <div className="flex">
      <h1 className={baseClassName} onClick={() => inputRef.current.focus()}>
        {currentNode.path.slice(0, -1 * currentNode.name.length)}
      </h1>
      <form onSubmit={handleRename}>
        <input
          ref={inputRef}
          className={baseClassName}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRename}
          onFocus={(e) => e.target.select()}
          aria-label="Rename"
          enterKeyHint="done"
        />
      </form>
    </div>
  );
}

export default Note;

function createDiffPlugin(initState, historyPlugin) {
  return new Plugin({
    state: {
      init() {
        return initState;
      },
      apply(tr, value) {
        if (!tr.steps?.length) {
          //document is not changing (probably just a selection) - return the previous state
          return value;
        }
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
