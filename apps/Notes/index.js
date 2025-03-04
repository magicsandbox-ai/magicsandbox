import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { usePersistentState } from "@magicsandbox.ai/hooks";
import SideBar from "./SideBar.js";
import Info from "./Info.js";
import Note from "./Note.js";
import DeleteConfirm from "./DeleteConfirm.js";
import Search from "./Search.js";

/*
The database has keys:

- nodes (object): described below
- currentNodeId (number): the current selected node id
- [id] (string): all other keys map note ids to that note's content

nodes is an object mapping id to objects with keys:
- id: number
- name: string

Keys for folders:
- collapsed?: boolean
- childrenIds?: number[]

Keys for notes:
- checked?: boolean
- starred?: boolean

The root node is a folder with id 0. it will always have at least one child

Content is stored separately from nodes to prevent unnecessary rerendering and improve data saving and syncing performance
nodesRef mirrors the nodes object and also includes content as a key for each note
Any updates to content must also keep nodesRef in sync
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
          currentNodeId={currentNodeId}
          nodesRef={nodesRef.current}
        />
      )}
      {modalComponent}
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
