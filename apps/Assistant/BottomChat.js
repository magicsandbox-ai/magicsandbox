import React, { useState, useRef, useEffect } from "react";
import {
  Star,
  Ban,
  CircleArrowUp,
  Maximize2,
  OctagonPause,
  Plus,
} from "lucide-react";
import ChatInput from "./ChatInput.js";
import { ChatDisplay, formatMessage } from "./ChatDisplay.js";
import { ModelPicker } from "./ModelPicker.js";

function BottomChat({
  collapsed,
  setCollapsed,
  toastsRef,
  assistantRef,
  messages,
  chatLoading,
  app,
  model,
  setModel,
  setShowDiscover,
}) {
  const [input, setInput] = useState("");

  const maximizeButtonRef = useRef(null);
  const shouldFocusMaximizeButtonRef = useRef(false);

  useEffect(() => {
    if (shouldFocusMaximizeButtonRef.current) {
      maximizeButtonRef.current.focus();
      shouldFocusMaximizeButtonRef.current = false;
    }
  }, [collapsed]);

  function handleEscape(e) {
    if (e.key === "Escape") {
      setCollapsed(true);
    }
  }

  async function handleInput(input) {
    //don't let user submit while loading
    //todo let user stop loading?
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

  function handleMaximize() {
    setCollapsed(!collapsed);
    shouldFocusMaximizeButtonRef.current = true;
  }

  let maximizeComponent = null;
  if (app !== null) {
    maximizeComponent = (
      <button
        ref={maximizeButtonRef}
        className={collapsed ? "mx-2" : ""}
        onClick={handleMaximize}
      >
        <Maximize2 />
        <span className="sr-only">{collapsed ? "Expand" : "Collapse"}</span>
      </button>
    );
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

  return (
    <>
      <div className="flex flex-none items-center justify-center gap-2 border-t border-stone-500 bg-stone-100">
        <div className="flex-1" /> {/* spacer */}
        <div className="flex h-12 w-full max-w-screen-lg flex-initial items-center">
          <div className="relative h-full w-full">
            <div
              className={`absolute bottom-1.5 left-0 right-0 z-10 flex flex-col justify-center gap-2 rounded-xl border-stone-500 bg-white py-1 outline-1 ${
                collapsed
                  ? "border focus-within:outline focus-within:outline-stone-500"
                  : "border-2 py-2"
              }`}
              onKeyDown={handleEscape}
              tabIndex={-1}
            >
              {!collapsed && (
                <>
                  <div className="mx-2 flex items-center justify-between gap-2">
                    <div className="flex grow items-center">
                      <ModelPicker model={model} setModel={setModel} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          assistantRef.current.handleNewConversation()
                        }
                      >
                        <Plus />
                        <span className="sr-only">New chat</span>
                      </button>
                      {maximizeComponent}
                    </div>
                  </div>
                  <ChatDisplay
                    outerClassName="max-h-[80vh]"
                    messages={messages}
                    assistantRef={assistantRef}
                    setShowDiscover={setShowDiscover}
                  />
                  <hr className="mx-2 border-stone-300" />
                </>
              )}
              <div className="flex items-center">
                <ChatInput
                  className={`max-h-[148px] grow resize-none px-1 ${
                    collapsed ? "mx-1 outline-0" : "mx-2"
                  }`}
                  input={input}
                  setInput={setInput}
                  handleInput={handleInput}
                  placeholder={placeholder}
                />
                {collapsed && maximizeComponent}
              </div>
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
          {app && (
            <>
              <button onClick={() => assistantRef.current.handleFavorite(app)}>
                <Star className={app.favorited ? "fill-yellow-500" : ""} />
                <span className="sr-only">Favorite</span>
              </button>
              <button onClick={() => assistantRef.current.handleBlock(app)}>
                <Ban className={app.blocked ? "text-red-500" : ""} />
                <span className="sr-only">Block</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default BottomChat;
