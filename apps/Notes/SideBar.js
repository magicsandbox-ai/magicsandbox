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
import { generateUuid } from "./utils.js";

/*
todo drag and drop?
*/

function SideBar({
  tree,
  nodesRef,
  updateTree,
  currentNodeUuid,
  setCurrentNodeUuid,
  setShowInfo,
  setDeleteUuid,
  setShowSearch,
}) {
  const [show, setShow] = useState(window.innerWidth > 768);

  function handleSearch() {
    setShowSearch(true);
  }

  function handleDelete(uuid) {
    setDeleteUuid(uuid);
  }

  function handleAdd(parent, type) {
    const olderSibling =
      nodesRef.current[parent.childrenUuids[parent.childrenUuids.length - 1]];
    const order = olderSibling.order + 1000;
    const uuid = generateUuid();
    if (type === "folder") {
      nodesRef.current[uuid] = {
        uuid,
        type,
        name: "New Folder",
        parentUuid: parent.uuid,
        order,
        collapsed: false,
      };
    } else {
      nodesRef.current[uuid] = {
        uuid,
        type,
        name: "New Note",
        parentUuid: parent.uuid,
        order,
        content: "",
        checked: false,
        starred: false,
      };
    }
    updateTree([uuid]);
  }

  if (show) {
    const displayNodes = [];

    return (
      <div className="absolute flex h-full w-64 flex-col border-r-2 border-stone-500 bg-stone-100 pt-3 md:static">
        <div className="mx-3 flex justify-between">
          <button onClick={() => setShow(!show)}>
            <Menu />
          </button>
          <button onClick={() => setShowInfo(true)}>
            <Info />
          </button>
          <button onClick={() => handleSearch()}>
            <Search />
          </button>
          <button onClick={() => handleDelete(currentNodeUuid)}>
            <Trash2 />
          </button>
          <button onClick={() => handleAdd(tree[0], "folder")}>
            <FolderPlus />
          </button>
          <button onClick={() => handleAdd(tree[0], "note")}>
            <Plus />
          </button>
        </div>
        <div className="grow space-y-0.5 overflow-y-auto px-3 pt-3">
          {tree.map((node) => (
            <Node
              key={node.uuid}
              {...{
                node,
                tree,
                nodesRef,
                updateTree,
                currentNodeUuid,
                setCurrentNodeUuid,
                handleAdd,
                handleDelete,
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

function Node({
  node,
  nodesRef,
  updateTree,
  currentNodeUuid,
  setCurrentNodeUuid,
  handleAdd,
  handleDelete,
}) {
  const [renameValue, setRenameValue] = useState(null);

  function handleRename(e) {
    e.preventDefault();
    if (renameValue.trim() && renameValue !== node.name) {
      nodesRef.current[node.uuid].name = renameValue.trim();
      updateTree([node.uuid]);
    }
    setRenameValue(null);
  }

  const baseClassName = "rounded-lg px-2 py-0.5 text-sm ";
  const renameClassName =
    baseClassName + "w-full border border-stone-500 bg-white";
  const nodeClassName =
    baseClassName +
    `group cursor-pointer flex items-center gap-2 hover:bg-stone-300 ${
      currentNodeUuid === node.id
        ? "bg-stone-200 outline outline-1 outline-stone-500"
        : ""
    }`;
  const nameClassName = "grow truncate";
  const iconClassName = "w-4 h-4";
  const hoverButtonClassName =
    "md:opacity-0 md:focus:opacity-100 md:group-hover:opacity-100"; //buttons need to appear on mobile

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
          nodesRef,
          updateTree,
          setCurrentNodeUuid,
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
          nodesRef,
          updateTree,
          setCurrentNodeUuid,
          setRenameValue,
        }}
      />
    );
  }

  function handleClick(event) {
    if (event.ctrlKey) {
      const ids = [];
      let newChecked = false; //if all notes are checked, we'll uncheck
      const nodesToVisit = [node.id];
      while (nodesToVisit.length > 0) {
        const currentId = nodesToVisit.pop();
        ids.push(currentId);
        const currentNode = tree[currentId];
        if (currentNode.childrenIds) {
          nodesToVisit.push(...currentNode.childrenIds);
        } else {
          if (!currentNode.checked) {
            newChecked = true; //but if a single note is unchecked, we'll check
          }
        }
      }
      for (const id of ids) {
        if (tree[id].childrenIds) {
          nodesRef.current[id].collapsed = false;
        } else {
          nodesRef.current[id].checked = newChecked;
        }
      }
      updateTree(uuids);
      // setNodes((nodes) => {
      //   const ids = [];
      //   let newChecked = false; //if all notes are checked, we'll uncheck
      //   const nodesToVisit = [node.id];
      //   while (nodesToVisit.length > 0) {
      //     const currentId = nodesToVisit.pop();
      //     ids.push(currentId);
      //     const currentNode = nodes[currentId];
      //     if (currentNode.childrenIds) {
      //       nodesToVisit.push(...currentNode.childrenIds);
      //     } else {
      //       if (!currentNode.checked) {
      //         newChecked = true; //but if a single note is unchecked, we'll check
      //       }
      //     }
      //   }
      //   const newNodes = {};
      //   for (const id of ids) {
      //     if (nodes[id].childrenIds) {
      //       newNodes[id] = { ...nodes[id], collapsed: false };
      //     } else {
      //       newNodes[id] = { ...nodes[id], checked: newChecked };
      //     }
      //   }
      //   return { ...nodes, ...newNodes };
      // });
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Delete") {
      handleDelete(node.id);
    }
  }

  return (
    <div
      className={nodeClassName}
      style={{ marginLeft: `${(node.depth - 1) * 16}px` }}
      title={node.name}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
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
  nodesRef,
  updateTree,
  setCurrentNodeUuid,
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
        onClick={() => setCurrentNodeUuid(node.id)}
        onDoubleClick={() => setRenameValue(node.name)}
      >
        {node.name}
      </div>
      <button
        className={hoverButtonClassName}
        onClick={() => handleAdd(node, "folder")}
      >
        <FolderPlus className={iconClassName} />
      </button>
      <button
        className={hoverButtonClassName}
        onClick={() => handleAdd(node, "note")}
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
  nodesRef,
  updateTree,
  setCurrentNodeUuid,
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
        onClick={() => setCurrentNodeUuid(node.id)}
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

function getDisplayNodes(tree) {
  const displayNodes = [];
  const nodesToVisit = [tree[0]];
  for (const node of tree) {
    displayNodes.push(node);
  }
  return displayNodes;
}
