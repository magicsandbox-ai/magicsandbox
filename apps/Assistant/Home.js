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
  const favoritedApps = [
    {
      authorName: "magicsandbox.Dev",
    },
    {
      authorName: "magicsandbox.Docs",
    },
    {
      authorName: "kevin.FlappySnake",
    },
  ];
  const recentApps = [
    {
      authorName: "magicsandbox.Search",
    },
    {
      authorName: "magicsandbox.Flights",
    },
  ];
  return (
    <div className="flex h-full w-full flex-col">
      <p className="text-center text-2xl font-bold">
        What can I help you with?
      </p>
      <Input {...{ input, setInput, handleInput, chatLoading }} />
      <div className="flex grow">
        <AppList title="Favorited Apps" apps={favoritedApps} />
        <AppList title="Recent Apps" apps={recentApps} />
      </div>
    </div>
  );
}

function Chat({ messages, input, setInput, handleInput, chatLoading }) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="grow">
        <ChatDisplay messages={messages} />
      </div>
      <Input {...{ input, setInput, handleInput, chatLoading }} />
    </div>
  );
}

function Input({ input, setInput, handleInput, chatLoading }) {
  return (
    <div className="flex rounded-xl border border-stone-500 outline-1 focus-within:outline focus-within:outline-stone-500">
      <ChatInput
        className="mx-1 max-h-[124px] grow resize-none px-1 outline-0"
        input={input}
        setInput={setInput}
        handleInput={handleInput}
        placeholder="Chat with your Assistant"
      />
      <button onClick={handleInput}>
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
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto">
      <p className="text-lg font-bold">{title}</p>
      {apps.map((app) => (
        <div key={app.authorName}>{app.authorName}</div>
      ))}
    </div>
  );
}

export default Home;
