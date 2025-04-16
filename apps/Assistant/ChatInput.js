import React, { useRef, useEffect } from "react";

function ChatInput({
  className,
  input,
  setInput,
  handleInput,
  placeholder,
  focus = true,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (focus) {
      ref.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (input === "") {
      //don't let placeholder make the input grow
      ref.current.style.height = "28px"; //line height 24 + 4 for border //todo configurable
    } else {
      ref.current.style.height = "auto"; //allow to shrink if needed
      ref.current.style.height = `${ref.current.scrollHeight + 4}px`; //add 4 because scrollHeight does not include border //todo configurable
    }
  }, [input]);

  function handleChange(e) {
    setInput(e.target.value);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); //this is needed to prevent creating a newline after setInput('')
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
