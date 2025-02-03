import React, { useState, useRef, useEffect } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  CircleArrowUp,
  Loader,
  Maximize2,
} from "lucide-react";
import { ChatInput, ChatDisplay, assistantMessageStyle } from "./Chat.js";

function BottomNavBar({
  //setModal,
  settingsRef,
  toastsRef,
  assistantRef,
  messages,
  chatLoading,
}) {
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const [live, setLive] = useState(true);
  const [intermediateScript, setIntermediateScript] = useState(null);

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

  // function handleSettings() {
  //   setModal("settings");
  // }

  async function handleSubmit() {
    if (input === "") return;
    setInput("");
    await handleInput(input);
  }

  async function handleInput(input) {
    //don't let user submit while loading
    //todo let user stop loading?
    if (!settingsRef.current || chatLoading) return;
    try {
      setCollapsed(false);
      const { intermediateScript } = await assistantRef.current.handleMagic({
        input,
        messages,
      });
      if (intermediateScript) {
        setIntermediateScript(intermediateScript);
      }
      setLive(true);
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

  const displayMessages = messages.filter((message) => message.displayContent);

  let placeholder;
  if (displayMessages.length > 0) {
    placeholder = displayMessages[displayMessages.length - 1].displayContent;
  } else {
    placeholder = "Ask your Assistant anything.";
  }

  function handleMaximize() {
    setCollapsed(!collapsed);
    shouldFocusMaximizeButtonRef.current = true;
  }

  const maximizeComponent = (
    <button ref={maximizeButtonRef} className="mx-2" onClick={handleMaximize}>
      <Maximize2 />
    </button>
  );

  return (
    <div className="flex items-center justify-center gap-2 border-t-2 border-stone-500 bg-stone-100">
      <div className="flex-1" /> {/* spacer */}
      <div className="flex h-11 w-1/2 max-w-screen-lg flex-initial items-center">
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
                    {displayMessages.length === 0
                      ? "What can I help you with?"
                      : ""}
                  </p>
                  {maximizeComponent}
                </div>
                <div className="max-h-[80vh]">
                  <ChatDisplay messages={displayMessages} />
                </div>
                {intermediateScript && (
                  <button
                    onClick={() => {
                      handleInput();
                      setIntermediateScript(null);
                    }}
                  >
                    Allow Assistant to continue?
                  </button>
                )}
                <hr className="mx-2 border-stone-300" />
              </>
            )}
            <div className="flex items-center">
              <ChatInput
                className={`mx-1 max-h-[124px] grow resize-none px-1 text-sm ${
                  collapsed ? "outline-0" : ""
                }`}
                input={input}
                setInput={setInput}
                handleInput={handleSubmit}
                placeholder={placeholder}
              />
              {collapsed && maximizeComponent}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-start gap-2">
        <button onClick={handleSubmit}>
          {chatLoading ? (
            <Loader className="animate-spin" />
          ) : (
            <CircleArrowUp />
          )}
        </button>
        {live && (
          <button onClick={handleThumbsUp}>
            <ThumbsUp />
          </button>
        )}
        {live && (
          <button onClick={handleThumbsDown}>
            <ThumbsDown />
          </button>
        )}
        {/* <button className="ml-auto mr-4" onClick={handleSettings}>
          <Settings />
        </button> */}
      </div>
    </div>
  );
}

export default BottomNavBar;
