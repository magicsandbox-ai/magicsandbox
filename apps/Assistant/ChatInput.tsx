import React, { useRef, useEffect } from "react";

function ChatInput({
  className,
  input,
  setInput,
  handleInput,
  placeholder,
  focus = true,
}: {
  className: string;
  input: string;
  setInput: (input: string) => void;
  handleInput: (input: string) => void;
  placeholder: string;
  focus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (focus) {
      ref.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    if (input === "") {
      //don't let placeholder make the input grow
      ref.current.style.height = "28px"; //line height 24 + 4 for border
    } else {
      ref.current.style.overflow = "hidden"; // prevent scrollbar during scrollHeight measurement
      ref.current.style.height = "auto"; //allow to shrink if needed
      ref.current.style.height = `${ref.current.scrollHeight + 4}px`; //add 4 because scrollHeight does not include border
      ref.current.style.overflow = ""; // restore default overflow
    }
  }, [input]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); //this is needed to prevent creating a newline after setInput('')
      if (window.innerWidth < 768 && e.target instanceof HTMLTextAreaElement) {
        //hide virtual keyboard on mobile
        e.target.blur();
      }
      handleInput(input);
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
