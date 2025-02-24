import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import SideBar from "./SideBar.js";
import Info from "./Info.js";
import Note from "./Note.js";

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

todo context
todo api
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
  const [modal, setModal] = useState(null); //info

  useEffect(() => {
    requestPutData("nodes", nodes).catch(console.error);
  }, [nodes]);

  useEffect(() => {
    requestPutData("currentNodeId", currentNodeId).catch(console.error);
  }, [currentNodeId]);

  const tree = buildTree(nodes, currentNodeId);

  return (
    <div className="flex h-screen w-screen">
      <SideBar
        {...{
          tree,
          setNodes,
          currentNodeId,
          setCurrentNodeId,
          setModal,
        }}
      />
      {"content" in nodes[currentNodeId] && (
        <Note
          key={currentNodeId}
          initContent={nodes[currentNodeId].content}
          setNodes={setNodes}
          currentNodeId={currentNodeId}
        />
      )}
      {modal && <Info setModal={setModal} />}
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
