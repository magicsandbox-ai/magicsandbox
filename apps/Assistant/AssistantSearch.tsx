import React from "react";
import Search from "@components/Search.tsx";
import type {
  AssistantRefObject,
  ConversationsRefObject,
  Message,
} from "./AssistantState.ts";

function AssistantSearch({
  setShowSearch,
  assistantRef,
  conversationsRef,
}: {
  setShowSearch: (show: boolean) => void;
  assistantRef: AssistantRefObject;
  conversationsRef: ConversationsRefObject;
}) {
  const nodes = Object.values(conversationsRef.current).map((conversation) => ({
    key: conversation.conversationId,
    name: conversation.summary || "New Chat",
    content: conversation.messages.map(formatMessage).join("\n"),
  }));
  return (
    <Search
      nodes={nodes}
      onClose={() => setShowSearch(false)}
      onClickResult={(node) => {
        assistantRef.current.handleSwitchConversation(node.key);
        setShowSearch(false);
      }}
      placeholder="Search chats..."
    />
  );
}

export default AssistantSearch;

function formatMessage(message: Message) {
  if (message.role === "system" || message.role === "display") return "";
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
