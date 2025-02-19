import React, { useState } from "react";
import ChatInput from "./ChatInput.js";
import AppList from "./AppList.js";
import { CircleArrowUp } from "lucide-react";

function Home({
  toastsRef,
  assistantRef,
  messages,
  chatLoading,
  appData,
  setAppData,
}) {
  const [input, setInput] = useState("");

  async function handleInput(input) {
    if (input === "" || assistantRef.current === null || chatLoading) return;
    try {
      setInput("");
      await assistantRef.current.handleInput({ input, messages });
    } catch (error) {
      console.error(error);
      toastsRef.current.addToast("An unexpected error occurred", "error");
    }
  }

  return (
    <div className="h-full w-full max-w-screen-lg self-center">
      <div className="flex h-1/2 flex-none flex-col justify-end pb-6">
        <p className="mb-6 text-center text-2xl font-bold md:text-3xl">
          What can I help you with?
        </p>
        <div className="mx-1 flex rounded-xl border border-stone-500 py-1 outline-1 focus-within:outline focus-within:outline-stone-500">
          <ChatInput
            className="mx-2 max-h-[148px] grow resize-none outline-0"
            input={input}
            setInput={setInput}
            handleInput={handleInput}
            placeholder="Chat with your Assistant"
          />
          <button className="mr-1" onClick={() => handleInput(input)}>
            <CircleArrowUp />
          </button>
        </div>
      </div>
      <AppList
        appData={appData}
        setAppData={setAppData}
        assistantRef={assistantRef}
      />
    </div>
  );
}

export default Home;
