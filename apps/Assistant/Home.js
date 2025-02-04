import React, { useState } from "react";
import { ChatInput, ChatDisplay } from "./Chat.js";
import { CircleArrowUp, Loader } from "lucide-react";

function Home({
  //setModal,
  settingsRef,
  toastsRef,
  assistantRef,
  messages,
  chatLoading,
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

  if (messages.length === 0) {
    return <InitHome {...{ input, setInput, handleInput, chatLoading }} />;
  } else {
    return (
      <Chat {...{ messages, input, setInput, handleInput, chatLoading }} />
    );
  }
}

function InitHome({ input, setInput, handleInput, chatLoading }) {
  return (
    <div className="flex h-full w-full max-w-screen-lg flex-col self-center">
      <div className="flex h-1/2 flex-none flex-col justify-end pb-12">
        <p className="mb-6 text-center text-2xl font-bold md:text-3xl">
          What can I help you with?
        </p>
        <Input {...{ input, setInput, handleInput, chatLoading }} />
      </div>
      <div className="grow overflow-y-auto md:flex">
        <AppList title="Favorite Apps" apps={10} />
        <AppList title="Recent Apps" apps={25} />
        <AppList title="Published Apps" apps={3} />
      </div>
    </div>
  );
}

function Chat({ messages, input, setInput, handleInput, chatLoading }) {
  return (
    <div className="flex h-full w-full max-w-screen-lg flex-col self-center">
      <div className="grow">
        <ChatDisplay messages={messages} />
      </div>
      <Input {...{ input, setInput, handleInput, chatLoading }} />
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

function AppList({ title, apps }) {
  /*
  - id, description, icon for deprecated
  - expand to see minCost, finalCost, deprecated explained
  - expand to edit and pin a version? link to homepage?
  */
  apps = Array.from(new Array(apps), (_, i) => {
    return { authorName: `author${i}.App${i}` }; //fake data for now
  });
  return (
    <div className="flex grow flex-col items-center gap-2 overflow-y-auto">
      <p className="text-lg font-bold">{title}</p>
      {apps.map((app) => (
        <div key={app.authorName}>{app.authorName}</div>
      ))}
    </div>
  );
}

export default Home;
