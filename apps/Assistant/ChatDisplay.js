import React, { useRef } from "react";
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

function ChatDisplay({ messages, handleContinue }) {
  const ref = useRef(null);

  function replaceSingleLineBreaks(text) {
    //improve markdown formatting by replacing single line breaks with double line breaks
    return text.replace(/([^\n])\n(?!\n)/g, "$1\n\n");
  }

  let scrollToBottom = false;
  if (!ref.current) {
    //messages are not open, we want to scroll to bottom when they are opened
    scrollToBottom = true;
  } else if (
    ref.current.scrollHeight - ref.current.clientHeight <=
    ref.current.scrollTop + 1
  ) {
    //already at the bottom so scroll to bottom once new message is added
    scrollToBottom = true;
  }

  return (
    <div ref={ref} className="flex h-full flex-col gap-2 overflow-y-auto">
      {messages.map((message, i) => (
        <Markdown
          className={
            message.role === "user" ? userMessageStyle : assistantMessageStyle
          }
          key={i}
          rehypePlugins={rehypePlugins}
          rehypeSanitizeOptions={rehypeSanitizeOptions}
          onComplete={
            scrollToBottom && i === messages.length - 1
              ? () => {
                  ref.current.scrollTop = ref.current.scrollHeight;
                }
              : undefined
          }
        >
          {message.role === "user"
            ? replaceSingleLineBreaks(message.content)
            : message.content}
        </Markdown>
      ))}
      {handleContinue && (
        <button onClick={handleContinue}>Allow Assistant to continue?</button>
      )}
    </div>
  );
}

export { ChatDisplay, assistantMessageStyle, userMessageStyle };
