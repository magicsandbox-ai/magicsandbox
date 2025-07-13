import React, { useState } from "react";
import ChatInput from "./ChatInput.tsx";
import AppList from "./AppList.tsx";
import { CircleArrowUp, Sparkles } from "lucide-react";
import type { AssistantRefObject, AppData } from "./AssistantState.ts";

function Home({
  assistantRef,
  chatLoading,
  appData,
  setAppData,
  setShowDiscover,
}: {
  assistantRef: AssistantRefObject;
  chatLoading: boolean;
  appData: AppData;
  setAppData: (appData: AppData) => void;
  setShowDiscover: (show: boolean) => void;
}) {
  const [input, setInput] = useState("");

  async function handleInput(input: string) {
    if (input === "" || assistantRef.current === null || chatLoading) return;
    try {
      setInput("");
      await assistantRef.current.handleInput({
        input,
        resetInput: () => setInput(input),
      });
    } catch (error) {
      console.error(error);
      assistantRef.current.toastsRef.current.addToast(
        "An unexpected error occurred",
        "error",
      );
    }
  }

  return (
    <div className="h-full w-full max-w-screen-lg self-center">
      <div className="flex h-1/2 flex-none flex-col justify-end gap-6 pb-6">
        <p className="text-center text-2xl font-bold md:text-3xl">
          What can I help you with?
        </p>
        <div className="mx-1 flex rounded-xl border border-stone-500 py-1 outline-1 focus-within:outline focus-within:outline-stone-500">
          <ChatInput
            className="mx-2 max-h-[148px] grow resize-none outline-none"
            input={input}
            setInput={setInput}
            handleInput={handleInput}
            placeholder="Chat with your Assistant"
          />
          <button className="mr-1" onClick={() => handleInput(input)}>
            <CircleArrowUp />
            <span className="sr-only">Submit chat</span>
          </button>
        </div>
        <button
          className="inline-flex items-center gap-2 self-center rounded-lg border-2 border-stone-700 bg-stone-200 px-4 py-1 hover:bg-stone-300"
          onClick={() => setShowDiscover(true)}
        >
          <Sparkles className="fill-yellow-200" />
          <span className="font-medium">Discover Apps</span>
        </button>
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
