import React, { useState, useRef } from "react";
import { toggleMark, setBlockType, wrapIn } from "prosemirror-commands";
import { wrapInList, liftListItem } from "prosemirror-schema-list";
import { Plugin, type EditorState, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import {
  useEditorEffect,
  useEditorEventListener,
  useEditorEventCallback,
} from "@handlewithcare/react-prosemirror";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Link,
  List,
  ListOrdered,
  Code,
  MessageSquareQuote,
} from "lucide-react";
import { schema } from "./prosemirrorMarkdown.ts";

const MARKUP_TYPES = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bullet_list",
  "ordered_list",
  "code_block",
  "blockquote",
] as const;

type MarkupType = (typeof MARKUP_TYPES)[number];

function isMarkupType(value: string): value is MarkupType {
  return MARKUP_TYPES.includes(value as MarkupType);
}

const MARKUP_MARKS = ["strong", "em"] as const;

type MarkupMark = (typeof MARKUP_MARKS)[number];

function isMarkupMark(value: string): value is MarkupMark {
  return MARKUP_MARKS.includes(value as MarkupMark);
}

type Markup = {
  type: MarkupType | undefined;
  marks: Set<MarkupMark>;
  linkHref: string | undefined;
};

function getSelectionMarkup(state: EditorState): Markup {
  let type: MarkupType | undefined;
  let sawType = false;
  let linkHref: string | undefined;
  let sawTextNode = false;
  const marks = new Set<MarkupMark>();
  state.doc.nodesBetween(
    state.selection.from,
    state.selection.to,
    (node, _pos, parent) => {
      const nodeMarkupType =
        node.type.name + (node.attrs?.level ? node.attrs.level : "");
      if (
        parent?.type.name === "doc" && //only look at top level nodes
        isMarkupType(nodeMarkupType)
      ) {
        if (type === undefined && !sawType) {
          type = nodeMarkupType;
          sawType = true;
        } else if (type !== nodeMarkupType) {
          //multiple types in selection, so return undefined
          type = undefined;
        }
      }
      if (node.type.name === "text") {
        if (sawTextNode) {
          //if multiple text nodes, don't return linkHref
          linkHref = undefined;
        } else {
          const linkMark = node.marks.find((mark) => mark.type.name === "link");
          if (linkMark) {
            linkHref = linkMark.attrs.href;
          }
        }
        sawTextNode = true;
      }
      node.marks.forEach((mark) => {
        if (isMarkupMark(mark.type.name)) {
          //if we see any strong or em, add them
          marks.add(mark.type.name);
        }
      });
    },
  );
  return { type, marks, linkHref };
}

const toggleBoldMark = toggleMark(schema.marks.strong);
const toggleItalicMark = toggleMark(schema.marks.em);
const setHeading1Type = setBlockType(schema.nodes.heading, { level: 1 });
const setHeading2Type = setBlockType(schema.nodes.heading, { level: 2 });
const setHeading3Type = setBlockType(schema.nodes.heading, { level: 3 });
const wrapInBulletList = wrapInList(schema.nodes.bullet_list);
const wrapInOrderedList = wrapInList(schema.nodes.ordered_list);
const setCodeBlockType = setBlockType(schema.nodes.code_block);
const wrapInBlockquote = wrapIn(schema.nodes.blockquote);

function addLinkMark(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  href: string,
) {
  const tr = state.tr;
  tr.addMark(
    state.selection.from,
    state.selection.to,
    schema.marks.link.create({ href }),
  );
  dispatch(tr);
}

const liftListItemCommand = liftListItem(schema.nodes.list_item);

function clearBlocks(state: EditorState, dispatch: (tr: Transaction) => void) {
  const tr = state.tr;
  state.doc.nodesBetween(
    state.selection.from,
    state.selection.to,
    (node, pos) => {
      if (node.isTextblock) {
        //headings, code_block
        tr.setNodeMarkup(pos, schema.nodes.paragraph);
        return false; //don't iterate over children
      } else if (
        node.type.name === "bullet_list" ||
        node.type.name === "ordered_list"
      ) {
        //todo this doesn't actually remove nested lists which could be annoying, but I can't figure it out
        liftListItemCommand(state, dispatch);
      } else if (node.isBlock) {
        //blockquote
        tr.replaceWith(pos, pos + node.nodeSize, node.content);
        return false; //don't iterate over children
      }
    },
  );
  dispatch(tr);
}

/**
 * Clear mark on the entire node, vs. toggleMark which clears only the current selection
 */
