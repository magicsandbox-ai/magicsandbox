import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import SideBar from "./SideBar.js";

/*
magicsandbox.Notes helps you organize and chat with your notes.

When you chat with your Assistant, it can always see the current note you have open. You can add additional notes to the chat by:

1. Clicking the checkbox next to a note in the sidebar
2. Using Ctrl+Click or Shift+Click in the sidebar to select notes and folders
3. Starring a note by clicking the star icon next to it in the sidebar. Starred notes are included in the chat when:
   - They are in the same folder as your current note
   - They are in any parent folder above your current note

Notes that will be included in the chat are shown in bold in the sidebar.

Double click on a folder or note in the sidebar to rename it.
*/

/*
nodes is an object mapping id to objects with keys:
- id: number
- name: string

Keys for folders:
- collapsed?: boolean
- childrenIds?: number[]

Keys for notes:
- content?: string
- checked?: boolean
- starred?: boolean

the root node is a folder with id 0. it will always have at least one child
*/

async function init() {
  const defaultNodes = {
    0: {
      id: 0,
      name: "root",
      collapsed: false,
      childrenIds: [1],
    },
    1: {
      id: 1,
      name: "New Note",
      content: "",
      checked: false,
      starred: false,
    },
  };
  const initNodes = (await requestGetData("nodes")) || defaultNodes;
  const initCurrentNodeId = (await requestGetData("currentNodeId")) || 1;
  createRoot(document.getElementById("root")).render(
    <App initNodes={initNodes} initCurrentNodeId={initCurrentNodeId} />,
  );
  return context();
}

function App({ initNodes, initCurrentNodeId }) {
  const [nodes, setNodes] = useState(initNodes);
  const [currentNodeId, setCurrentNodeId] = useState(initCurrentNodeId);

  useEffect(() => {
    requestPutData("nodes", nodes).catch(console.error);
  }, [nodes]);

  useEffect(() => {
    requestPutData("currentNodeId", currentNodeId).catch(console.error);
  }, [currentNodeId]);

  function handleChange(e) {
    setNodes((nodes) => ({
      ...nodes,
      [currentNodeId]: { ...nodes[currentNodeId], content: e.target.value },
    }));
  }

  return (
    <div className="flex h-screen w-screen">
      <SideBar
        {...{
          nodes,
          setNodes,
          currentNodeId,
          setCurrentNodeId,
        }}
      />
      <textarea
        className="grow resize-none border-none p-4"
        value={nodes[currentNodeId].content}
        onChange={handleChange}
        placeholder="Add a note..."
      />
    </div>
  );
}

function context() {
  const contextSections = [];
  if (api.folders) {
    contextSections.push(`The user has the following folders:
<folders>
${api.folders.join("\n")}
</folders>`);
  }
  if (api.currentFolder) {
    contextSections.push(`The user currently has the following folder open:
<currentFolder>
${api.currentFolder}
</currentFolder>`);
  }
  if (api.currentNotes) {
    contextSections.push(`The notes in the current folder are:
<currentNotes>
${api.currentNotes}
</currentNotes>`);
  }

  return `# magicsandbox.Notes

This is a simple notes app where users can create and edit notes in folders.

## Context

${contextSections.join("\n\n")}

## API

### app.api.addNote(folder: string, note: string)

Add a note to the specified folder. If the folder doesn't exist, it will be created.

## Instructions

- Only use \`app.api.addNote\` to add a note if the user specifically asked you to. Pick the most appropriate folder for the note. If none of the existing folders are appropriate, create a new folder.
- Otherwise, answer the user's question using the current notes as context.
`;
}

const api = {};

export { init, context, api };
