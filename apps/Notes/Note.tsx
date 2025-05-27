import React, {
  useSyncExternalStore,
  useState,
  useRef,
  useEffect,
} from "react";
import { EditorState, Plugin } from "prosemirror-state";
import {
  DecorationSet,
  Decoration,
  type DecorationAttrs,
} from "prosemirror-view";
import { Transform, Step, StepResult } from "prosemirror-transform";
import { Slice, Fragment, Node } from "prosemirror-model";
import { parse, serialize, schema } from "./prosemirrorMarkdown.ts";
import { exampleSetup } from "prosemirror-example-setup";
import { history } from "prosemirror-history";
import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
  useEditorEventListener,
} from "@handlewithcare/react-prosemirror";
import { diffArrays } from "diff";
import Approve from "./Approve.tsx";
import type NotesState from "./NotesState.ts";
import type { ClonedNode } from "./NotesState.ts";
import { Menu, createSelectPlugin } from "./NoteMenu.tsx";

/*
display keyboard shortcuts somewhere
plugin to display ctrl+enter to exit code block when selection is in code block (maybe even then only on enter), instead of on hover
escaping/deleting blocks in general can be kind of annoying
pasting images?
*/

declare let setTimeout: WindowOrWorkerGlobalScope["setTimeout"];

interface Diff {
  prevContent: string;
  content: string;
  decorationSet: DecorationSet;
}

let diffPlugin: Plugin<Diff | undefined> | undefined;

