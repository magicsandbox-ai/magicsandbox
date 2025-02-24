import React, { useState } from "react";
import {
  Menu,
  Search,
  Trash2,
  FolderPlus,
  Plus,
  ChevronDown,
  ChevronRight,
  Square,
  Check,
  Star,
} from "lucide-react";

/*
todo this is rerendering on every content change
todo drag and drop?
todo node bold if in context
ctrl click and shift click
info modal
*/

function SideBar({ nodes, setNodes, currentNodeId, setCurrentNodeId }) {
  const [show, setShow] = useState(window.innerWidth > 768);

  function handleSearch() {
    console.log("search");
  }

  function handleDelete() {
    console.log("delete");
  }

  function handleAdd(parentId, type) {
    const newId = Date.now();
    const newParentNode = {
      ...nodes[parentId],
      childrenIds: [...nodes[parentId].childrenIds, newId],
    };
    let newNode;
    if (type === "folder") {
      newNode = {
        id: newId,
        name: "New Folder",
        collapsed: false,
        childrenIds: [],
      };
    } else {
      newNode = {
        id: newId,
        name: "New Note",
        content: "",
        checked: false,
        starred: false,
      };
    }
    setNodes({
      ...nodes,
      [newParentNode.id]: newParentNode,
      [newNode.id]: newNode,
    });
  }

  const tree = buildTree(nodes);

  if (show) {
    return (
      <div className="absolute flex h-full w-64 flex-col gap-3 border-r-2 border-stone-500 bg-stone-100 pt-3 md:static">
        <div className="mx-3 flex justify-between">
          <button onClick={() => setShow(!show)}>
            <Menu />
          </button>
          <button onClick={() => handleSearch()}>
            <Search />
          </button>
          <button onClick={() => handleDelete()}>
            <Trash2 />
          </button>
          <button onClick={() => handleAdd(0, "folder")}>
            <FolderPlus />
          </button>
          <button onClick={() => handleAdd(0, "note")}>
            <Plus />
          </button>
        </div>
        <div className="grow space-y-3 overflow-y-auto px-3">
          {tree.map((node) => (
            <Node
              key={node.id}
              {...{
                node,
                setNodes,
                currentNodeId,
                setCurrentNodeId,
                handleAdd,
              }}
            />
          ))}
        </div>
      </div>
    );
  } else {
    return (
      <button className="absolute ml-3 mt-3" onClick={() => setShow(!show)}>
        <Menu />
      </button>
    );
  }
}

function Node({ node, setNodes, currentNodeId, setCurrentNodeId, handleAdd }) {
  const [renameValue, setRenameValue] = useState(null);

  function handleRename(e) {
    e.preventDefault();
    if (renameValue.trim() && renameValue !== node.name) {
      setNodes((nodes) => {
        const newNode = {
          ...nodes[node.id],
          name: renameValue.trim(),
        };
        return { ...nodes, [node.id]: newNode };
      });
    }
    setRenameValue(null);
  }

  const baseClassName = "w-full rounded-lg px-1 py-0.5 text-sm ";
  const renameClassName = baseClassName + "border border-stone-500 bg-white";
  const nodeClassName =
    baseClassName +
    `flex items-center gap-1 hover:bg-stone-300 ${
      currentNodeId === node.id
        ? "bg-stone-200 outline outline-1 outline-stone-500"
        : ""
    }`;
  const nameClassName = "grow truncate";
  const buttonClassName = "w-4 h-4";

  if (renameValue !== null) {
    return (
      <form onSubmit={handleRename} className="w-full">
        <input
          className={renameClassName}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRename}
          autoFocus
        />
      </form>
    );
  } else if (node.childrenIds) {
    return (
      <Folder
        {...{
          nodeClassName,
          nameClassName,
          buttonClassName,
          node,
          setNodes,
          setCurrentNodeId,
          setRenameValue,
          handleAdd,
        }}
      />
    );
  } else {
    return (
      <Note
        {...{
          nodeClassName,
          nameClassName,
          buttonClassName,
          node,
          setNodes,
          setCurrentNodeId,
          setRenameValue,
        }}
      />
    );
  }
}

function Folder({
  nodeClassName,
  nameClassName,
  buttonClassName,
  node,
  setNodes,
  setCurrentNodeId,
  setRenameValue,
  handleAdd,
}) {
  function handleCollapse() {
    setNodes((nodes) => ({
      ...nodes,
      [node.id]: { ...node, collapsed: !node.collapsed },
    }));
  }

  return (
    <div
      className={nodeClassName + " group"}
      style={{ marginLeft: `${(node.depth - 1) * 16}px` }}
      title={node.name}
    >
      <button className={buttonClassName} onClick={handleCollapse}>
        {node.collapsed ? <ChevronDown /> : <ChevronRight />}
      </button>
      <button
        className={nameClassName}
        onClick={() => setCurrentNodeId(node.id)}
        onDoubleClick={() => setRenameValue(node.name)}
      >
        {node.name}
      </button>
      <button
        className={buttonClassName + " invisible group-hover:visible"}
        onClick={() => handleAdd(node.id, "folder")}
      >
        <FolderPlus />
      </button>
      <button
        className={buttonClassName + " invisible group-hover:visible"}
        onClick={() => handleAdd(node.id, "note")}
      >
        <Plus />
      </button>
    </div>
  );
}

function Note({
  nodeClassName,
  nameClassName,
  buttonClassName,
  node,
  setNodes,
  setCurrentNodeId,
  setRenameValue,
}) {
  function handleCheck() {
    setNodes((nodes) => ({
      ...nodes,
      [node.id]: { ...node, checked: !node.checked },
    }));
  }

  function handleStar() {
    setNodes((nodes) => ({
      ...nodes,
      [node.id]: { ...node, starred: !node.starred },
    }));
  }

  return (
    <div
      className={nodeClassName}
      style={{ marginLeft: `${(node.depth - 1) * 16}px` }}
      title={node.name}
    >
      <button className={buttonClassName} onClick={handleCheck}>
        {node.checked ? <Square /> : <Check />}
      </button>
      <button
        className={nameClassName}
        onClick={() => setCurrentNodeId(node.id)}
        onDoubleClick={() => setRenameValue(node.name)}
      >
        {node.name}
      </button>
      <button className={buttonClassName} onClick={() => handleStar()}>
        <Star className={node.starred ? "fill-yellow-500" : ""} />
      </button>
    </div>
  );
}

export default SideBar;

/**
 * Returns an array of nodes sorted in depth first order, with depth added to each node
 */
function buildTree(nodes, rootId = 0, depth = 0) {
  const tree = [];
  const node = nodes[rootId];
  if (node.id !== 0) {
    tree.push({ ...node, depth }); //don't push root element
  }
  if (node.childrenIds && !node.collapsed) {
    for (const childId of node.childrenIds) {
      tree.push(...buildTree(nodes, childId, depth + 1));
    }
  }
  return tree;
}
