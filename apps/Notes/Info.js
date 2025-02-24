import React from "react";
import ModalOverlay from "@components/ModalOverlay.js";

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
            <li>They are in the same folder as your current note</li>
            <li>They are in any parent folder above your current note</li>
          </ul>
        </li>
      </ol>
      <p>
        Notes that will be included in the chat are shown in bold in the
        sidebar.
      </p>
      <p>Double click on a folder or note in the sidebar to rename it.</p>
    </div>
  );
}

function Info({ setModal }) {
  return (
    <ModalOverlay
      modal={<InfoInner />}
      onClose={() => {
        setModal(null);
      }}
      fullScreen={true}
    />
  );
}

export default Info;
