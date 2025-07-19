import React from "react";
import ConfirmComponent from "@components/Confirm.tsx";
import type { Confirm, AssistantState } from "./AssistantState.ts";

function AssistantConfirm({
  confirm,
  assistantState,
}: {
  confirm: Confirm;
  assistantState: AssistantState;
}) {
  const { header, message, callback } = confirm;
  const buttons = [
    {
      text: "Approve",
      className: "bg-stone-300 hover:bg-stone-400 text-black w-32",
      onClick: () => {
        callback(true);
        assistantState.setConfirm(null);
      },
    },
    {
      text: "Deny",
      className: "bg-red-500 hover:bg-red-700 text-white w-32",
      onClick: () => {
        callback(false);
        assistantState.setConfirm(null);
      },
    },
  ];
  return (
    <ConfirmComponent
      onClose={() => {
        callback(false);
        assistantState.setConfirm(null);
      }}
      header={header}
      message={message}
      buttons={buttons}
    />
  );
}

export default AssistantConfirm;
