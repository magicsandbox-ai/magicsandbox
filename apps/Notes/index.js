import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { usePersistentState } from "@magicsandbox.ai/hooks";
import { Toasts } from "@components/Toasts.js";
import SideBar from "./SideBar.js";
import Info from "./Info.js";
import Note from "./Note.js";
import DeleteConfirm from "./DeleteConfirm.js";
import Search from "./Search.js";
import { context as _context } from "./context.js";
import { addNote as _addNote } from "./api.js";
import { generateUuid } from "./utils.js";
import { createTree } from "./createTree.js";

/*
The database has keys:

- currentNodeUuid (string): the current selected node uuid
- [uuid] (object): all other keys map uuids to node objects with keys:
  - uuid (string)
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
- The nodes are stored in nodesRef, not state, to avoid unnecessary rerendering
- Make any changes by mutating nodesRef
- Then, if you mutated content, call updateContent
- If you mutated content and prevContent, call updatePrevContent
- For all other changes, call updateTree

tree is a modified view of nodesRef that maps ids to node objects and adds keys:
- id (number)
- depth (number)
- ancestorNames (string[])
- ancestorUuids (string[]) //parent, grandparent, etc.
- inContext (boolean)
For folders:
- childrenUuids (string[]) //just children (not grandchildren, etc.)
For notes, these keys are **removed**:
- content (string)
- prevContent (string)

Notes:
- treeRef uses integer ids to make them easier for the assistant to reference vs. a long uuid
- The root node has id 0, and the remaining nodes 1...n in depth first order
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
      parentUuid: null,
      collapsed: false,
    },
    [defaultUuid]: {
      uuid: defaultUuid,
      name: "New Note",
      parentUuid: "0",
      order: 0,
      content: "",
      checked: false,
      starred: false,
    },
  };
  const allData = await requestGetAllData();
  const { currentNodeUuid, ...nodes } = allData;
  const initcurrentNodeUuid = currentNodeUuid || defaultUuid;
  const initNodes = nodes || defaultNodes;
  createRoot(document.getElementById("root")).render(
    <App initcurrentNodeUuid={initcurrentNodeUuid} initNodes={initNodes} />,
  );
  return context();
}

function App({ initcurrentNodeUuid, initNodes }) {
  const [tree, setTree] = useState(createTree(initNodes, initcurrentNodeUuid));
  const [currentNodeUuid, setcurrentNodeUuid] = usePersistentState(
    "currentNodeUuid",
    initcurrentNodeUuid,
  );
  const [showInfo, setShowInfo] = useState(false);
  const [deleteUuid, setDeleteUuid] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  const nodesRef = useRef(initNodes);
  const toastsRef = useRef(null);

  function updateTree() {
    setTree(createTree(nodesRef.current, currentNodeUuid));
  }

  let modalComponent;
  if (deleteUuid) {
    modalComponent = (
      <DeleteConfirm
        {...{
          deleteUuid,
          setDeleteUuid,
          nodesRef,
          updateTree,
          toastsRef,
        }}
      />
    );
  } else if (showSearch) {
    modalComponent = (
      <Search
        {...{
          tree,
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
          tree,
          updateTree,
          currentNodeUuid,
          setcurrentNodeUuid,
          setShowInfo,
          setDeleteUuid,
          setShowSearch,
        }}
      />
      {!("childrenUuids" in nodesRef.current[currentNodeUuid]) && (
        <Note
          key={currentNodeUuid}
          {...{
            appState,
            currentNodeUuid,
            setcurrentNodeUuid,
            nodesRef,
          }}
        />
      )}
      {modalComponent}
      <Toasts className="top-2" ref={toastsRef} />
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
