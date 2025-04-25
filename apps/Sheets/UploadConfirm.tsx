import React from "react";
import Confirm from "@components/Confirm.js";

function UploadConfirm({
  setShowUploadConfirm,
  fileInputRef,
}: {
  setShowUploadConfirm: (show: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const header = "Upload new .xlsx file?";
  const message =
    "This will overwrite your current spreadsheet. Make sure to download your current spreadsheet to save your progress.";

  const buttons = [
    {
      text: "Continue",
      className: "bg-blue-500 hover:bg-blue-600 text-white w-32",
      onClick: () => {
        setShowUploadConfirm(false);
        fileInputRef.current?.click();
      },
    },
    {
      text: "Cancel",
      className: "bg-gray-200 hover:bg-gray-300 text-gray-700 w-32",
      onClick: () => setShowUploadConfirm(false),
    },
  ];

  return (
    <Confirm
      onClose={() => setShowUploadConfirm(false)}
      header={header}
      message={message}
      buttons={buttons}
      customContent={undefined}
    />
  );
}

export default UploadConfirm;
