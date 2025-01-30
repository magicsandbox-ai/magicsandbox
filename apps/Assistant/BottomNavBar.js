import React, { useState, useRef, useEffect } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  CircleArrowUp,
  Loader,
  Maximize2,
} from "lucide-react";
import Markdown from "@components/Markdown.js";
import rehypeHighlight from "rehype-highlight";
import { visit, SKIP } from "unist-util-visit";
import { defaultSchema } from "rehype-sanitize";

const messageStyle = "prose prose-sm prose-stone mx-2 ";
const assistantMessageStyle = messageStyle + "max-w-full";
const userMessageStyle =
  messageStyle +
  "self-end bg-stone-100 border border-stone-500 max-w-[80%] rounded-lg px-2 py-1";
const preStyle =
  "not-prose text-xs bg-stone-50 border border-stone-500 rounded-md overflow-x-auto px-2 py-2";

function rehypeCode() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (
        node.tagName === "pre" &&
        node.children.length === 1 &&
        node.children[0].tagName === "code"
      ) {
        const code = node.children[0];
        if (code.properties.className?.includes("language-magicscript")) {
          code.properties.className = ["language-javascript"]; //fix class name for highlighting
          const pre = { ...node }; //clone node since we mutate it below
          pre.properties.className = [preStyle];
          //now make code block collapsible
          const summary = {
            type: "element",
            tagName: "summary",
            children: [{ type: "text", value: "Executing Script..." }],
          };
          node.tagName = "details";
          node.properties = {};
          node.children = [summary, pre];
        } else {
          //not collapsible, just style pre
          node.properties.className = [preStyle];
        }
        return SKIP; //don't traverse children
      }
    });
  };
}

const rehypePlugins = [rehypeCode, rehypeHighlight];

const rehypeSanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span || []), ["className", /^hljs-./]],
    pre: [...(defaultSchema.attributes?.pre || []), ["className", preStyle]],
  },
};

function BottomNavBar({
  //setModal,
  settingsRef,
  toastsRef,
  assistantRef,
  messages,
}) {
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [live, setLive] = useState(true);
  const [intermediateScript, setIntermediateScript] = useState(null);

  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const maximizeButtonRef = useRef(null);
  const shouldFocusMaximizeButtonRef = useRef(false);

  useEffect(() => {
    inputRef.current.focus();
  }, []);

  useEffect(() => {
    inputRef.current.style.height = "auto"; //allow to shrink if needed
    inputRef.current.style.height = `${inputRef.current.scrollHeight + 4}px`; //add 4 because scrollHeight does not include border
  }, [input]);

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

  function handleChange(e) {
    setInput(e.target.value);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); //this is needed to prevent creating a newline after setInput('')
      handleSubmit();
    }
  }

  async function handleSubmit() {
    if (input === "") return;
    setInput("");
    await handleInput(input);
  }

  async function handleInput(input) {
    //don't let user submit while loading
    //todo let user stop loading?
    if (!settingsRef.current || isLoading) return;
    try {
      setIsLoading(true);
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
      let message = "Error: please try again";
      let type = "error";
      if (error.name === "ToastError") {
        message = error.message;
        type = error.type;
      }
      toastsRef.current.addToast(message, type);
    } finally {
      setIsLoading(false);
    }
  }

  function handleThumbsUp() {
    assistantRef.current.handleThumbsUp();
  }

  function handleThumbsDown() {
    assistantRef.current.handleThumbsDown();
  }

  function replaceSingleLineBreaks(text) {
    //improve markdown formatting by replacing single line breaks with double line breaks
    return text.replace(/([^\n])\n(?!\n)/g, "$1\n\n");
  }

  let scrollToBottom = false;
  if (!messagesContainerRef.current) {
    //messages are not open, we want to scroll to bottom when they are opened
    scrollToBottom = true;
  } else if (
    messagesContainerRef.current.scrollHeight -
      messagesContainerRef.current.clientHeight <=
    messagesContainerRef.current.scrollTop + 1
  ) {
    //already at the bottom so scroll to bottom once new message is added
    scrollToBottom = true;
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
                <div
                  ref={messagesContainerRef}
                  className="flex max-h-[80vh] flex-col gap-2 overflow-y-auto"
                >
                  {displayMessages.map((message, i) => (
                    <Markdown
                      className={
                        message.role === "user"
                          ? userMessageStyle
                          : assistantMessageStyle
                      }
                      key={i}
                      rehypePlugins={rehypePlugins}
                      rehypeSanitizeOptions={rehypeSanitizeOptions}
                      onComplete={
                        scrollToBottom && i === displayMessages.length - 1
                          ? () => {
                              messagesContainerRef.current.scrollTop =
                                messagesContainerRef.current.scrollHeight;
                            }
                          : undefined
                      }
                    >
                      {message.role === "user"
                        ? replaceSingleLineBreaks(message.displayContent)
                        : message.displayContent}
                    </Markdown>
                  ))}
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
              <textarea
                ref={inputRef}
                className={`mx-1 max-h-[124px] grow resize-none px-1 text-sm ${
                  collapsed ? "outline-0" : ""
                }`}
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={placeholder}
              />
              {collapsed && maximizeComponent}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-start gap-2">
        <button onClick={handleSubmit}>
          {isLoading ? <Loader className="animate-spin" /> : <CircleArrowUp />}
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
