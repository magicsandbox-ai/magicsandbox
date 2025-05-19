import React, { useState, useRef } from "react";
import { toggleMark } from "prosemirror-commands";
import { Plugin, type Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import {
  useEditorEffect,
  useEditorEventListener,
  useEditorEventCallback,
} from "@handlewithcare/react-prosemirror";
import { Bold, Italic } from "lucide-react";
import { schema } from "./prosemirrorMarkdown.ts";

const toggleBoldMark = toggleMark(schema.marks.strong!);
const toggleItalicMark = toggleMark(schema.marks.em!);

function Menu() {
  const [menuPos, setMenuPos] = useState<
    { top: number; left: number } | undefined
  >(undefined);

  const menuRef = useRef<HTMLDivElement>(null);

  useEditorEffect((view) => {
    const hasFocus =
      view.hasFocus() || menuRef.current?.contains(document.activeElement);
    if (view.state.selection.empty || !hasFocus || !view.editable) {
      setMenuPos(undefined);
    } else {
      const containerRect = view.dom.getBoundingClientRect();
      const selectionRect = view.coordsAtPos(view.state.selection.anchor);
      const newPos = {
        top:
          selectionRect.top -
          containerRect.top -
          (selectionRect.bottom - selectionRect.top) -
          8,
        left: selectionRect.left - containerRect.left - 16,
      };
      if (
        !menuPos ||
        Math.abs(menuPos.top - newPos.top) > 1 ||
        Math.abs(menuPos.left - newPos.left) > 1
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

  const handleClick = useEditorEventCallback((view) => {
    const dispatch = (tr: Transaction) => {
      tr.setMeta("selectedMenu", true);
      view.dispatch(tr);
    };
    toggleBoldMark(view.state, dispatch, view);
  });

  if (menuPos === undefined) return;

  const iconClassName = "size-4";

  return (
    <div
      ref={menuRef}
      className="absolute z-10 flex gap-2 rounded-lg border border-stone-300 bg-white px-2 py-1 shadow-lg"
      style={menuPos}
      tabIndex={0}
      onClick={handleClick}
    >
      <button data-menu="bold">
        <Bold className={iconClassName} />
        <span className="sr-only">Bold</span>
      </button>
      <button data-menu="italic">
        <Italic className={iconClassName} />
        <span className="sr-only">Italic</span>
      </button>
    </div>
  );
}

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
              class: "bg-blue-100",
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
