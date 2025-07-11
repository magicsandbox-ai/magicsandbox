import React, {
  useRef,
  memo,
  useCallback,
  useState,
  useLayoutEffect,
} from "react";
import Markdown from "./Markdown.tsx";
import rehypeHighlight from "rehype-highlight";
import { visit, SKIP } from "unist-util-visit";
import { defaultSchema } from "rehype-sanitize";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { Message, AssistantRefObject } from "./AssistantState.ts";
import type { Root as MdastRoot } from "mdast";
import type { Root as HastRoot, Element as HastElement } from "hast";
import type { Schema } from "hast-util-sanitize";

function ChatDisplay({
  outerClassName = "",
  innerClassName = "",
  messages,
  assistantRef,
  chatLoading,
}: {
  outerClassName?: string;
  innerClassName?: string;
  messages: Message[];
  assistantRef: AssistantRefObject;
  chatLoading: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scrollToBottomRef = useRef(false);

  const lastUserMessageIndex = messages.findLastIndex(
    (message) => message.role === "user",
  );

  if (!ref.current) {
    if (lastUserMessageIndex === -1 && messages[0]?.welcome) {
      //special case for welcome message - we should open it at the top
      scrollToBottomRef.current = false;
    } else {
      //otherwise, messages are not open, we want to scroll to bottom when they are opened
      scrollToBottomRef.current = true;
    }
  } else if (
    ref.current.scrollHeight - ref.current.clientHeight <=
    ref.current.scrollTop + 1
  ) {
    //already at the bottom so scroll to bottom once new message is added
    scrollToBottomRef.current = true;
  } else {
    scrollToBottomRef.current = false;
  }

  const handleScroll = useCallback((lastUserMessage?: boolean) => {
    if (ref.current && (scrollToBottomRef.current || lastUserMessage)) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, []);

  let handleContinue;
  const promptToContinue = messages[messages.length - 1]?.promptToContinue;
  if (promptToContinue) {
    handleContinue = () => {
      assistantRef.current.handleInput({
        messages,
        continueSystemPrompt:
          messages[messages.length - 1]!.continueSystemPrompt,
      });
    };
  }

  return (
    <div ref={ref} className={`overflow-y-auto ${outerClassName}`}>
      <div className={`mb-4 flex flex-col gap-5 ${innerClassName}`}>
        {messages.map((message, i) => (
          <Message
            key={i}
            message={message}
            handleScroll={handleScroll}
            assistantRef={assistantRef}
            lastUserMessage={lastUserMessageIndex === i}
            loading={chatLoading && i === messages.length - 1}
          />
        ))}
        {promptToContinue && (
          <button
            ref={(el) => {
              if (el) {
                handleScroll();
              }
            }}
            className="self-center rounded-xl border-2 border-stone-500 bg-stone-100 px-4 py-1 font-bold hover:bg-stone-200"
            onClick={handleContinue}
          >
            {promptToContinue}
          </button>
        )}
      </div>
    </div>
  );
}

const messageStyle =
  "prose prose-stone prose-h1:text-3xl prose-a:text-blue-600 mx-3 break-words ";
const assistantMessageStyle = messageStyle + "max-w-full assistant-message";
const userMessageStyle =
  messageStyle +
  "self-end max-w-[80%] whitespace-pre-wrap bg-stone-100 border border-stone-500 rounded-lg px-2 py-1";

const assistantMessageContainerStyle = "group";

const Message = memo(function Message({
  message,
  handleScroll,
  assistantRef,
  lastUserMessage,
  loading = true,
}: {
  message: Message;
  handleScroll: (lastUserMessage: boolean) => void;
  assistantRef: AssistantRefObject;
  lastUserMessage: boolean;
  loading?: boolean;
}) {
  useLayoutEffect(() => {
    handleScroll(lastUserMessage);
  }, [message, handleScroll, lastUserMessage]);

  const formattedMessage = formatMessage(message);
  if (!formattedMessage) return null;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    try {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const link = target.closest("a");
      if (link?.href) {
        e.preventDefault();
        requestOpenUrl(link.href);
        return;
      }
    } catch (error) {
      console.error(error);
      assistantRef.current.toastsRef.current.addToast(
        "An unexpected error occurred",
        "error",
      );
    }
  };

  if (message.role === "user") {
    return (
      <div className={userMessageStyle} onClick={handleClick}>
        {formattedMessage}
      </div>
    );
  }

  return (
    <div className={assistantMessageContainerStyle} onClick={handleClick}>
      <Markdown
        className={assistantMessageStyle}
        remarkPlugins={remarkPlugins}
        rehypePlugins={[createRehypeCode(loading), rehypeHighlight]}
        rehypeSanitizeOptions={rehypeSanitizeOptions}
      >
        {formattedMessage}
      </Markdown>
      {message.model && (
        <div className="-mb-4 hidden gap-1 pl-3 text-xs text-stone-600 group-hover:flex">
          <i>{`Generated by ${message.model}`}</i>
          <FeedbackButtons assistantRef={assistantRef} />
        </div>
      )}
    </div>
  );
});

function FeedbackButtons({
  assistantRef,
}: {
  assistantRef: AssistantRefObject;
}) {
  const [providedFeedback, setProvidedFeedback] = useState<boolean | undefined>(
    undefined,
  );

  const feedbackButtonClassName = `relative ${
    providedFeedback !== undefined ? "cursor-default" : ""
  }`;
  const feedbackIconClassName = `size-4 ${
    providedFeedback !== undefined ? "bg-stone-300" : ""
  }`;

  return (
    <>
      {providedFeedback !== false && (
        <button
          className={feedbackButtonClassName}
          onClick={() => {
            if (providedFeedback === undefined) {
              assistantRef.current.handleFeedback(true);
              setProvidedFeedback(true);
            }
          }}
        >
          <ThumbsUp className={feedbackIconClassName} />
          <span className="sr-only">Thumbs up</span>
        </button>
      )}
      {providedFeedback !== true && (
        <button
          className={feedbackButtonClassName}
          onClick={() => {
            if (providedFeedback === undefined) {
              assistantRef.current.handleFeedback(false);
              setProvidedFeedback(false);
            }
          }}
        >
          <ThumbsDown className={feedbackIconClassName} />
          <span className="sr-only">Thumbs down</span>
        </button>
      )}
    </>
  );
}

function formatMessage(message: Message) {
  if (message.role === "system") return "";
  const tagsToInclude = {
    user: new Set(["user_request"]), //exclude suggested_apps, app_context, user_highlighted_text, logs
    assistant: new Set([
      undefined,
      "open_app",
      "intermediate_script",
      "final_script",
    ]),
    display: new Set([undefined]),
  };
  const messageTagsToInclude: Set<string | undefined> =
    tagsToInclude[message.role];
  return message.tags
    .filter((tag) => messageTagsToInclude.has(tag.tag))
    .map(formatTag)
    .join("");
}

function formatTag({ tag, content }: { tag?: string; content: string }) {
  if (tag === "open_app") {
    return `~~~magicopenapp\n${content.trim()}\n~~~`;
  } else if (tag === "intermediate_script" || tag === "final_script") {
    return `~~~magicscript\n${content.trim()}\n~~~`;
  } else if (tag === "user_request") {
    //added line breaks when wrapping in <user_request>
    return content.trim();
  }
  return content;
}

function remarkHtmlToText() {
  return (tree: MdastRoot) => {
    visit(tree, (node) => {
      if (node.type === "html") {
        //@ts-ignore - typescript doesn't like changing the type of a node
        node.type = "text";
      }
    });
  };
}

const preStyle =
  "not-prose text-sm bg-stone-50 border border-stone-500 rounded-md overflow-x-auto px-2 py-2 my-5";

function createRehypeCode(loading: boolean) {
  return () => {
    return (tree: HastRoot) => {
      visit(tree, "element", (node) => {
        if (
          node.tagName === "pre" &&
          node.children.length === 1 &&
          node.children[0]?.type === "element" &&
          node.children[0].tagName === "code"
        ) {
          const code = node.children[0];
          let app;
          if (code.children.length === 1 && code.children[0]!.type === "text") {
            app = code.children[0]!.value.trim();
          } else {
            console.error("Invalid magicopenapp code block", code);
          }
          if (
            Array.isArray(code.properties.className) &&
            code.properties.className.includes("language-magicopenapp")
          ) {
            node.tagName = "p";
            node.properties = { className: "assistant-pill" };
            node.children = [
              {
                type: "element",
                tagName: "span",
                properties: {
                  className: loading
                    ? ["loading", "loading-spinner"]
                    : ["loading", "loading-done"],
                },
                children: [
                  {
                    type: "text",
                    value: loading
                      ? `Opening app${app ? ` ${app}` : ""}`
                      : `Opened app${app ? ` ${app}` : ""}`,
                  },
                ],
              },
            ];
          } else if (
            Array.isArray(code.properties.className) &&
            code.properties.className.includes("language-magicscript")
          ) {
            code.properties.className = ["language-javascript"]; //fix class name for highlighting
            const pre = { ...node }; //clone node since we mutate it below
            pre.properties.className = [preStyle];
            //now make code block collapsible
            const summary: HastElement = {
              type: "element",
              tagName: "summary",
              properties: {},
              children: [
                {
                  type: "element",
                  tagName: "span",
                  properties: {
                    className: loading
                      ? ["loading", "loading-spinner"]
                      : ["loading", "loading-done"],
                  },
                  children: [
                    {
                      type: "text",
                      value: loading ? "Working on it" : "Script complete",
                    },
                  ],
                },
              ],
            };
            node.tagName = "details";
            node.properties = { className: "assistant-pill" };
            node.children = [summary, pre];
          } else {
            //not collapsible, just style pre
            node.properties.className = [preStyle];
          }
          return SKIP; //don't traverse children
        }
      });
    };
  };
}

const remarkPlugins = [remarkHtmlToText];
const rehypeSanitizeOptions: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span || []),
      ["className", /^hljs-./, "loading", "loading-spinner", "loading-done"],
    ],
    pre: [...(defaultSchema.attributes?.pre || []), ["className", preStyle]],
    details: [
      ...(defaultSchema.attributes?.details || []),
      ["className", "assistant-pill"],
    ],
    p: [
      ...(defaultSchema.attributes?.p || []),
      ["className", "assistant-pill"],
    ],
  },
};

export { ChatDisplay, formatMessage };
