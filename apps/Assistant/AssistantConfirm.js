import React from "react";
import Confirm from "@components/Confirm.js";

function AssistantConfirm({ confirm }) {
  const { header, message, callback } = confirm;
  const buttons = [
    {
      text: "Approve",
      className: "bg-stone-300 hover:bg-stone-400 text-black w-32",
      onClick: () => callback(true),
    },
    {
      text: "Deny",
      className: "bg-red-500 hover:bg-red-700 text-white w-32",
      onClick: () => callback(false),
    },
  ];
  return (
    <Confirm
      onClose={() => callback(false)}
      header={header}
      message={message}
      buttons={buttons}
    />
  );
}

export default AssistantConfirm;