function clearNodeMark(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  markName: MarkupMark | "link",
) {
  const tr = state.tr;
  state.doc.nodesBetween(
    state.selection.from,
    state.selection.to,
    (node, pos) => {
      const mark = node.marks.find((m) => m.type.name === markName);
      if (mark) {
        tr.removeMark(pos, pos + node.nodeSize, mark);
        return false; //don't iterate over children
      }
    },
  );
  dispatch(tr);
}

function Menu({ editorState }: { editorState: EditorState }) {
  const [menuPos, setMenuPos] = useState<
    { top: number; left: number; urlTop: number | undefined } | undefined
  >(undefined);
  const [linkHref, setLinkHref] = useState<string | undefined>(undefined);

  const menuRef = useRef<HTMLDivElement>(null);

  useEditorEffect((view) => {
    const hasFocus =
      view.hasFocus() || menuRef.current?.contains(document.activeElement);
    if (view.state.selection.empty || !hasFocus || !view.editable) {
      setMenuPos(undefined);
      setLinkHref(undefined);
    } else {
      const markup = getSelectionMarkup(view.state);
      const containerRect = view.dom.getBoundingClientRect();
      const selectionRect = view.coordsAtPos(view.state.selection.anchor);
      let newTop =
        selectionRect.top -
        containerRect.top -
        (selectionRect.bottom - selectionRect.top) -
        8;
      let urlTop: number | undefined;
      if (markup.linkHref !== undefined) {
        urlTop = (selectionRect.bottom - selectionRect.top) * 2 + 12;
        if (linkHref === undefined) {
          setLinkHref(markup.linkHref);
        }
      }
      if (newTop < 0) {
        newTop = selectionRect.bottom - containerRect.top + 8;
        if (markup.linkHref !== undefined) {
          urlTop = 32;
        }
      }
      const newPos = {
        top: newTop,
        left: Math.min(
          Math.max(selectionRect.left - containerRect.left - 16, 12),
          containerRect.width - 232,
        ),
        urlTop,
      };
      if (
        !menuPos ||
        Math.abs(menuPos.top - newPos.top) > 1 ||
        Math.abs(menuPos.left - newPos.left) > 1 ||
        Math.abs((menuPos.urlTop || 0) - (newPos.urlTop || 0)) > 1
      ) {
        setMenuPos(newPos);
      }
    }
  });

  useEditorEventListener("blur", (_, event) => {
    const newFocusedElement = event.relatedTarget as HTMLElement;
    if (!menuRef.current?.contains(newFocusedElement)) {
      setMenuPos(undefined);
    }
  });

  const handleClick = useEditorEventCallback<
    [React.MouseEvent<HTMLDivElement, MouseEvent>],
    void
  >((view, event) => {
    const dispatch = (tr: Transaction) => {
      tr.setMeta("selectedMenu", true);
      view.dispatch(tr);
    };
    const target = event.target as HTMLElement;
    const button = target.closest("button");
    if (!button) return;

    const buttonAttr = button.getAttribute("data-menu") as
      | MarkupType
      | MarkupMark
      | "link";
    const markup = getSelectionMarkup(view.state);

    if (buttonAttr === "strong") {
      toggleBoldMark(view.state, dispatch, view);
    } else if (buttonAttr === "em") {
      toggleItalicMark(view.state, dispatch, view);
    } else if (buttonAttr === "heading1") {
      if (markup.type === "heading1") {
        clearBlocks(view.state, dispatch);
      } else {
        setHeading1Type(view.state, dispatch, view);
      }
    } else if (buttonAttr === "heading2") {
      if (markup.type === "heading2") {
        clearBlocks(view.state, dispatch);
      } else {
        setHeading2Type(view.state, dispatch, view);
      }
    } else if (buttonAttr === "heading3") {
      if (markup.type === "heading3") {
        clearBlocks(view.state, dispatch);
      } else {
        setHeading3Type(view.state, dispatch, view);
      }
    } else if (buttonAttr === "link") {
      if (markup.linkHref !== undefined) {
        clearNodeMark(view.state, dispatch, "link");
        setLinkHref(undefined);
      } else {
        addLinkMark(view.state, dispatch, "");
      }
    } else if (buttonAttr === "bullet_list") {
      if (markup.type === "bullet_list") {
        clearBlocks(view.state, dispatch);
      } else {
        wrapInBulletList(view.state, dispatch, view);
      }
    } else if (buttonAttr === "ordered_list") {
      if (markup.type === "ordered_list") {
        clearBlocks(view.state, dispatch);
      } else {
        wrapInOrderedList(view.state, dispatch, view);
      }
    } else if (buttonAttr === "code_block") {
      if (markup.type === "code_block") {
        clearBlocks(view.state, dispatch);
      } else {
        setCodeBlockType(view.state, dispatch, view);
      }
    } else if (buttonAttr === "blockquote") {
      if (markup.type === "blockquote") {
        clearBlocks(view.state, dispatch);
      } else {
        wrapInBlockquote(view.state, dispatch, view);
      }
    }
  });

  // function handleRename(
  //   e: React.FormEvent<HTMLFormElement> | React.FocusEvent<HTMLInputElement>,
  // ) {

  const handleHrefChange = useEditorEventCallback<
    [React.ChangeEvent<HTMLInputElement>],
    void
  >((view, event) => {
    setLinkHref(event.target.value);
    addLinkMark(view.state, view.dispatch, event.target.value);
  });

  if (menuPos === undefined) return;

  const markup = getSelectionMarkup(editorState);

  const iconClassName = "size-4";
  const activeClassName = " bg-stone-200";

  return (
    <div
      ref={menuRef}
      className="absolute z-10 flex gap-2 rounded-lg border border-stone-300 bg-white px-2 py-1 shadow-lg"
      style={{
        top: menuPos.top,
        left: menuPos.left,
      }}
      tabIndex={0}
      onClick={handleClick}
    >
      <button title="Bold" data-menu="strong">
        <Bold
          className={
            iconClassName + (markup.marks.has("strong") ? activeClassName : "")
          }
        />
        <span className="sr-only">Bold</span>
      </button>
      <button title="Italic" data-menu="em">
        <Italic
          className={
            iconClassName + (markup.marks.has("em") ? activeClassName : "")
          }
        />
        <span className="sr-only">Italic</span>
      </button>
      <button title="Heading 1" data-menu="heading1">
        <Heading1
          className={
            iconClassName + (markup.type === "heading1" ? activeClassName : "")
          }
        />
        <span className="sr-only">Heading 1</span>
      </button>
      <button title="Heading 2" data-menu="heading2">
        <Heading2
          className={
            iconClassName + (markup.type === "heading2" ? activeClassName : "")
          }
        />
        <span className="sr-only">Heading 2</span>
      </button>
      <button title="Heading 3" data-menu="heading3">
        <Heading3
          className={
            iconClassName + (markup.type === "heading3" ? activeClassName : "")
          }
        />
        <span className="sr-only">Heading 3</span>
      </button>
      <button title="Link" data-menu="link">
        <Link
          className={
            iconClassName +
            (markup.linkHref !== undefined ? activeClassName : "")
          }
        />
        <span className="sr-only">Link</span>
      </button>
      {menuPos.urlTop !== undefined && (
        <input
          className="absolute rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs shadow-lg"
          style={{
            top: menuPos.urlTop,
          }}
          type="url"
          value={linkHref}
          onChange={handleHrefChange}
          placeholder="Enter URL"
          aria-label="Enter URL"
          enterKeyHint="done"
        />
      )}
      <button title="Bullet List" data-menu="bullet_list">
        <List
          className={
            iconClassName +
            (markup.type === "bullet_list" ? activeClassName : "")
          }
        />
        <span className="sr-only">Bullet List</span>
      </button>
      <button title="Ordered List" data-menu="ordered_list">
        <ListOrdered
          className={
            iconClassName +
            (markup.type === "ordered_list" ? activeClassName : "")
          }
        />
        <span className="sr-only">Ordered List</span>
      </button>
      <button title="Code Block" data-menu="code_block">
        <Code
          className={
            iconClassName +
            (markup.type === "code_block" ? activeClassName : "")
          }
        />
        <span className="sr-only">Code Block</span>
      </button>
      <button title="Blockquote" data-menu="blockquote">
        <MessageSquareQuote
          className={
            iconClassName +
            (markup.type === "blockquote" ? activeClassName : "")
          }
        />
        <span className="sr-only">Blockquote</span>
      </button>
    </div>
  );
}

/**
 * Clicking on the menu removes the selection from the editor, so this plugin creates a pseudo-selection that highlights the text that was selected when the menu was clicked.
 */
function createSelectPlugin() {
  return new Plugin<DecorationSet>({
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, _value, _oldState, _newState) {
        if (tr.getMeta("selectedMenu")) {
          return DecorationSet.create(_newState.doc, [
            Decoration.inline(tr.selection.from, tr.selection.to, {
              class: "pseudo-selection",
            }),
          ]);
        } else {
          return DecorationSet.empty;
        }
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

export { Menu, createSelectPlugin };
