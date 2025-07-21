import React, { useState, memo, useSyncExternalStore } from "react";
import { ModelPicker } from "./ModelPicker.tsx";
import { Menu, Search, Trash2, Plus } from "lucide-react";
import Tooltip from "./Tooltip.tsx";
import type { AssistantState } from "./AssistantState.ts";

const ChatHistory = memo(function ChatHistory({
  assistantState,
  currentConversationId,
  setShowSearch,
  setShowDelete,
  show,
  setShow,
}: {
  assistantState: AssistantState;
  currentConversationId: string;
  setShowSearch: (show: boolean) => void;
  setShowDelete: (show: boolean) => void;
  show: boolean;
  setShow: (show: boolean) => void;
}) {
  const conversationSummaries = useSyncExternalStore(
    assistantState.subscribe("conversationSummaries"),
    assistantState.getSnapshot("conversationSummaries"),
  );

  function handleSearch() {
    setShowSearch(true);
  }

  function handleDelete() {
    setShowDelete(true);
  }

  if (show) {
    return (
      <nav className="absolute z-30 flex h-full w-64 flex-none flex-col gap-3 border-r border-stone-500 bg-stone-100 pt-3 md:static">
        <div className="mx-3 flex justify-between">
          <Tooltip text="Close menu" position="right">
            <button id="menu-button" onClick={() => setShow(!show)}>
              <Menu />
              <span className="sr-only">Close menu</span>
            </button>
          </Tooltip>
          <Tooltip text="Search chats" position="bottom">
            <button onClick={() => handleSearch()}>
              <Search />
              <span className="sr-only">Search chats</span>
            </button>
          </Tooltip>
          <Tooltip text="Delete chat" position="bottom">
            <button onClick={() => handleDelete()}>
              <Trash2 />
              <span className="sr-only">Delete chat</span>
            </button>
          </Tooltip>
          <Tooltip text="New chat" position="bottom">
            <button
              onClick={() => {
                assistantState.handleNewConversation();
                if (window.innerWidth < 768) {
                  setShow(false); //close on mobile when clicking new chat
                }
              }}
            >
              <Plus />
              <span className="sr-only">New chat</span>
            </button>
          </Tooltip>
        </div>
        <div id="model-picker-container" className="mx-3">
          <ModelPicker assistantState={assistantState} />
        </div>
        <div className="grow scroll-py-3 space-y-3 overflow-y-auto px-3">
          {conversationSummaries
            .filter(({ summary }) => summary !== null)
            .map(({ conversationId, summary }) => (
              <ChatButton
                key={conversationId}
                {...{
                  conversationId,
                  summary,
                  currentConversationId,
                  assistantState,
                  setShow,
                }}
              />
            ))}
        </div>
      </nav>
    );
  } else {
    return (
      <div className="absolute z-10 ml-3 mt-3">
        <Tooltip text="Open menu" position="right">
          <button id="menu-button" onClick={() => setShow(!show)}>
            <Menu />
            <span className="sr-only">Open menu</span>
          </button>
        </Tooltip>
      </div>
    );
  }
});

function ChatButton({
  conversationId,
  summary,
  currentConversationId,
  assistantState,
  setShow,
}: {
  conversationId: string;
  summary: string | null;
  currentConversationId: string;
  assistantState: AssistantState;
  setShow: (show: boolean) => void;
}) {
  const [renameValue, setRenameValue] = useState<string | null>(null);

  summary = summary || "New Chat";

  function handleRename(
    e: React.FormEvent<HTMLFormElement> | React.FocusEvent<HTMLInputElement>,
  ) {
    e.preventDefault();
    const newName = renameValue?.trim();
    if (newName && newName.length > 0) {
      assistantState.handleUpdateConversation({
        conversationId,
        summary: newName,
      });
    }
    setRenameValue(null);
  }

  const baseClassName = "chat-button w-full rounded-lg px-1 py-0.5 text-sm";

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
          enterKeyHint="done"
        />
      </form>
    );
  }

  return (
    <button
      ref={(el) => {
        if (el && currentConversationId === conversationId) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }}
      className={`${baseClassName} truncate hover:bg-stone-300 ${
        currentConversationId === conversationId
          ? "bg-stone-200 outline outline-1 outline-stone-500"
          : ""
      }`}
      onClick={() => {
        assistantState.handleSwitchConversation(conversationId);
        if (window.innerWidth < 768) {
          setShow(false); //close on mobile when clicking a chat
        }
      }}
      onDoubleClick={() => setRenameValue(summary)}
      title={summary}
    >
      {summary}
    </button>
  );
}

export default ChatHistory;
