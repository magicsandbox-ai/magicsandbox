import React, { useSyncExternalStore, useState } from "react";
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
*/

function SideBar({
  notesState,
  currentNodeUuid,
  setShowInfo,
  setDeleteUuid,
  setShowSearch,
}) {
  const tree = useSyncExternalStore(
    notesState.subscribeToTree,
    notesState.getTree,
  );

  const [show, setShow] = useState(window.innerWidth > 768);

  function handleSearch() {
    setShowSearch(true);
  }

  function handleDelete(uuid) {
    setDeleteUuid(uuid);
  }

  function handleAdd(parentUuid, type) {
    notesState.addNode({ parentUuid, type });
  }

  if (show) {
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
          <button onClick={() => handleAdd("0", "folder")}>
            <FolderPlus />
          </button>
          <button onClick={() => handleAdd("0", "note")}>
            <Plus />
          </button>
        </div>
        <div className="grow space-y-0.5 overflow-y-auto px-3 pt-3">
          {tree
            .filter((node) => node.display)
            .map((node) => (
              <Node
                key={node.uuid}
                {...{
                  notesState,
                  node,
                  currentNodeUuid,
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

function Node({ notesState, node, currentNodeUuid, handleAdd, handleDelete }) {
  const [renameValue, setRenameValue] = useState(null);

  function handleRename(e) {
    e.preventDefault();
    notesState.updateNode({
      uuid: node.uuid,
      name: renameValue.trim(),
    });
    setRenameValue(null);
  }

  const baseClassName = "rounded-lg px-2 py-0.5 text-sm ";
  const renameClassName =
    baseClassName + "w-full border border-stone-500 bg-white";
  const nodeClassName =
    baseClassName +
    `group cursor-pointer flex items-center gap-2 hover:bg-stone-300 ${
      currentNodeUuid === node.uuid
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
  if (node.type === "folder") {
    component = (
      <Folder
        {...{
          notesState,
          nameClassName,
          iconClassName,
          hoverButtonClassName,
          node,
          setRenameValue,
          handleAdd,
        }}
      />
    );
  } else {
    component = (
      <Note
        {...{
          notesState,
          nameClassName,
          iconClassName,
          hoverButtonClassName,
          node,
          setRenameValue,
        }}
      />
    );
  }

  function handleClick(event) {
    if (event.ctrlKey) {
      const descendants = notesState.getDescendants(node.uuid);
      let newChecked = false; //if all notes are checked, we'll uncheck
      for (const node of descendants) {
        if (node.type === "note" && !node.checked) {
          newChecked = true; //but if a single note is unchecked, we'll check
        }
      }
      for (const node of descendants) {
        if (node.type === "note" && node.checked !== newChecked) {
          notesState.updateNode({
            uuid: node.uuid,
            checked: newChecked,
          });
        } else if (node.collapsed) {
          notesState.updateNode({
            uuid: node.uuid,
            collapsed: false,
          });
        }
      }
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Delete") {
      handleDelete(node.uuid);
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
  notesState,
  nameClassName,
  iconClassName,
  hoverButtonClassName,
  node,
  setRenameValue,
  handleAdd,
}) {
  function handleCollapse() {
    notesState.updateNode({
      uuid: node.uuid,
      collapsed: !node.collapsed,
    });
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
        onClick={() => notesState.setCurrentNodeUuid(node.uuid)}
        onDoubleClick={() => setRenameValue(node.name)}
      >
        {node.name}
      </div>
      <button
        className={hoverButtonClassName}
        onClick={() => handleAdd(node.uuid, "folder")}
      >
        <FolderPlus className={iconClassName} />
      </button>
      <button
        className={hoverButtonClassName}
        onClick={() => handleAdd(node.uuid, "note")}
      >
        <Plus className={iconClassName} />
      </button>
    </>
  );
}

function Note({
  notesState,
  nameClassName,
  iconClassName,
  hoverButtonClassName,
  node,
  setRenameValue,
}) {
  function handleCheck() {
    notesState.updateNode({
      uuid: node.uuid,
      checked: !node.checked,
    });
  }

  function handleStar() {
    notesState.updateNode({
      uuid: node.uuid,
      starred: !node.starred,
    });
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
        onClick={() => notesState.setCurrentNodeUuid(node.uuid)}
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
