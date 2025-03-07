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

/*
The database has keys:

- nodes (object): an object mapping uuids to objects with keys:
  - uuid (string)
  - name (string)
  - state? ("new" | "edited" | "renamed" | "moved" | "deleted" | null)
  - stateDetails? (string | null)
  For folders:
  - collapsed (boolean)
  - childrenIds (number[])
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
- depth (number)
- parentNames (string[])
- parentId (number)
- parentIds (number[])
- inContext (boolean)
For notes:
- content (string)
- newContent (string)

Notes:
- treeRef uses integer ids to make them easier for the assistant to reference vs. a long uuid
- The root node has id 0, and the remaining nodes are 1, 2, 3, etc.
- Any updates to nodes automatically update treeRef
- Any updates to content/prevContent must keep treeRef in sync
*/

const appState = {
  //nodesRef...or tree?
  //currentNodeId
  //setNewContent
};

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
  const allData = await requestGetAllData();
  const { nodes, currentNodeId, ...contents } = allData;
  const initNodes = nodes || defaultNodes;
  const initCurrentNodeId = currentNodeId || 1;
  const prevNodesRef = Object.fromEntries(
    //get contents into form expected by updateNodesRef
    Object.entries(contents).map(([id, content]) => [id, { content }]),
  );
  const initNodesRef = updateNodesRef(initNodes, prevNodesRef);
  createRoot(document.getElementById("root")).render(
    <App
      initNodes={initNodes}
      initCurrentNodeId={initCurrentNodeId}
      initNodesRef={initNodesRef}
    />,
  );
  return context();
}

function App({ initNodes, initCurrentNodeId, initNodesRef }) {
  const [nodes, setNodes] = usePersistentState("nodes", initNodes);
  const [currentNodeId, setCurrentNodeId] = usePersistentState(
    "currentNodeId",
    initCurrentNodeId,
  );
  const [showInfo, setShowInfo] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  const nodesRef = useRef(initNodesRef);

  useEffect(() => {
    nodesRef.current = updateNodesRef(nodes, nodesRef.current);
    setSearchResults(null); //no longer valid
  }, [nodes]);

  const tree = buildTree(nodesRef.current, currentNodeId);

  let modalComponent;
  if (deleteId) {
    modalComponent = <DeleteConfirm id={deleteId} setDeleteId={setDeleteId} />;
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
          setCurrentNodeId,
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
          setNodes,
          currentNodeId,
          setCurrentNodeId,
          setShowInfo,
          setDeleteId,
          setShowSearch,
        }}
      />
      {!("childrenIds" in nodes[currentNodeId]) && (
        <Note
          key={currentNodeId}
          {...{
            appState,
            currentNodeId,
            setCurrentNodeId,
            nodesRef,
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

function updateNodesRef(nodes, prevNodesRef) {
  return Object.fromEntries(
    Object.entries(nodes).map(([id, node]) => {
      if (!node.childrenIds) {
        return [id, { ...node, content: prevNodesRef[id].content || "" }];
      }
      return [id, node];
    }),
  );
}

/**
 * Returns an array of nodes sorted in depth first order, adding keys:
 * - depth: number
 * - parentNames: string[]
 * - parentId: number
 * - parentIds: number[]
 * - inContext: boolean
 */
function buildTree(
  nodes,
  currentNodeId,
  rootId = 0,
  depth = 0,
  parentNames = [],
  parentId = null,
  parentIds = [],
) {
  const tree = [];
  const node = nodes[rootId];
  if (node.id !== 0) {
    //don't push root element
    const inContext =
      node.content && (currentNodeId === node.id || node.checked);
    tree.push({ ...node, depth, parentNames, parentId, parentIds, inContext });
  }
  if (node.childrenIds && !node.collapsed) {
    for (const childId of node.childrenIds) {
      tree.push(
        ...buildTree(
          nodes,
          currentNodeId,
          childId,
          depth + 1,
          [...parentNames, node.name],
          node.id,
          [...parentIds, node.id],
        ),
      );
    }
  }
  if (depth === 0) {
    const currentNode = tree.find((node) => node.id === currentNodeId);
    const currentNodeParents = new Set(currentNode.parentIds);
    for (const node of tree) {
      if (
        node.starred &&
        node.content &&
        currentNodeParents.has(node.parentId)
      ) {
        node.inContext = true;
      }
    }
  }
  return tree;
}
