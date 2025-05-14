import React from "react";

export default function Approve({
  containerClassName,
  approveText,
  approveOnClick,
  rejectText,
  rejectOnClick,
}: {
  containerClassName: string;
  approveText: string;
  approveOnClick: () => void;
  rejectText: string;
  rejectOnClick: () => void;
}) {
  const buttonStyle =
    "rounded-lg border border-stone-500 py-1 text-sm w-52 font-medium ";
  return (
    <div className={`${containerClassName} flex items-center justify-center`}>
      <button
        className={buttonStyle + "bg-green-200 hover:bg-green-300"}
        onClick={approveOnClick}
      >
        {approveText}
      </button>
      <button
        className={buttonStyle + "bg-red-200 hover:bg-red-300"}
        onClick={rejectOnClick}
      >
        {rejectText}
      </button>
    </div>
  );
}
