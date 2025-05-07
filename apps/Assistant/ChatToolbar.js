import React from "react";
import {
  Plus,
  PanelBottomClose,
  PanelLeftClose,
  Minimize2,
} from "lucide-react";
import { ModelPicker } from "./ModelPicker.js";

export default function ChatToolbar({
  containerClassName,
  model,
  setModel,
  assistantRef,
  docked,
  setDocked,
  setCollapsed,
  shouldFocusCollapseButtonRef,
}) {
  return (
    <div className={containerClassName}>
      <div className="flex grow items-center">
        <ModelPicker model={model} setModel={setModel} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => assistantRef.current.handleNewConversation()}>
          <Plus />
          <span className="sr-only">New chat</span>
        </button>
        <button
          className="hidden md:block"
          onClick={() => {
            setDocked(!docked);
          }}
        >
          {docked ? <PanelBottomClose /> : <PanelLeftClose />}
          <span className="sr-only">{docked ? "Undock" : "Dock"}</span>
        </button>
        <button
          ref={(el) => {
            if (el && shouldFocusCollapseButtonRef.current) {
              el.focus();
              shouldFocusCollapseButtonRef.current = false;
            }
          }}
          onClick={() => {
            setCollapsed(true);
            shouldFocusCollapseButtonRef.current = true;
          }}
        >
          <Minimize2 />
          <span className="sr-only">Collapse</span>
        </button>
      </div>
    </div>
  );
}
