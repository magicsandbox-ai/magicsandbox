import React from "react";
import ModalOverlay from "@components/ModalOverlay.tsx";

function InfoInner() {
  return (
    <div className="space-y-3 p-3">
      <p>magicsandbox.Notes helps you organize and chat with your notes.</p>
      <p>
        When you chat with your Assistant, it can always see the current note
        you have open.
      </p>
      <p>You can add additional notes to the chat by:</p>
      <ol className="ml-6 list-outside list-decimal space-y-2">
        <li>Clicking the checkbox next to a note in the sidebar</li>
        <li>Using Ctrl+Click in the sidebar to select notes and folders</li>
        <li>
          Starring a note by clicking the star icon next to it in the sidebar.
          Starred notes are included in the chat when:
          <ul className="ml-6 list-outside list-disc space-y-1">
            <li>They are in the same folder as the note you have open</li>
            <li>They are in any parent folder above the note you have open</li>
          </ul>
        </li>
      </ol>
      <p>
        Notes that will be included in the chat are shown in bold in the
        sidebar.
      </p>
    </div>
  );
}

function Info({ setShowInfo }: { setShowInfo: (showInfo: boolean) => void }) {
  return (
    <ModalOverlay
      modal={<InfoInner />}
      onClose={() => {
        setShowInfo(false);
      }}
      fullScreen={true}
    />
  );
}

export default Info;
