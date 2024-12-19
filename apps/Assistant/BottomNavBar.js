import React, { useState, useRef, useEffect } from "react";
import {
  Sparkle,
  Sparkles,
  Settings,
  ThumbsUp,
  ThumbsDown,
  CircleArrowUp,
  Loader,
  Maximize2,
} from "lucide-react";
import Markdown from "@components/Markdown.js";
import rehypeHighlight from "rehype-highlight";
import { parseInput } from "./utils.js";
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
  setModal,
  settingsRef,
  toastsRef,
  assistantRef,
  messages,
  setMessages,
}) {
  const [inputValue, setInputValue] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const [magic, setMagic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [live, setLive] = useState(true);

  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
  }, []);

  useEffect(() => {
    inputRef.current.style.height = "auto"; //allow to shrink if needed
    inputRef.current.style.height = `${inputRef.current.scrollHeight + 4}px`; //add 4 because scrollHeight does not include border
  }, [inputValue]);

  function handleMagic() {
    setMagic(!magic); //todo different default message for magic?
    inputRef.current.focus();
  }

  function handleSettings() {
    setModal("settings");
  }

  function handleChange(e) {
    setInputValue(e.target.value);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); //this is needed to prevent creating a newline after setInputValue('')
      handleSubmit();
    }
  }

  async function handleSubmit() {
    //don't let user submit while loading
    //todo let user stop loading?
    if (inputValue === "" || !settingsRef.current || isLoading) {
      return;
    }
    try {
      setIsLoading(true);
      setInputValue("");
      const {
        input,
        magic: _magic,
        app,
      } = parseInput(inputValue, settingsRef.current.bangs);
      const newMagic = magic || _magic;
      setMagic(newMagic);
      if (newMagic) {
        setCollapsed(false);
        setMessages([...messages, inputValue, "Working on it..."]);
      } else {
        setMessages([inputValue, "Working on it..."]);
      }
      await assistantRef.current.handleInput({
        input,
        magic: newMagic,
        app,
        messages,
      });
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

  let placeholder;
  if (collapsed) {
    placeholder =
      messages.length > 0
        ? messages[messages.length - 1]
        : "What can I help you with?";
  } else {
    placeholder = "Ask anything.";
  }

  const maximizeComponent = (
    <button className="mx-2" onClick={() => setCollapsed(!collapsed)}>
      <Maximize2 />
    </button>
  );

  return (
    <div className="flex items-center justify-center gap-2 border-t-2 border-stone-500 bg-stone-100">
      <div className="flex flex-1 items-center justify-end gap-2">
        <button onClick={handleMagic}>
          {magic ? (
            <Sparkles className="fill-yellow-200 text-stone-700" />
          ) : (
            <Sparkle />
          )}
        </button>
      </div>
      <div className="flex h-11 w-1/2 max-w-screen-lg flex-initial items-center">
        <div className="relative h-full w-full">
          <div
            className={`absolute bottom-1.5 left-0 right-0 z-10 flex flex-col justify-center gap-2 rounded-xl border border-stone-500 bg-white py-1 outline-1 ${
              collapsed
                ? "focus-within:outline focus-within:outline-stone-500"
                : "py-2"
            }`}
          >
            {!collapsed && (
              <>
                <div className="flex">
                  <p className={messageStyle + "grow"}>
                    {messages.length === 0 ? "What can I help you with?" : ""}
                  </p>
                  {maximizeComponent}
                </div>
                <div
                  ref={messagesContainerRef}
                  className="flex max-h-[80vh] flex-col gap-2 overflow-y-auto"
                >
                  {messages.map((message, i) => (
                    <Markdown
                      className={
                        i % 2 === 0 ? userMessageStyle : assistantMessageStyle
                      }
                      key={i}
                      rehypePlugins={rehypePlugins}
                      rehypeSanitizeOptions={rehypeSanitizeOptions}
                      onComplete={
                        scrollToBottom && i === messages.length - 1
                          ? () => {
                              messagesContainerRef.current.scrollTop =
                                messagesContainerRef.current.scrollHeight;
                            }
                          : undefined
                      }
                    >
                      {i % 2 === 0 ? replaceSingleLineBreaks(message) : message}
                    </Markdown>
                  ))}
                </div>
              </>
            )}
            {!collapsed && <hr className="mx-2 border-stone-300" />}
            <div className="flex items-center">
              <textarea
                ref={inputRef}
                className={`mx-1 max-h-[124px] grow resize-none px-1 text-sm ${
                  collapsed ? "outline-0" : ""
                }`}
                value={inputValue}
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
        <button className="ml-auto mr-4" onClick={handleSettings}>
          <Settings />
        </button>
      </div>
    </div>
  );
}

export default BottomNavBar;
