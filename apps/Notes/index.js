import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Toasts } from "@components/Toasts.js";
import SideBar from "./SideBar.js";
import Info from "./Info.js";
import Note from "./Note.js";
import DeleteConfirm from "./DeleteConfirm.js";
import Search from "./Search.js";
import { context as _context } from "./context.js";
import NotesState from "./NotesState.js";

/*
The database has keys:

- currentNodeUuid (string): the current selected node uuid
- [uuid] (object): all other keys map uuids to Node objects with keys:
  - uuid (string)
  - type ("folder" | "note")
  - state? ("new" | "edited" | "renamed" | "moved" | "deleted")
  - name (string)
  - prevName? (string)
  - parentUuid? (string) //populated for all but root
  - prevParentUuid? (string)
  - order (number) //position within parent
  For folders:
  - collapsed (boolean)
  For notes:
  - content (string)
  - prevContent? (string)
  - checked (boolean)
  - starred (boolean)

Notes:
- The root node is a folder with uuid "0"

NotesState constructs a tree from the node objects and adds the following keys:

- id (number)
- depth (number)
- ancestorNames (string[])
- ancestorUuids (string[]) //parent, grandparent, etc.
- display (boolean) //whether to display the node (i.e. are any of its parents collapsed?)
- inContext (boolean) //see Info.js
For folders:
- childrenUuids (string[]) //just children (not grandchildren, etc.)

Notes:
- id is an integer that's easy for the assistant to reference vs. a long uuid
- The root node has id 0, and the remaining nodes 1...n in depth first order
- tree is an array of nodes, with the index in the array being the node's id

Use NotesState to manage all state. It has methods:
- setCurrentNodeUuid(newCurrentNodeUuid)
- getDescendants(uuid)
- updateNode(node)
- addNode(node)
- deleteNode(uuid)

NotesState also implements the API. See context.js
*/

let notesState;

async function init() {
  const allData = await requestGetAllData();
  const { currentNodeUuid, ...nodes } = allData;
  notesState = new NotesState(nodes, currentNodeUuid);
  createRoot(document.getElementById("root")).render(
    <App initcurrentNodeUuid={currentNodeUuid} initNodes={nodes} />,
  );
  return context();
}

function App() {
  const [showInfo, setShowInfo] = useState(false);
  const [deleteUuid, setDeleteUuid] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  const toastsRef = useRef(null);

  notesState._toastsRef = toastsRef;

  let modalComponent;
  if (deleteUuid) {
    modalComponent = (
      <DeleteConfirm
        {...{
          deleteUuid,
          setDeleteUuid,
          notesState,
        }}
      />
    );
  } else if (showSearch) {
    modalComponent = (
      <Search
        {...{
          notesState,
          setShowSearch,
        }}
      />
    );
  } else if (showInfo) {
    modalComponent = <Info setShowInfo={setShowInfo} />;
  }

  return (
    <div className="flex h-screen w-screen">
      <SideBar
        {...{
          notesState,
          setShowInfo,
          setDeleteUuid,
          setShowSearch,
        }}
      />
      <Note
        {...{
          notesState,
        }}
      />
      {modalComponent}
      <Toasts className="top-2" ref={toastsRef} />
    </div>
  );
}

function context() {
  return _context(notesState);
}

const api = {
  addNote: notesState.apiAddNote,
  appendToNote: notesState.apiAppendToNote,
  replaceNote: notesState.apiReplaceNote,
  editNote: notesState.apiEditNote,
  renameNode: notesState.apiRenameNode,
  moveNodes: notesState.apiMoveNodes,
  deleteNodes: notesState.apiDeleteNodes,
};

export { init, context, api };
