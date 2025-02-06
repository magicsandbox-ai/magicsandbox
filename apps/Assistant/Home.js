import React, { useState } from "react";
import { ChatInput } from "./Chat.js";
import { CircleArrowUp, Loader } from "lucide-react";

function Home({
  //setModal,
  settingsRef,
  toastsRef,
  assistantRef,
  messages,
  chatLoading,
  appData,
}) {
  const [input, setInput] = useState("");

  async function handleInput(input) {
    if (input === "" || !settingsRef.current || chatLoading) return;
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
        <Input {...{ input, setInput, handleInput, chatLoading }} />
      </div>
      <AppList appData={appData} />
    </div>
  );
}

function Input({ input, setInput, handleInput, chatLoading }) {
  return (
    <div className="mx-1 flex rounded-xl border border-stone-500 py-1 outline-1 focus-within:outline focus-within:outline-stone-500">
      <ChatInput
        className="mx-2 max-h-[148px] grow resize-none outline-0"
        input={input}
        setInput={setInput}
        handleInput={handleInput}
        placeholder="Chat with your Assistant"
      />
      <button className="mr-1" onClick={handleInput}>
        {chatLoading ? <Loader className="animate-spin" /> : <CircleArrowUp />}
      </button>
    </div>
  );
}

function AppList({ appData }) {
  const [state, setState] = useState("Favorited");

  const states = ["Favorited", "Recent", "Published", "Blocked"];
  const displayApps = appData.filter((app) => app[state.toLowerCase()]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-6">
        {states.map((s) => (
          <AppListButton
            key={s}
            active={s === state}
            onClick={() => setState(s)}
          >
            {s}
          </AppListButton>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-lg font-medium">{`${state} Apps`}</p>
        {displayApps.length > 0 ? (
          displayApps.map((app) => <AppCard key={app.id} app={app} />)
        ) : (
          <p>Nothing to see here yet!</p>
        )}
      </div>
    </div>
  );
}

function AppListButton({ active, onClick, children }) {
  return (
    <button
      className={`w-20 rounded-md py-px hover:bg-stone-300 ${
        active
          ? "border-2 border-stone-700 bg-stone-200 font-medium"
          : "border border-stone-500 bg-stone-100"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/*
- id, description, icon for deprecated
- expand to see minCost, finalCost, deprecated explained
- expand to edit and pin a version? link to homepage?
- buttons to (un)favorite, (un)block - pass down setAppData
- add bang?
*/

function AppCard({ app }) {
  return <div>{app.id.split("@")[0]}</div>;
}

export default Home;