function Note({
  notesState,
  showSideBar,
}: {
  notesState: NotesState;
  showSideBar: boolean;
}) {
  const currentNode = useSyncExternalStore(
    notesState.subscribe("currentNode"),
    notesState.getSnapshot("currentNode"),
  );

  const [editorState, setEditorState] = useState<EditorState | undefined>(
    undefined,
  );
  const [diff, setDiff] = useState<Diff | undefined>(undefined);

  const currentNodeRef = useRef<ClonedNode | undefined>(undefined);
  const editorStateRef = useRef<Record<string, EditorState>>({});
  const transactionTimeoutIdRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!currentNode.isNote()) {
      if (currentNodeRef.current && editorState) {
        editorStateRef.current[currentNodeRef.current.nodeData.uuid] =
          editorState; //save current state
      }
      setEditorState(undefined);
      currentNodeRef.current = currentNode;
      return;
    }
    const content = currentNode.nodeData.content;
    const prevContent = currentNode.nodeData.prevContent;
    if (
      currentNodeRef.current?.isNote() &&
      content === currentNodeRef.current.nodeData.content &&
      prevContent === currentNodeRef.current.nodeData.prevContent
    ) {
      return;
    }
    let newDoc, newDiff;
    if (prevContent === undefined || content === prevContent) {
      try {
        newDoc = parse(content);
      } catch (error) {
        console.error(error);
        newDoc = parse("");
      }
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
      try {
        newDoc = parse(diffedContent);
      } catch (error) {
        console.error(error);
        newDoc = parse("");
      }
      let prevNode: "added" | "removed" | undefined;
      const decorations: {
        from: number;
        to: number;
        attrs: DecorationAttrs;
      }[] = [];
      const deletes: { from: number; to: number }[] = [];
      newDoc.content.forEach((node, pos) => {
        if (prevNode) {
          decorations.push({
            from: pos,
            to: pos + node.nodeSize,
            attrs: {
              class: prevNode,
            },
          });
          prevNode = undefined;
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
          prevNode = undefined;
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
    if (currentNode.nodeData.uuid === currentNodeRef.current?.nodeData.uuid) {
      newEditorState = editorState;
    } else {
      if (currentNodeRef.current && editorState) {
        editorStateRef.current[currentNodeRef.current.nodeData.uuid] =
          editorState; //save current state
      }
      newEditorState = editorStateRef.current[currentNode.nodeData.uuid]; //get new state
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
        prevContent === undefined &&
        currentNode.nodeData.uuid === currentNodeRef.current?.nodeData.uuid &&
        currentNodeRef.current.isNote() &&
        currentNodeRef.current.nodeData.prevContent !== undefined
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
            createSelectPlugin(),
          ],
        }),
      );
    }
    currentNodeRef.current = currentNode;
  }, [currentNode]);

  function handleTransaction(newState: EditorState, uuid: string) {
    let content: string, prevContent: string | undefined;
    const diffState = diffPlugin?.getState(newState);
    if (diffState) {
      setDiff(diffState);
      ({ content, prevContent } = diffState);
    } else {
      content = serialize(newState.doc);
    }
    /*
    we need to call updateNode to save any edits
    but a transaction can be just a change in selected text, so first we check if content or prevContent are actually changing
    when we call updateNode, it will update currentNode, but we want to ignore it because we already applied the change
    so we'll update currentNodeRef before calling updateNode
    since we check currentNodeRef in the useEffect and use it to return early
    */
    const newNode: { uuid: string; content?: string; prevContent?: string } = {
      uuid,
    };
    if (
      !currentNodeRef.current?.isNote() ||
      uuid !== currentNodeRef.current.nodeData.uuid
    ) {
      //since we debounce handleTransaction, it's possible the uuid has changed. in that case, updateNode no matter what
      newNode.content = content;
      newNode.prevContent = prevContent;
    } else {
      if (content !== currentNodeRef.current.nodeData.content) {
        newNode.content = content;
        currentNodeRef.current.nodeData.content = content;
      }
      if (prevContent !== currentNodeRef.current.nodeData.prevContent) {
        newNode.prevContent = prevContent;
        currentNodeRef.current.nodeData.prevContent = prevContent;
      }
    }
    if (Object.keys(newNode).length > 1) {
      notesState.updateNode(newNode);
    }
  }
  return (
    <main className="flex min-w-0 grow flex-col">
      <div
        className={`flex max-w-full cursor-default items-end justify-between border-b border-stone-300 pb-1 pr-3 pt-3 lg:pt-2 ${showSideBar ? "pl-11 lg:pl-3" : "pl-11"}`}
      >
        <NoteTitle
          key={currentNode.nodeData.uuid}
          currentNode={currentNode}
          notesState={notesState}
        />
        {currentNode.changeData.changeDetails && (
          //since we can wrap two lines of text, use shrink-[2] to shrink the span more
          <span
            className="line-clamp-2 shrink-[2] text-xs italic leading-none text-stone-500 lg:text-base"
            title={currentNode.changeData.changeDetails}
          >
            ({currentNode.changeData.changeDetails})
          </span>
        )}
      </div>
      {editorState ? (
        <div className="relative z-10 h-full min-h-0 grow overflow-y-auto px-3">
          <ProseMirror
            state={editorState}
            dispatchTransaction={(tr) => {
              //sometimes when typing at the bottom of the note, the view doesn't scroll to the next line
              //but is there a case where we don't want it to scroll?
              tr.scrollIntoView();
              const newState = editorState.apply(tr);
              setEditorState(newState);
              //avoid serializing the potentially large doc too frequently
              clearTimeout(transactionTimeoutIdRef.current);
              transactionTimeoutIdRef.current = setTimeout(() => {
                handleTransaction(newState, currentNode.nodeData.uuid);
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
              return text
                .replace(/\r\n/g, "\n")
                .replace(/\n(?=\n)/g, "\n\u200b");
            }}
            transformPasted={(slice) => {
              //https://discuss.prosemirror.net/t/an-extra-br-is-added-in-certain-pasted-content/4730
              //function recurse<T extends Fragment | Node>(item: T): T {
              function recurse(item: Fragment | Node): Fragment | Node {
                if (item instanceof Fragment) {
                  const nodes = item.content.map(recurse) as Node[];
                  return Fragment.from(nodes);
                } else {
                  const fragment = recurse(item.content) as Fragment;
                  let node;
                  if (
                    item.type.isBlock &&
                    item.content.size === 1 &&
                    item.content.content[0]?.type === schema.nodes.hard_break
                  ) {
                    node = item.copy();
                  } else {
                    node = item.copy(fragment);
                  }
                  return node;
                }
              }
              return new Slice(
                recurse(slice.content) as Fragment,
                slice.openStart,
                slice.openEnd,
              );
            }}
          >
            <ProseMirrorDoc />
            <Menu editorState={editorState} />
            <LinkListener />
          </ProseMirror>
        </div>
      ) : (
        <div className="grow"></div>
      )}
      {currentNode.changeData.change && (
        <Approve
          containerClassName="flex-col gap-1.5 md:flex-row md:gap-6 pb-3"
          approveText={`Approve changes to this ${currentNode.nodeData.type}`}
          approveOnClick={() =>
            notesState.approveChange(currentNode.nodeData.uuid)
          }
          rejectText={`Reject changes to this ${currentNode.nodeData.type}`}
          rejectOnClick={() =>
            notesState.rejectChange(currentNode.nodeData.uuid)
          }
        />
      )}
    </main>
  );
}

function NoteTitle({
  currentNode,
  notesState,
}: {
  currentNode: ClonedNode;
  notesState: NotesState;
}) {
  const [renameValue, setRenameValue] = useState(currentNode.nodeData.name);

  useEffect(() => {
    setRenameValue(currentNode.nodeData.name);
  }, [currentNode.nodeData.name]);

  const inputRef = useRef<HTMLInputElement>(null);

  function handleRename(
    e: React.FormEvent<HTMLFormElement> | React.FocusEvent<HTMLInputElement>,
  ) {
    e.preventDefault();
    const newName = renameValue.trim();
    if (newName.length > 0) {
      notesState.updateNode({
        uuid: currentNode.nodeData.uuid,
        name: newName,
      });
    } else {
      setRenameValue(currentNode.nodeData.name);
    }
    inputRef.current?.blur();
  }
  const folders = currentNode.treeData.path.slice(
    0,
    -1 * currentNode.nodeData.name.length,
  );
  const baseClassName = "lg:text-2xl font-bold ";

  return (
    <div className="flex min-w-0 grow">
      {folders && (
        <h1
          className={baseClassName + "truncate"}
          title={folders}
          onClick={() => inputRef.current?.focus()}
        >
          {folders}
        </h1>
      )}
      <form className="w-32 shrink-0 grow" onSubmit={handleRename}>
        <input
          ref={inputRef}
          className={baseClassName + "w-full"}
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

function LinkListener() {
  useEditorEventListener("click", (_view, event) => {
    if (
      event.target instanceof HTMLAnchorElement &&
      event.target.href &&
      (event.ctrlKey || event.metaKey)
    ) {
      handleOpenUrl(event.target);
    }
  });
  useEditorEventListener("dblclick", (_view, event) => {
    if (event.target instanceof HTMLAnchorElement && event.target.href) {
      handleOpenUrl(event.target);
    }
  });
  function handleOpenUrl(target: HTMLAnchorElement) {
    const href = target.getAttribute("href");
    if (href) {
      requestOpenUrl(href.startsWith("http") ? href : `https://${href}`);
    }
  }
  return null;
}

export default Note;

function createDiffPlugin(initState: Diff | undefined, historyPlugin: Plugin) {
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
  type?: "create" | "apply";
  state?: any;

  constructor(type?: "create" | "apply", state?: Diff) {
    super();
    this.type = type;
    this.state = state;
  }
  apply(doc: Node) {
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
