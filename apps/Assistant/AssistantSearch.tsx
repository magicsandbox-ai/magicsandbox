import React from "react";
import Search from "@components/Search.tsx";
import type { AssistantState, Message } from "./AssistantState.ts";

function AssistantSearch({
  setShowSearch,
  assistantState,
}: {
  setShowSearch: (show: boolean) => void;
  assistantState: AssistantState;
}) {
  const nodes = Object.values(assistantState.conversations).map(
    (conversation) => ({
      key: conversation.conversationId,
      name: conversation.summary || "New Chat",
      content: conversation.messages.map(formatMessage).join("\n"),
    }),
  );
  return (
    <Search
      nodes={nodes}
      onClose={() => setShowSearch(false)}
      onClickResult={(node) => {
        assistantState.handleSwitchConversation(node.key);
        setShowSearch(false);
      }}
      placeholder="Search chats..."
    />
  );
}

export default AssistantSearch;

function formatMessage(message: Message) {
  if (message.role === "system") return "";
  const tagsToInclude = {
    user: new Set(["user_request"]), //exclude suggested_apps, app_context, user_highlighted_text, logs
    assistant: new Set([undefined]), //exclude open_app, intermediate_script, final_script
  };
  const messageTagsToInclude: Set<string | undefined> =
    tagsToInclude[message.role];
  return message.tags
    .filter((tag) => messageTagsToInclude.has(tag.tag))
    .map((tag) => tag.content)
    .join("");
}
