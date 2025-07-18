import React from "react";
import {
  Plus,
  PanelBottomClose,
  PanelRightClose,
  Minimize2,
} from "lucide-react";
import Tooltip from "./Tooltip.tsx";
import { ModelPicker } from "./ModelPicker.tsx";
import type { AssistantState } from "./AssistantState.ts";

export default function ChatToolbar({
  containerClassName,
  assistantState,
  docked,
  setDocked,
  shouldFocusCollapseButtonRef,
}: {
  containerClassName: string;
  assistantState: AssistantState;
  docked: boolean;
  setDocked: (docked: boolean) => void;
  shouldFocusCollapseButtonRef: React.RefObject<boolean>;
}) {
  return (
    <div className={containerClassName}>
      <div className="flex grow items-center">
        <ModelPicker assistantState={assistantState} />
      </div>
      <div className="flex items-center gap-2">
        <Tooltip text="New chat" position={docked ? "bottom" : "top"}>
          <button onClick={() => assistantState.handleNewConversation()}>
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
            id="chat-collapse-button"
            ref={(el) => {
              if (el && shouldFocusCollapseButtonRef.current) {
                el.focus();
                shouldFocusCollapseButtonRef.current = false;
              }
            }}
            onClick={() => {
              assistantState.setChatCollapsed(true);
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
