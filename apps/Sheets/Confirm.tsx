import React from "react";
import _Confirm from "@components/Confirm.js";

function Confirm({
  setShowConfirm,
  fileInputRef,
  mode = "upload",
  onNewSpreadsheet,
}: {
  setShowConfirm: (show: "upload" | "new" | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  mode?: "upload" | "new";
  onNewSpreadsheet?: () => void;
}) {
  const header =
    mode === "new" ? "Create new spreadsheet?" : "Upload new .xlsx file?";
  const message =
    mode === "new"
      ? "This will overwrite your current spreadsheet with a new blank one.\nMake sure to download your current spreadsheet to save your progress."
      : "This will overwrite your current spreadsheet.\nMake sure to download your current spreadsheet to save your progress.";

  const buttons = [
    {
      text: "Continue",
      className: "bg-blue-500 hover:bg-blue-600 text-white w-32",
      onClick: () => {
        setShowConfirm(null);
        if (mode === "new") {
          onNewSpreadsheet?.();
        } else {
          fileInputRef.current?.click();
        }
      },
    },
    {
      text: "Cancel",
      className: "bg-gray-200 hover:bg-gray-300 text-gray-700 w-32",
      onClick: () => setShowConfirm(null),
    },
  ];

  return (
    <_Confirm
      onClose={() => setShowConfirm(null)}
      header={header}
      message={message}
      buttons={buttons}
      customContent={undefined}
    />
  );
}

export default Confirm;
