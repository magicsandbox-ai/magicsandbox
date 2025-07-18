import React, { useSyncExternalStore } from "react";
import {
  Star,
  CircleArrowUp,
  Maximize2,
  OctagonPause,
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import Tooltip from "./Tooltip.tsx";
import ChatInput from "./ChatInput.tsx";
import { ChatDisplay, formatMessage } from "./ChatDisplay.tsx";
import ChatToolbar from "./ChatToolbar.tsx";
import type { AssistantState, Message, AppState } from "./AssistantState.ts";

function BottomChat({
  chatCollapsed,
  shouldFocusCollapseButtonRef,
  docked,
  setDocked,
  assistantState,
  messages,
  chatLoading,
  app,
  setShowDiscover,
  setShowApps,
}: {
  chatCollapsed: boolean;
  shouldFocusCollapseButtonRef: React.RefObject<boolean>;
  docked: boolean;
  setDocked: (docked: boolean) => void;
  assistantState: AssistantState;
  messages: Message[];
  chatLoading: boolean;
  app: AppState;
  setShowDiscover: (show: boolean) => void;
  setShowApps: (show: boolean) => void;
}) {
  const input = useSyncExternalStore(
    assistantState.subscribe("chatInput"),
    assistantState.getSnapshot("chatInput"),
  );

  function handleEscape(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      assistantState.setChatCollapsed(true);
    }
  }

  async function handleInput(input: string) {
    //don't let user submit while loading
    if (input === "" || chatLoading) return;
    assistantState.setChatInput("");
    try {
      if (app !== null) {
        assistantState.setChatCollapsed(false);
      }
      await assistantState.handleInput({
        input,
        resetInput: () => assistantState.setChatInput(input),
      });
    } catch (error) {
      console.error(error);
      assistantState.addToast("An unexpected error occurred", "error");
    }
  }

  let placeholder;
  if (chatCollapsed && app !== null && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role !== "user") {
        placeholder = formatMessage(messages[i]!).trim();
        break;
      }
    }
    placeholder = placeholder || "Chat with your Assistant";
  } else if (chatCollapsed && app) {
    placeholder = window.innerWidth < 768 ? app.app : `Opened app ${app.app}`;
  } else {
    placeholder = "Chat with your Assistant";
  }

  const actionButtonStyle = chatCollapsed ? "" : "hidden md:block";

  return (
    <>
      <div className="flex flex-none items-center justify-center gap-2 border-t border-stone-500 bg-stone-100">
        <div className="flex-1" /> {/* spacer */}
        <div className="relative flex min-h-12 w-full max-w-screen-lg flex-initial items-center py-1.5">
          <div
            className={`flex w-full flex-col justify-center gap-2 rounded-xl border-stone-500 bg-white py-1 outline-1 ${
              chatCollapsed || docked
                ? "border focus-within:outline focus-within:outline-stone-500"
                : "absolute bottom-1.5 z-10 border-2 py-2"
            }`}
            onKeyDown={handleEscape}
            tabIndex={-1}
          >
            {!chatCollapsed && !docked && (
              <>
                <ChatToolbar
                  containerClassName="mx-3 flex items-center justify-between gap-2"
                  {...{
                    assistantState,
                    docked,
                    setDocked,
                    shouldFocusCollapseButtonRef,
                  }}
                />
                <ChatDisplay
                  outerClassName="max-h-[60vh]"
                  messages={messages}
                  assistantState={assistantState}
                  chatLoading={chatLoading}
                />
                <hr className="mx-2 border-stone-300" />
              </>
            )}
            <div className="flex items-center">
              <ChatInput
                className={`max-h-[148px] grow resize-none px-1 outline-none ${
                  chatCollapsed || docked
                    ? "mx-1"
                    : "mx-2 focus:outline-2 focus:outline-stone-500"
                }`}
                input={input}
                setInput={(input) => assistantState.setChatInput(input)}
                handleInput={handleInput}
                placeholder={placeholder}
                focus={window.innerWidth >= 1280} //don't focus on mobile/tablet
              />
              {chatCollapsed && app !== null && (
                <div className="relative flex items-center">
                  <Tooltip text="Expand chat">
                    <button
                      id="chat-collapse-button"
                      ref={(el) => {
                        if (el && shouldFocusCollapseButtonRef.current) {
                          el.focus();
                          shouldFocusCollapseButtonRef.current = false;
                        }
                      }}
                      className="mx-2"
                      onClick={() => {
                        assistantState.setChatCollapsed(false);
                        shouldFocusCollapseButtonRef.current = true;
                      }}
                    >
                      <Maximize2 />
                      <span className="sr-only">Expand chat</span>
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mr-2 flex flex-1 items-center justify-start gap-2">
          <Tooltip
            text={chatLoading ? "Stop chat" : "Submit chat"}
            position="left"
            className="md:tooltip-top"
          >
            <button onClick={() => handleInput(input)}>
              {chatLoading ? (
                <>
                  <OctagonPause
                    onClick={() => {
                      assistantState.handleStopConversation();
                    }}
                  />
                  <span className="sr-only">Stop</span>
                </>
              ) : (
                <>
                  <CircleArrowUp />
                  <span className="sr-only">Submit</span>
                </>
              )}
            </button>
          </Tooltip>
          {app ? (
            <>
              <Tooltip
                text={app.favorited ? "Unfavorite app" : "Favorite app"}
                position="left"
                className="xl:tooltip-top"
              >
                <button
                  onClick={() => assistantState.handleFavorite(app)}
                  className={actionButtonStyle}
                >
                  <Star className={app.favorited ? "fill-yellow-200" : ""} />
                  <span className="sr-only">
                    {app.favorited ? "Unfavorite app" : "Favorite app"}
                  </span>
                </button>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip text="Your apps">
                <button
                  onClick={() => setShowApps(true)}
                  className={actionButtonStyle}
                >
                  <LayoutGrid />
                  <span className="sr-only">Your apps</span>
                </button>
              </Tooltip>
              <Tooltip text="Discover apps" position="left">
                <button
                  onClick={() => setShowDiscover(true)}
                  className={actionButtonStyle}
                >
                  <Sparkles />
                  <span className="sr-only">Discover apps</span>
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default BottomChat;
