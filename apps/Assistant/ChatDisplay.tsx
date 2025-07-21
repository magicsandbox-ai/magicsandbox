import React, { useRef, memo, useCallback, useState, useEffect } from "react";
import Markdown from "./Markdown.tsx";
import rehypeHighlight from "rehype-highlight";
import { visit, SKIP } from "unist-util-visit";
import { defaultSchema } from "rehype-sanitize";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { Message, AssistantState } from "./AssistantState.ts";
import type { Root as MdastRoot } from "mdast";
import type { Root as HastRoot, Element as HastElement } from "hast";
import type { Schema } from "hast-util-sanitize";

function ChatDisplay({
  outerClassName = "",
  innerClassName = "",
  messages,
  assistantState,
  chatLoading,
}: {
  outerClassName?: string;
  innerClassName?: string;
  messages: Message[];
  assistantState: AssistantState;
  chatLoading: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scrollToBottomRef = useRef(false);

  if (!ref.current) {
    //messages are not open, we want to scroll to bottom when they are opened
    scrollToBottomRef.current = true;
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
      assistantState.handleInput({
        continueSystemPrompt:
          messages[messages.length - 1]!.continueSystemPrompt,
      });
    };
  }

  const displayMessages = filterAndCollapseMessages(messages);

  const lastUserMessageIndex = displayMessages.findLastIndex(
    (message) => message.role === "user",
  );
  const lastAssistantMessageIndex = displayMessages.findLastIndex(
    (message) => message.role === "assistant",
  );

  return (
    <div
      ref={ref}
      className={`relative overflow-y-auto ${outerClassName}`}
      style={{
        //force creation of a layer to improve scroll performance
        transform: "translateZ(0)",
      }}
    >
      <div
        id="chat-display"
        className={`mb-4 flex flex-col gap-5 ${innerClassName}`}
      >
        {displayMessages.map((message, i) => (
          <Message
            key={i}
            message={message}
            handleScroll={handleScroll}
            assistantState={assistantState}
            lastUserMessage={lastUserMessageIndex === i}
            lastAssistantMessage={lastAssistantMessageIndex === i}
            loading={chatLoading && i === displayMessages.length - 1}
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
  assistantState,
  lastUserMessage,
  lastAssistantMessage,
  loading = true,
}: {
  message: Message;
  handleScroll: (lastUserMessage: boolean) => void;
  assistantState: AssistantState;
  lastUserMessage: boolean;
  lastAssistantMessage: boolean;
  loading?: boolean;
}) {
  useEffect(() => {
    handleScroll(lastUserMessage);
  }, [message, handleScroll, lastUserMessage]);

  const formattedMessage = formatMessage(message);
  if (!formattedMessage && lastAssistantMessage) {
    if (loading) {
      return (
        <div className={assistantMessageStyle}>
          <p>
            <span className="loading loading-spinner">Working on it</span>
          </p>
        </div>
      );
    } else {
      return (
        <div className={assistantMessageStyle}>
          <p>
            <span className="text-red-600">
              Unexpected error: please try again.
            </span>
          </p>
        </div>
      );
    }
  } else if (!formattedMessage) {
    return null;
  }

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
      assistantState.addToast("An unexpected error occurred", "error");
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
        className={
          assistantMessageStyle +
          (message.welcome
            ? " mt-4 xl:mt-0" //welcome message is only case where assistant message is first. add some extra margin on mobile to not interfere with menu button
            : "")
        }
        remarkPlugins={remarkPlugins}
        rehypePlugins={[createRehypeCode(loading), rehypeHighlight]}
        rehypeSanitizeOptions={rehypeSanitizeOptions}
      >
        {formattedMessage}
      </Markdown>
      {message.model && (
        <div className="-mb-4 hidden gap-1 pl-3 text-xs text-stone-600 group-hover:flex">
          <i>{`Generated by ${message.model}`}</i>
          <FeedbackButtons assistantState={assistantState} />
        </div>
      )}
    </div>
  );
});

function FeedbackButtons({
  assistantState,
}: {
  assistantState: AssistantState;
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
              assistantState.handleFeedback(true);
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
              assistantState.handleFeedback(false);
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

function filterAndCollapseMessages(messages: Message[]): Message[] {
  const tagsToInclude: Record<Message["role"], Set<string | undefined>> = {
    system: new Set([]),
    user: new Set(["user_request"]), //exclude suggested_apps, app_context, user_highlighted_text, logs
    assistant: new Set([
      undefined,
      "open_app",
      "intermediate_script",
      "final_script",
    ]),
  };
  const filteredMessages = messages
    .map((message) => ({
      ...message,
      tags: message.tags.filter((tag) =>
        tagsToInclude[message.role]?.has(tag.tag),
      ),
    }))
    .filter((message) => message.tags.length > 0);
  const collapsedMessages = [];
  for (const message of filteredMessages) {
    const lastCollapsedMessage =
      collapsedMessages[collapsedMessages.length - 1];
    if (
      message.role === "assistant" &&
      lastCollapsedMessage?.role === "assistant"
    ) {
      //collapse consecutive assistant messages
      //note that the messages could have different models which we don't handle at all - just use the first
      lastCollapsedMessage.tags.push({ content: "\n\n" }, ...message.tags);
    } else {
      collapsedMessages.push(message);
    }
  }
  //always end with an assistant message - if it's empty, we'll display a loading or error message
  if (
    collapsedMessages.length > 0 &&
    collapsedMessages[collapsedMessages.length - 1]?.role !== "assistant"
  ) {
    const message: Message = {
      role: "assistant",
      tags: [],
    };
    collapsedMessages.push(message);
  }
  return collapsedMessages;
}

function formatMessage(message: Message) {
  return message.tags.map(formatTag).join("");
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
