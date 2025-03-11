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
  - state? ("new" | "deleted")
  - name (string)
  - prevName? (string) //renamed state
  - parentUuid? (string) //populated for all but root
  - prevParentUuid? (string) //moved state
  - order (number) //position within parent
  For folders:
  - collapsed (boolean)
  For notes:
  - content (string)
  - prevContent? (string) //edited state
  - checked (boolean)
  - starred (boolean)

- The root node is a folder with uuid "0"

NotesState constructs a tree from the node objects and adds the following keys:

- id (number)
- depth (number)
- path (string)
- ancestorUuids (string[]) //parent, grandparent, etc.
- display (boolean) //whether to display the node (i.e. are any of its parents collapsed?)
- inContext (boolean) //see Info.js
For folders:
- childrenUuids (string[]) //just children (not grandchildren, etc.)

- id is an integer that's easy for the assistant to reference vs. a long uuid
- The root node has id 0, and the remaining nodes 1...n in depth first order
- tree is an array of nodes, with the index in the array being the node's id

Use NotesState to manage all state. It has properties:
- currentNodeUuid (string)
- currentNode (Node)
- nodes ({[uuid]: Node})
- tree (Node[])

And methods:
- subscribe(prop): for use with useSyncExternalStore, supports tree and currentNode
- getSnapshot(prop): for use with useSyncExternalStore, supports tree and currentNode
- setCurrentNodeUuid(newCurrentNodeUuid)
- getDescendants(uuid)
- updateNode(node)
- addNode(node)
- deleteNode(uuid)
- approveChange(uuid)
- rejectChange(uuid)
- approveAllChanges()
- rejectAllChanges()

NotesState also implements context and API. See NotesState.context
*/

let api, notesState;

async function init() {
  const allData = await requestGetAllData();
  const { currentNodeUuid, ...nodes } = allData;
  notesState = new NotesState(nodes, currentNodeUuid);
  api = {
    addNote: notesState.apiAddNote,
    appendToNote: notesState.apiAppendToNote,
    replaceNote: notesState.apiReplaceNote,
    editNote: notesState.apiEditNote,
    renameNode: notesState.apiRenameNode,
    moveNodes: notesState.apiMoveNodes,
    deleteNodes: notesState.apiDeleteNodes,
  };
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

export { init, context, api };
