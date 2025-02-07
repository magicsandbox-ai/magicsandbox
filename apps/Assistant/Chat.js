import React, { useState, useRef, useEffect } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  CircleArrowUp,
  Loader,
  Maximize2,
} from "lucide-react";
import ChatInput from "./ChatInput.js";
import {
  ChatDisplay,
  assistantMessageStyle,
  formatMessage,
} from "./ChatDisplay.js";

function Chat({
  settingsRef,
  toastsRef,
  assistantRef,
  messages,
  chatLoading,
  app,
}) {
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(true);

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
    if (input === "" || !settingsRef.current || chatLoading) return;
    setInput("");
    try {
      if (app) {
        setCollapsed(false);
      }
      await assistantRef.current.handleInput({
        input,
        messages,
      });
    } catch (error) {
      console.error(error);
      toastsRef.current.addToast("An unexpected error occurred", "error");
    }
  }

  function handleThumbsUp() {
    assistantRef.current.handleThumbsUp();
  }

  function handleThumbsDown() {
    assistantRef.current.handleThumbsDown();
  }

  function handleMaximize() {
    setCollapsed(!collapsed);
    shouldFocusMaximizeButtonRef.current = true;
  }

  let maximizeComponent = null;
  if (app) {
    maximizeComponent = (
      <button ref={maximizeButtonRef} className="mx-2" onClick={handleMaximize}>
        <Maximize2 />
      </button>
    );
  }

  let handleContinue;
  if (messages[messages.length - 1]?.promptToContinue) {
    handleContinue = () => {
      assistantRef.current.handleInput({
        messages,
      });
    };
  }

  let placeholder;
  if (collapsed && app && messages.length > 0) {
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
      {!app && (
        <ChatDisplay
          outerClassName="my-4 flex flex-1 flex-col items-center"
          innerClassName="w-full max-w-screen-lg"
          messages={messages}
          handleContinue={handleContinue}
        />
      )}
      <div className="flex flex-none items-center justify-center gap-2 border-t-2 border-stone-500 bg-stone-100">
        <div className="flex-1" /> {/* spacer */}
        <div className="flex h-12 w-full max-w-screen-lg flex-initial items-center">
          <div className="relative h-full w-full">
            <div
              className={`absolute bottom-1.5 left-0 right-0 z-10 flex flex-col justify-center gap-2 rounded-xl border border-stone-500 bg-white py-1 outline-1 ${
                collapsed
                  ? "focus-within:outline focus-within:outline-stone-500"
                  : "py-2"
              }`}
              onKeyDown={handleEscape}
              tabIndex={-1}
            >
              {!collapsed && (
                <>
                  <div className="flex">
                    <p className={assistantMessageStyle + " grow"}>
                      {messages.length === 0 ? "What can I help you with?" : ""}
                    </p>
                    {maximizeComponent}
                  </div>
                  <ChatDisplay
                    outerClassName="max-h-[80vh]"
                    messages={messages}
                    handleContinue={handleContinue}
                  />
                  <hr className="mx-2 border-stone-300" />
                </>
              )}
              <div className="flex items-center">
                <ChatInput
                  className={`mx-1 max-h-[148px] grow resize-none px-1 ${
                    collapsed ? "outline-0" : ""
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
          <button onClick={handleInput}>
            {chatLoading ? (
              <Loader className="animate-spin" />
            ) : (
              <CircleArrowUp />
            )}
          </button>
          {app && (
            <>
              <button onClick={handleThumbsUp}>
                <ThumbsUp />
              </button>
              <button onClick={handleThumbsDown}>
                <ThumbsDown />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Chat;
