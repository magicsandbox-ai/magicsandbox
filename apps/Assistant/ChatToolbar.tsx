import React from "react";
import {
  Plus,
  PanelBottomClose,
  PanelRightClose,
  Minimize2,
} from "lucide-react";
import Tooltip from "./Tooltip.tsx";
import { ModelPicker } from "./ModelPicker.tsx";
import type { AssistantRefObject } from "./AssistantState.ts";

export default function ChatToolbar({
  containerClassName,
  model,
  setModel,
  assistantRef,
  docked,
  setDocked,
  setCollapsed,
  shouldFocusCollapseButtonRef,
}: {
  containerClassName: string;
  model: string;
  setModel: (model: string) => void;
  assistantRef: AssistantRefObject;
  docked: boolean;
  setDocked: (docked: boolean) => void;
  setCollapsed: (collapsed: boolean) => void;
  shouldFocusCollapseButtonRef: React.RefObject<boolean>;
}) {
  return (
    <div className={containerClassName}>
      <div className="flex grow items-center">
        <ModelPicker model={model} setModel={setModel} />
      </div>
      <div className="flex items-center gap-2">
        <Tooltip text="New chat" position={docked ? "bottom" : "top"}>
          <button onClick={() => assistantRef.current.handleNewConversation()}>
            <Plus />
            <span className="sr-only">New chat</span>
          </button>
        </Tooltip>
        <Tooltip
          text={docked ? "Dock to bottom" : "Dock to right"}
          position={docked ? "left" : "top"}
          //we guarantee the app has at least 1024px, and we need at least 336px for the docked chat to look reasonable
          className="hidden min-[1360px]:block"
        >
          <button
            onClick={() => {
              setDocked(!docked);
            }}
          >
            {docked ? <PanelBottomClose /> : <PanelRightClose />}
            <span className="sr-only">
              {docked ? "Dock to bottom" : "Dock to right"}
            </span>
          </button>
        </Tooltip>
        <Tooltip text="Collapse chat" position={docked ? "left" : "top"}>
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
        </Tooltip>
      </div>
    </div>
  );
}
