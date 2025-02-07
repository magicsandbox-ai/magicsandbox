import React, { useRef, memo } from "react";
import Markdown from "@components/Markdown.js";
import rehypeHighlight from "rehype-highlight";
import { visit, SKIP } from "unist-util-visit";
import { defaultSchema } from "rehype-sanitize";

function ChatDisplay({
  outerClassName = "",
  innerClassName = "",
  messages,
  handleContinue,
}) {
  const ref = useRef(null);

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
    <div ref={ref} className={`overflow-y-auto ${outerClassName}`}>
      <div className={`flex flex-col gap-4 ${innerClassName}`}>
        {messages.map((message, i) => (
          <Message
            key={i}
            message={message}
            onComplete={
              scrollToBottom && i === messages.length - 1
                ? () => {
                    ref.current.scrollTop = ref.current.scrollHeight;
                  }
                : undefined
            }
          />
        ))}
        {handleContinue && (
          <button onClick={handleContinue}>Allow Assistant to continue?</button>
        )}
      </div>
    </div>
  );
}

const Message = memo(function Message({ message, onComplete }) {
  const formattedMessage = formatMessage(message);
  if (!formattedMessage) return null;
  return (
    <Markdown
      className={
        message.role === "user" ? userMessageStyle : assistantMessageStyle
      }
      rehypePlugins={rehypePlugins}
      rehypeSanitizeOptions={rehypeSanitizeOptions}
      onComplete={onComplete}
    >
      {formattedMessage}
    </Markdown>
  );
});

function formatMessage(message) {
  const tagsToInclude = {
    user: new Set(["user_request"]), //exclude suggested_apps, app_context, user_highlighted_text, logs
    assistant: new Set([undefined, "intermediate_script", "final_script"]), //exclude launch_app
    display: new Set([undefined]),
  };
  const messageTagsToInclude = tagsToInclude[message.role];
  return message.tags
    .filter((tag) => messageTagsToInclude.has(tag.tag))
    .map(formatTag)
    .join("");
}

function formatTag({ tag, content }) {
  if (tag === "intermediate_script" || tag === "final_script") {
    return `~~~magicscript\n${content.trim()}\n~~~`;
  } else if (tag === "user_request") {
    //improve markdown formatting by replacing single line breaks with double line breaks
    return content.trim().replace(/([^\n])\n(?!\n)/g, "$1\n\n");
  }
  return content;
}

const messageStyle = "prose prose-stone mx-2 ";
const assistantMessageStyle = messageStyle + "max-w-full";
const userMessageStyle =
  messageStyle +
  "self-end bg-stone-100 border border-stone-500 max-w-[80%] rounded-lg px-2 py-1";
const preStyle =
  "not-prose text-sm bg-stone-50 border border-stone-500 rounded-md overflow-x-auto px-2 py-2";

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

export { ChatDisplay, assistantMessageStyle, userMessageStyle, formatMessage };
