import React, { useState } from "react";
import {
  Menu,
  Info,
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
todo drag and drop?
todo delete
todo search
*/

function SideBar({
  tree,
  setNodes,
  currentNodeId,
  setCurrentNodeId,
  setModal,
}) {
  const [show, setShow] = useState(window.innerWidth > 768);

  function handleSearch() {
    console.log("search");
  }

  function handleDelete() {
    console.log("delete");
  }

  function handleAdd(parentId, type) {
    setNodes((nodes) => {
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
      return {
        ...nodes,
        [newParentNode.id]: newParentNode,
        [newNode.id]: newNode,
      };
    });
  }

  if (show) {
    return (
      <div className="absolute flex h-full w-64 flex-col border-r-2 border-stone-500 bg-stone-100 pt-3 md:static">
        <div className="mx-3 flex justify-between">
          <button onClick={() => setShow(!show)}>
            <Menu />
          </button>
          <button onClick={() => setModal("info")}>
            <Info />
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
        <div className="grow space-y-0.5 overflow-y-auto px-3 pt-3">
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
      <div className="m-3 flex flex-col">
        <button onClick={() => setShow(!show)}>
          <Menu />
        </button>
      </div>
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

  function handleClick(event) {
    if (event.ctrlKey) {
      setNodes((nodes) => {
        const ids = [];
        let newChecked = false; //if all notes are checked, we'll uncheck
        const nodesToVisit = [node.id];
        while (nodesToVisit.length > 0) {
          const currentId = nodesToVisit.pop();
          ids.push(currentId);
          const currentNode = nodes[currentId];
          if (currentNode.childrenIds) {
            nodesToVisit.push(...currentNode.childrenIds);
          } else {
            if (!currentNode.checked) {
              newChecked = true; //but if a single note is unchecked, we'll check
            }
          }
        }
        const newNodes = {};
        for (const id of ids) {
          if (nodes[id].childrenIds) {
            newNodes[id] = { ...nodes[id], collapsed: false };
          } else {
            newNodes[id] = { ...nodes[id], checked: newChecked };
          }
        }
        return { ...nodes, ...newNodes };
      });
    }
  }

  const baseClassName = "rounded-lg px-2 py-0.5 text-sm ";
  const renameClassName =
    baseClassName + "w-full border border-stone-500 bg-white";
  const nodeClassName =
    baseClassName +
    `group cursor-pointer flex items-center gap-2 hover:bg-stone-300 ${
      currentNodeId === node.id
        ? "bg-stone-200 outline outline-1 outline-stone-500"
        : ""
    }`;
  const nameClassName = "grow truncate";
  const iconClassName = "w-4 h-4";
  const hoverButtonClassName =
    "opacity-0 focus:opacity-100 group-hover:opacity-100";

  if (renameValue !== null) {
    return (
      <form onSubmit={handleRename} className="w-full">
        <input
          className={renameClassName}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRename}
          autoFocus
          onFocus={(e) => e.target.select()}
        />
      </form>
    );
  }
  let component;
  if (node.childrenIds) {
    component = (
      <Folder
        {...{
          nameClassName,
          iconClassName,
          hoverButtonClassName,
          node,
          setNodes,
          setCurrentNodeId,
          setRenameValue,
          handleAdd,
        }}
      />
    );
  } else {
    component = (
      <Note
        {...{
          nameClassName,
          iconClassName,
          hoverButtonClassName,
          node,
          setNodes,
          setCurrentNodeId,
          setRenameValue,
        }}
      />
    );
  }

  return (
    <div
      className={nodeClassName}
      style={{ marginLeft: `${(node.depth - 1) * 16}px` }}
      title={node.name}
      onClick={handleClick}
    >
      {component}
    </div>
  );
}

function Folder({
  nameClassName,
  iconClassName,
  hoverButtonClassName,
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
    <>
      <button onClick={handleCollapse}>
        {node.collapsed ? (
          <ChevronRight className={iconClassName} />
        ) : (
          <ChevronDown className={iconClassName} />
        )}
      </button>
      <div
        className={nameClassName}
        onClick={() => setCurrentNodeId(node.id)}
        onDoubleClick={() => setRenameValue(node.name)}
      >
        {node.name}
      </div>
      <button
        className={hoverButtonClassName}
        onClick={() => handleAdd(node.id, "folder")}
      >
        <FolderPlus className={iconClassName} />
      </button>
      <button
        className={hoverButtonClassName}
        onClick={() => handleAdd(node.id, "note")}
      >
        <Plus className={iconClassName} />
      </button>
    </>
  );
}

function Note({
  nameClassName,
  iconClassName,
  hoverButtonClassName,
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
    <>
      <button
        className={node.checked ? "" : hoverButtonClassName}
        onClick={handleCheck}
      >
        {node.checked ? (
          <Check className={iconClassName} />
        ) : (
          <Square className={iconClassName} />
        )}
      </button>
      <div
        className={`${nameClassName} ${node.inContext ? "font-bold" : ""}`}
        onClick={() => setCurrentNodeId(node.id)}
        onDoubleClick={() => setRenameValue(node.name)}
      >
        {node.name}
      </div>
      <button
        className={node.starred ? "" : hoverButtonClassName}
        onClick={handleStar}
      >
        <Star
          className={`${iconClassName} ${
            node.starred ? "fill-yellow-500" : ""
          }`}
        />
      </button>
    </>
  );
}

export default SideBar;
