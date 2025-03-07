import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { usePersistentState } from "@magicsandbox.ai/hooks";
import SideBar from "./SideBar.js";
import Info from "./Info.js";
import Note from "./Note.js";
import DeleteConfirm from "./DeleteConfirm.js";
import Search from "./Search.js";
import { context as _context } from "./context.js";
import { addNote as _addNote } from "./api.js";
import { generateUuid } from "./utils.js";
import { updateTreeRef } from "./updateTreeRef.js";

/*
The database has keys:

- nodes (object): an object mapping uuids to objects with keys:
  - uuid (string)
  - name (string)
  - state? ("new" | "edited" | "renamed" | "moved" | "deleted" | null)
  - stateDetails? (string | null)
  For folders:
  - collapsed (boolean)
  - childrenUuids (string[])
  For notes:
  - checked (boolean)
  - starred (boolean)
- prevNodes? (object): previous version of nodes
- currentNodeUuid (string): the current selected node uuid
- [uuid] (object): all other keys map uuids to objects with keys:
  - content: string
  - prevContent: string

Notes:
- The root node is a folder with uuid "0"
- prevNodes is used to revert assistant changes to nodes (renames, moves, deletes)
- content is stored separately from nodes to prevent unnecessary rerendering and improve data saving and syncing performance
- prevContent is used for display assistant changes to content (edits)

treeRef is a modified view of nodes that maps ids to node objects and adds keys:
- id (number)
- depth (number)
- parentNames (string[])
- parentUuid (number)
- parentUuids (number[])
- inContext (boolean)
For notes:
- content (string)
- newContent (string)

Notes:
- treeRef uses integer ids to make them easier for the assistant to reference vs. a long uuid
- The root node has id 0, and the remaining nodes 1...n in depth first order
- Any updates to nodes automatically update treeRef
- Any updates to content/prevContent must keep treeRef in sync
*/

const appState = {
  //nodesRef...or tree?
  //currentNodeUuid
  //setNewContent
};

async function init() {
  const defaultUuid = generateUuid();
  const defaultNodes = {
    ["0"]: {
      uuid: "0",
      name: "root",
      collapsed: false,
      childrenUuids: [defaultUuid],
    },
    [defaultUuid]: {
      uuid: defaultUuid,
      name: "New Note",
      content: "",
      checked: false,
      starred: false,
    },
  };
  const allData = await requestGetAllData();
  const { nodes, prevNodes, currentNodeUuid, ...contents } = allData;
  const initNodes = nodes || defaultNodes;
  const initPrevNodes = prevNodes || null;
  const initcurrentNodeUuid = currentNodeUuid || 1;
  const prevTreeRef = Object.fromEntries(
    //get contents into form expected by updateTreeRef
    Object.entries(contents).map(([uuid, { content, newContent }]) => [
      uuid,
      { uuid, content, newContent },
    ]),
  );
  const initTreeRef = updateTreeRef({
    nodes: initNodes,
    currentNodeUuid: initcurrentNodeUuid,
    prevTreeRef,
  });
  createRoot(document.getElementById("root")).render(
    <App
      initNodes={initNodes}
      initPrevNodes={initPrevNodes}
      initcurrentNodeUuid={initcurrentNodeUuid}
      initTreeRef={initTreeRef}
    />,
  );
  return context();
}

function App({ initNodes, initPrevNodes, initcurrentNodeUuid, initTreeRef }) {
  const [nodes, setNodes] = usePersistentState("nodes", initNodes);
  const [prevNodes, setPrevNodes] = usePersistentState(
    "prevNodes",
    initPrevNodes,
  );
  const [currentNodeUuid, setcurrentNodeUuid] = usePersistentState(
    "currentNodeUuid",
    initcurrentNodeUuid,
  );
  const [showInfo, setShowInfo] = useState(false);
  const [deleteUuid, setDeleteUuid] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  const treeRef = useRef(initTreeRef);

  useEffect(() => {
    treeRef.current = updateTreeRef({
      nodes,
      currentNodeUuid,
      prevTreeRef: treeRef.current,
    });
    setSearchResults(null); //no longer valid
  }, [nodes]);

  let modalComponent;
  if (deleteUuid) {
    modalComponent = (
      <DeleteConfirm
        {...{
          deleteUuid,
          setDeleteUuid,
          nodes,
          setNodes,
        }}
      />
    );
  } else if (showSearch) {
    modalComponent = (
      <Search
        {...{
          treeRef,
          setShowSearch,
          searchQuery,
          setSearchQuery,
          searchResults,
          setSearchResults,
          setcurrentNodeUuid,
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
          treeRef,
          setNodes,
          currentNodeUuid,
          setcurrentNodeUuid,
          setShowInfo,
          setDeleteUuid,
          setShowSearch,
        }}
      />
      {!("childrenUuids" in nodes[currentNodeUuid]) && (
        <Note
          key={currentNodeUuid}
          {...{
            appState,
            currentNodeUuid,
            setcurrentNodeUuid,
            treeRef,
          }}
        />
      )}
      {modalComponent}
    </div>
  );
}

function context() {
  return _context(appState);
}

const api = {
  addNote(parentId, note) {
    _addNote(appState, parentId, note);
  },
};

export { init, context, api };
