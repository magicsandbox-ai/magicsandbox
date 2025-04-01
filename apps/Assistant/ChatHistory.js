import React, { useState, memo } from "react";
import { ModelPicker } from "./ModelPicker.js";
import { Menu, Search, Trash2, Plus } from "lucide-react";

const ChatHistory = memo(function ChatHistory({
  conversationSummaries,
  currentConversationId,
  model,
  setModel,
  assistantRef,
  setShowSearch,
  setShowDelete,
}) {
  const [show, setShow] = useState(window.innerWidth > 768);

  function handleSearch() {
    setShowSearch(true);
  }

  function handleDelete() {
    setShowDelete(true);
  }

  if (show) {
    return (
      <nav className="absolute z-50 flex h-full w-64 flex-col gap-3 border-r border-stone-500 bg-stone-100 pt-3 md:static">
        <div className="mx-3 flex justify-between">
          <button onClick={() => setShow(!show)}>
            <Menu />
            <span className="sr-only">Close menu</span>
          </button>
          <button onClick={() => handleSearch()}>
            <Search />
            <span className="sr-only">Search</span>
          </button>
          <button onClick={() => handleDelete()}>
            <Trash2 />
            <span className="sr-only">Delete</span>
          </button>
          <button onClick={() => assistantRef.current.handleNewConversation()}>
            <Plus />
            <span className="sr-only">New chat</span>
          </button>
        </div>
        <div className="mx-3">
          <ModelPicker model={model} setModel={setModel} />
        </div>
        <div className="grow space-y-3 overflow-y-auto px-3">
          {conversationSummaries
            .filter(({ summary }) => summary !== null)
            .map(({ conversationId, summary }) => (
              <ChatButton
                key={conversationId}
                {...{
                  conversationId,
                  summary,
                  currentConversationId,
                  assistantRef,
                }}
              />
            ))}
        </div>
      </nav>
    );
  } else {
    return (
      <button className="absolute ml-3 mt-3" onClick={() => setShow(!show)}>
        <Menu />
        <span className="sr-only">Open menu</span>
      </button>
    );
  }
});

function ChatButton({
  conversationId,
  summary,
  currentConversationId,
  assistantRef,
}) {
  const [renameValue, setRenameValue] = useState(null);

  summary = summary || "New Chat";

  function handleRename(e) {
    e.preventDefault();
    const newName = renameValue.trim();
    if (newName.length > 0) {
      assistantRef.current.handleUpdateConversation({
        conversationId,
        summary: newName,
      });
    }
    setRenameValue(null);
  }

  const baseClassName = "w-full rounded-lg px-1 py-0.5 text-sm";

  if (renameValue !== null) {
    return (
      <form onSubmit={handleRename} className="flex">
        <input
          className={`${baseClassName} border border-stone-500 bg-white`}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRename}
          autoFocus
          onFocus={(e) => e.target.select()}
          aria-label="Rename"
        />
      </form>
    );
  }

  return (
    <button
      className={`${baseClassName} truncate hover:bg-stone-300 ${
        currentConversationId === conversationId
          ? "bg-stone-200 outline outline-1 outline-stone-500"
          : ""
      }`}
      onClick={() =>
        assistantRef.current.handleSwitchConversation(conversationId)
      }
      onDoubleClick={() => setRenameValue(summary)}
      title={summary}
    >
      {summary}
    </button>
  );
}

export default ChatHistory;
