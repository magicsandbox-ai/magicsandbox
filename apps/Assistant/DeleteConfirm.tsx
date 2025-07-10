import React from "react";
import Confirm from "@components/Confirm.tsx";
import type { AssistantRefObject, Conversation } from "./AssistantState.ts";

function DeleteConfirm({
  assistantRef,
  setShowDelete,
  currentConversation,
}: {
  assistantRef: AssistantRefObject;
  setShowDelete: (show: boolean) => void;
  currentConversation: Pick<Conversation, "conversationId" | "messages">;
}) {
  let header;
  if (currentConversation.messages.length > 0) {
    header = `Delete chat?`;
  } else {
    header = `Delete chats?`;
  }
  const buttons = [
    {
      text: "Cancel",
      className: "bg-stone-300 hover:bg-stone-400 text-black w-48",
      onClick: () => setShowDelete(false),
    },
  ];
  if (currentConversation.messages.length > 0) {
    buttons.push({
      text: "Delete Current Chat",
      className: "bg-red-500 hover:bg-red-600 text-white w-48",
      onClick: () => {
        assistantRef.current.handleDeleteConversations([
          currentConversation.conversationId,
        ]);
        setShowDelete(false);
      },
    });
  }
  buttons.push({
    text: "Delete All Chats",
    className: "bg-red-800 hover:bg-red-900 text-white w-48",
    onClick: () => {
      assistantRef.current.handleDeleteConversations(null);
      setShowDelete(false);
    },
  });
  return (
    <Confirm
      onClose={() => setShowDelete(false)}
      header={header}
      buttons={buttons}
    />
  );
}

export default DeleteConfirm;
