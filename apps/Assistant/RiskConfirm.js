/* global requestDownload requestOpenUrl */

import React from "react";
import Confirm from "@components/Confirm.js";

function RiskConfirm({ risk }) {
  const { riskResponses, callback } = risk;
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
      className: "bg-stone-300 hover:bg-stone-400 text-black w-32",
      onClick: () => callback(true),
    },
    {
      text: "Deny",
      className: "bg-red-500 hover:bg-red-700 text-white w-32",
      onClick: () => callback(false),
    },
    {
      text: "Learn More",
      className: "bg-blue-500 hover:bg-blue-700 text-white w-32",
      onClick: () => requestOpenUrl("?app=magicsandbox.About"), //todo link to a section
      closeOnClick: false,
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

export default RiskConfirm;
