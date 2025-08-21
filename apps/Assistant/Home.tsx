import React from "react";
import ChatInput from "./ChatInput.tsx";
import AppList from "./AppList.tsx";
import { CircleArrowUp, Sparkles } from "lucide-react";
import type { AppData, AssistantState } from "./AssistantState.ts";

function Home({
  assistantState,
  appData,
  setShowDiscover,
}: {
  assistantState: AssistantState;
  appData: AppData;
  setShowDiscover: (show: boolean) => void;
}) {
  return (
    <div className="h-full w-full max-w-screen-lg self-center">
      <div className="flex min-h-[50%] flex-col justify-end gap-6 pb-6">
        <p className="text-center text-2xl font-bold md:text-3xl">
          What can I help you with?
        </p>
        <div className="mx-1 flex rounded-xl border border-stone-500 py-1 outline-1 focus-within:outline focus-within:outline-stone-500">
          <ChatInput
            assistantState={assistantState}
            className="mx-2 max-h-[148px] grow resize-none outline-none"
            placeholder="Chat with your Assistant"
          />
          <button
            className="mr-1"
            onClick={() => assistantState.handleChatSubmit()}
          >
            <CircleArrowUp />
            <span className="sr-only">Submit chat</span>
          </button>
        </div>
        <button
          id="discover-button"
          className="inline-flex items-center gap-2 self-center rounded-lg border-2 border-stone-700 bg-stone-200 px-4 py-1 hover:bg-stone-300"
          onClick={() => setShowDiscover(true)}
        >
          <Sparkles className="fill-yellow-200" />
          <span className="font-medium">Discover Apps</span>
        </button>
      </div>
      <AppList appData={appData} assistantState={assistantState} />
    </div>
  );
}

export default Home;
