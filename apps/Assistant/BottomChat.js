import React, { useState } from "react";
import {
  Star,
  Ban,
  CircleArrowUp,
  Maximize2,
  OctagonPause,
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import ChatInput from "./ChatInput.js";
import { ChatDisplay, formatMessage } from "./ChatDisplay.js";
import ChatToolbar from "./ChatToolbar.js";

function BottomChat({
  collapsed,
  setCollapsed,
  shouldFocusCollapseButton,
  setShouldFocusCollapseButton,
  docked,
  setDocked,
  toastsRef,
  assistantRef,
  messages,
  chatLoading,
  app,
  model,
  setModel,
  setShowDiscover,
  setShowApps,
}) {
  const [input, setInput] = useState("");

  function handleEscape(e) {
    if (e.key === "Escape") {
      setCollapsed(true);
    }
  }

  async function handleInput(input) {
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
      toastsRef.current.addToast("An unexpected error occurred", "error");
    }
  }

  let placeholder;
  if (collapsed && app !== null && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "user") {
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
                    shouldFocusCollapseButton,
                    setShouldFocusCollapseButton,
                  }}
                />
                <ChatDisplay
                  outerClassName="max-h-[60vh]"
                  messages={messages}
                  assistantRef={assistantRef}
                  setShowDiscover={setShowDiscover}
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
                <button
                  ref={(el) => {
                    if (el && shouldFocusCollapseButton) {
                      el.focus();
                      setShouldFocusCollapseButton(false);
                    }
                  }}
                  className="mx-2"
                  onClick={() => {
                    setCollapsed(false);
                    setShouldFocusCollapseButton(true);
                  }}
                >
                  <Maximize2 />
                  <span className="sr-only">Expand</span>
                </button>
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
              <button
                onClick={() => assistantRef.current.handleBlock(app)}
                className={actionButtonStyle}
              >
                <Ban className={app.blocked ? "text-red-500" : ""} />
                <span className="sr-only">Block</span>
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
