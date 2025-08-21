import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";
import type { AssistantState } from "./AssistantState.ts";

//based on https://www.npmjs.com/package/react-textarea-autosize
//but that implementation resizes based on the placeholder, which we don't want

function ChatInput({
  assistantState,
  className,
  placeholder,
  focus = true,
}: {
  assistantState: AssistantState;
  className: string;
  placeholder: string;
  focus?: boolean;
}) {
  const input = useSyncExternalStore(
    assistantState.subscribe("chatInput"),
    assistantState.getSnapshot("chatInput"),
  );

  const ref = useRef<HTMLTextAreaElement | null>(null);
  const cloneRef = useRef<HTMLTextAreaElement | null>(null);
  const lastHeightRef = useRef<number>(0);

  useEffect(() => {
    if (focus) {
      ref.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (cloneRef.current) {
      document.body.removeChild(cloneRef.current);
      cloneRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    if (!ref.current) return;
    if (!cloneRef.current) {
      const clone = document.createElement("textarea");
      clone.setAttribute("tabindex", "-1");
      clone.setAttribute("aria-hidden", "true");
      const hiddenStyles = {
        "min-height": "0",
        "max-height": "none",
        height: "0",
        visibility: "hidden",
        overflow: "hidden",
        position: "absolute",
        "z-index": "-1000",
        top: "0",
        right: "0",
        display: "block",
      };
      Object.entries(hiddenStyles).forEach(([key, value]) => {
        clone.style.setProperty(key, value, "important");
      });
      document.body.appendChild(clone);
      cloneRef.current = clone;
    }
    const stylesToCopy = [
      "borderBottomWidth",
      "borderLeftWidth",
      "borderRightWidth",
      "borderTopWidth",
      "boxSizing",
      "fontFamily",
      "fontSize",
      "fontStyle",
      "fontWeight",
      "letterSpacing",
      "lineHeight",
      "paddingBottom",
      "paddingLeft",
      "paddingRight",
      "paddingTop",
      // non-standard
      "tabSize",
      "textIndent",
      // non-standard
      "textRendering",
      "textTransform",
      "width",
      "wordBreak",
      "wordSpacing",
      "scrollbarGutter",
    ];
    const computedStyle = window.getComputedStyle(ref.current);
    stylesToCopy.forEach((style) => {
      cloneRef.current?.style.setProperty(
        style,
        computedStyle.getPropertyValue(style),
        "important",
      );
    });
    const borderSize = 4; //todo don't hardcode //also todo the textarea doesn't have a border so not sure this is needed? but have always added extra 4
    //todo handle padding?
    cloneRef.current.value = input || "x";
    let height = cloneRef.current.scrollHeight + borderSize;
    //https://github.com/Andarist/react-textarea-autosize/blob/ed1894cd8611d99fbea1c47adcf6ee522b1030fd/src/calculateNodeHeight.ts#L52
    cloneRef.current.value = input || "x";
    height = cloneRef.current.scrollHeight + borderSize;
    if (lastHeightRef.current !== height) {
      ref.current.style.height = `${height}px`;
      lastHeightRef.current = height;
    }
  }, [input]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    assistantState.setChatInput(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); //this is needed to prevent creating a newline after setInput('')
      if (window.innerWidth < 768 && e.target instanceof HTMLTextAreaElement) {
        //hide virtual keyboard on mobile
        e.target.blur();
      }
      assistantState.handleChatSubmit();
    }
  }

  return (
    <textarea
      id="chat-input"
      ref={ref}
      className={className}
      value={input}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      rows={1}
      placeholder={placeholder}
      aria-label="Chat with your Assistant"
      enterKeyHint="send"
    />
  );
}

export default ChatInput;
