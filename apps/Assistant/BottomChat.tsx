import React, { useState } from "react";
import {
  Star,
  CircleArrowUp,
  Maximize2,
  OctagonPause,
  LayoutGrid,
  Sparkles,
  X,
} from "lucide-react";
import ChatInput from "./ChatInput.tsx";
import { ChatDisplay, formatMessage } from "./ChatDisplay.tsx";
import ChatToolbar from "./ChatToolbar.tsx";
import type {
  AssistantRefObject,
  Message,
  AppState,
} from "./AssistantState.ts";

function BottomChat({
  collapsed,
  setCollapsed,
  shouldFocusCollapseButtonRef,
  docked,
  setDocked,
  assistantRef,
  messages,
  chatLoading,
  app,
  model,
  setModel,
  setShowDiscover,
  setShowApps,
  showWelcomeTooltip,
  setShowWelcomeTooltip,
}: {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  shouldFocusCollapseButtonRef: React.RefObject<boolean>;
  docked: boolean;
  setDocked: (docked: boolean) => void;
  assistantRef: AssistantRefObject;
  messages: Message[];
  chatLoading: boolean;
  app: AppState;
  model: string;
  setModel: (model: string) => void;
  setShowDiscover: (show: boolean) => void;
  setShowApps: (show: boolean) => void;
  showWelcomeTooltip: boolean;
  setShowWelcomeTooltip: (show: boolean) => void;
}) {
  const [input, setInput] = useState("");

  function handleEscape(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      setCollapsed(true);
    }
  }

  async function handleInput(input: string) {
    //don't let user submit while loading
    if (input === "" || assistantRef.current === null || chatLoading) return;
    setInput("");
    try {
      if (app !== null) {
        setCollapsed(false);
      }
      await assistantRef.current.handleInput({
        input,
        messages,
        resetInput: () => setInput(input),
      });
    } catch (error) {
      console.error(error);
      assistantRef.current.toastsRef.current.addToast(
        "An unexpected error occurred",
        "error",
      );
    }
  }

  let placeholder;
  if (collapsed && app !== null && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role !== "user") {
        placeholder = formatMessage(messages[i]).trim();
        break;
      }
    }
    placeholder = placeholder || "Chat with your Assistant";
  } else {
    placeholder = "Chat with your Assistant";
  }

  const actionButtonStyle = collapsed ? "" : "hidden md:block";

  return (
    <>
      <div className="flex flex-none items-center justify-center gap-2 border-t border-stone-500 bg-stone-100">
        <div className="flex-1" /> {/* spacer */}
        <div className="relative flex min-h-12 w-full max-w-screen-lg flex-initial items-center py-1.5">
          <div
            className={`flex w-full flex-col justify-center gap-2 rounded-xl border-stone-500 bg-white py-1 outline-1 ${
              collapsed || docked
                ? "border focus-within:outline focus-within:outline-stone-500"
                : "absolute bottom-1.5 z-10 border-2 py-2"
            }`}
            onKeyDown={handleEscape}
            tabIndex={-1}
          >
            {!collapsed && !docked && (
              <>
                <ChatToolbar
                  containerClassName="mx-3 flex items-center justify-between gap-2"
                  {...{
                    model,
                    setModel,
                    assistantRef,
                    docked,
                    setDocked,
                    setCollapsed,
                    shouldFocusCollapseButtonRef,
                  }}
                />
                <ChatDisplay
                  outerClassName="max-h-[60vh]"
                  messages={messages}
                  assistantRef={assistantRef}
                  setShowDiscover={setShowDiscover}
                  chatLoading={chatLoading}
                />
                <hr className="mx-2 border-stone-300" />
              </>
            )}
            <div className="flex items-center">
              <ChatInput
                className={`max-h-[148px] grow resize-none px-1 outline-none ${
                  collapsed || docked
                    ? "mx-1"
                    : "mx-2 focus:outline-2 focus:outline-stone-500"
                }`}
                input={input}
                setInput={setInput}
                handleInput={handleInput}
                placeholder={placeholder}
                focus={window.innerWidth > 768} //don't focus on mobile
              />
              {collapsed && app !== null && (
                <div className="relative flex items-center">
                  <button
                    ref={(el) => {
                      if (el && shouldFocusCollapseButtonRef.current) {
                        el.focus();
                        shouldFocusCollapseButtonRef.current = false;
                      }
                    }}
                    className="mx-2"
                    onClick={() => {
                      setCollapsed(false);
                      shouldFocusCollapseButtonRef.current = true;
                      setShowWelcomeTooltip(false);
                    }}
                  >
                    <Maximize2 />
                    <span className="sr-only">Expand</span>
                  </button>
                  {showWelcomeTooltip && (
                    <div className="group absolute bottom-full right-0 mb-3 whitespace-pre rounded-lg bg-stone-700 px-3 py-2 text-center text-sm font-medium text-white shadow">
                      <button
                        onClick={() => {
                          setShowWelcomeTooltip(false);
                        }}
                        className="absolute right-1 top-1 hidden rounded bg-stone-200 text-stone-700 hover:bg-stone-300 group-hover:block"
                      >
                        <X className="lucide-ignore size-4" />
                        <span className="sr-only">Dismiss</span>
                      </button>
                      Welcome to Magic Sandbox!
                      <br />
                      Expand to learn more
                      <div className="absolute right-3 top-full -mt-1 border-8 border-transparent border-t-stone-700" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mr-2 flex flex-1 items-center justify-start gap-2">
          <button onClick={() => handleInput(input)}>
            {chatLoading ? (
              <>
                <OctagonPause
                  onClick={() => {
                    assistantRef.current.handleStopConversation();
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
          {app ? (
            <>
              <button
                onClick={() => assistantRef.current.handleFavorite(app)}
                className={actionButtonStyle}
              >
                <Star className={app.favorited ? "fill-yellow-200" : ""} />
                <span className="sr-only">Favorite</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowApps(true)}
                className={actionButtonStyle}
              >
                <LayoutGrid />
                <span className="sr-only">Your apps</span>
              </button>
              <button
                onClick={() => setShowDiscover(true)}
                className={actionButtonStyle}
              >
                <Sparkles />
                <span className="sr-only">Discover apps</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default BottomChat;
