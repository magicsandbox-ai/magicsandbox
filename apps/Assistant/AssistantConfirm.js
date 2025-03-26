import React from "react";
import Confirm from "@components/Confirm.js";

function AssistantConfirm({ confirm, setConfirm }) {
  const { header, message, callback } = confirm;
  const buttons = [
    {
      text: "Approve",
      className: "bg-stone-300 hover:bg-stone-400 text-black w-32",
      onClick: () => {
        callback(true);
        setConfirm(null);
      },
    },
    {
      text: "Deny",
      className: "bg-red-500 hover:bg-red-700 text-white w-32",
      onClick: () => {
        callback(false);
        setConfirm(null);
      },
    },
  ];
  return (
    <Confirm
      onClose={() => {
        callback(false);
        setConfirm(null);
      }}
      header={header}
      message={message}
      buttons={buttons}
    />
  );
}

export default AssistantConfirm;
