import React from "react";
import Confirm from "@components/Confirm.tsx";
import type { RiskState } from "./AssistantState.ts";

function RiskConfirm({
  risk,
  setRisk,
}: {
  risk: RiskState;
  setRisk: (risk: RiskState | null) => void;
}) {
  const { riskResponses, callback } = risk;
  const customContent = (
    <div className="flex flex-col gap-4">
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
      ? `Approve ${riskResponses.length} Requests?`
      : "Approve Request?";
  const buttons = [
    {
      text: "Approve",
      className: "bg-stone-300 hover:bg-stone-400 text-black w-32",
      onClick: () => {
        callback(true);
        setRisk(null);
      },
    },
    {
      text: "Deny",
      className: "bg-red-500 hover:bg-red-700 text-white w-32",
      onClick: () => {
        callback(false);
        setRisk(null);
      },
    },
    {
      text: "Learn More",
      className: "bg-blue-500 hover:bg-blue-700 text-white w-32",
      onClick: () => requestOpenUrl("?_app=magicsandbox.About"),
    },
  ];
  return (
    <Confirm
      onClose={() => {
        callback(false);
        setRisk(null);
      }}
      header={header}
      customContent={customContent}
      buttons={buttons}
    />
  );
}

function Details({ details }: { details: string[] }) {
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
