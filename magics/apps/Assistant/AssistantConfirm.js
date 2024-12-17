/* global requestDownload */

import React from 'react';
import Confirm from 'shared/Confirm.js';

/*
collapse details
learn more button
maybe identify some as high risk?
*/

function AssistantConfirm({ confirm }) {
  const { riskResponses, callback } = confirm;
  const customContent = (
    <div className="flex flex-col gap-4">
      {riskResponses.map((r, i) => {
        const { message, details, downloadDetails } = r;
        return (
          <div key={i}>
            {message && <div>{message}</div>}
            {details && details.map((d, i) => <div key={i}>{d}</div>)}
            {downloadDetails && (
              <a
                onClick={() =>
                  requestDownload({
                    filename: downloadDetails.filename,
                    content: downloadDetails.content,
                  })
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
  const buttons = [
    {
      text: 'Approve',
      className: 'bg-stone-300 hover:bg-stone-400 text-black',
      onClick: () => callback(true),
    },
    {
      text: 'Deny',
      className: 'bg-red-500 hover:bg-red-700 text-white',
      onClick: () => callback(false),
    },
  ];
  return (
    <Confirm
      onClose={() => callback(false)}
      header="Approve Sandbox Requests?"
      customContent={customContent}
      buttons={buttons}
    />
  );
}

export default AssistantConfirm;
