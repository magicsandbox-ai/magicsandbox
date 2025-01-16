/* global requestDownload */

import React from "react";
import Confirm from "@components/Confirm.js";

/*
learn more button
*/

function AssistantConfirm({ confirm }) {
  const { riskResponses, callback } = confirm;
  const customContent = (
    <div className="flex flex-col gap-4 break-words">
      {riskResponses.map((r, i) => {
        const { message, details, downloadDetails } = r;
        return (
          <div key={i}>
            {message && <p>{message}</p>}
            {details && <Details details={details} />}
            {downloadDetails && (
              <a
                className="cursor-pointer text-blue-600 hover:underline"
                onClick={() =>
                  requestDownload(
                    downloadDetails.filename,
                    downloadDetails.content,
                  )
                }
              >
                {downloadDetails.text}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
  const header =
    riskResponses.length > 1
      ? `Approve ${riskResponses.length} Sandbox Requests?`
      : "Approve Sandbox Request?";
  const buttons = [
    {
      text: "Approve",
      className: "bg-stone-300 hover:bg-stone-400 text-black",
      onClick: () => callback(true),
    },
    {
      text: "Deny",
      className: "bg-red-500 hover:bg-red-700 text-white",
      onClick: () => callback(false),
    },
  ];
  return (
    <Confirm
      onClose={() => callback(false)}
      header={header}
      customContent={customContent}
      buttons={buttons}
    />
  );
}

function Details({ details }) {
  return (
    <details>
      <summary>Details</summary>
      {details.map((d, i) => (
        <p key={i}>{d}</p>
      ))}
    </details>
  );
}

export default AssistantConfirm;
