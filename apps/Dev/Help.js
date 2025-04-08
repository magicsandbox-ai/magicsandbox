import React from "react";
import ModalOverlay from "@components/ModalOverlay.js";
import ExternalLink from "@components/ExternalLink.js";

function HelpInner() {
  return (
    <div className="space-y-3 p-3">
      <p>
        magicsandbox.Dev helps you develop, preview, and publish Magic Sandbox
        apps.
      </p>
      <p>
        Refer to the{" "}
        <ExternalLink
          href="https://magicsandbox.ai?_app=magicsandbox.Docs#publishing"
          className="underline"
        >
          docs
        </ExternalLink>{" "}
        to get started.
      </p>
      <p>Tips:</p>
      <ol className="ml-6 list-outside list-decimal space-y-2">
        <li>Use Ctrl+S to save your changes and update the preview</li>
        <li>
          Click &quot;Test App API&quot; to switch modes:
          <ul className="ml-6 list-disc">
            <li>
              Default mode: When you chat with your assistant, it helps you
              develop your app in magicsandbox.Dev
            </li>
            <li>
              API Test mode: When you chat with your assistant, it interacts
              directly with your app, helping you test its API
            </li>
          </ul>
        </li>
      </ol>
    </div>
  );
}

function Help({ setShowHelp }) {
  return (
    <ModalOverlay
      modal={<HelpInner />}
      onClose={() => {
        setShowHelp(false);
      }}
      fullScreen={true}
    />
  );
}

export default Help;
