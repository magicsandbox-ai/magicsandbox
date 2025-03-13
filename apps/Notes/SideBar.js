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
import Approve from "./Approve.js";

/*
todo drag and drop?
*/

function SideBar({
  notesState,
  showSideBar,
  setShowSideBar,
  setShowInfo,
  setDeleteUuid,
  setShowSearch,
}) {
  const tree = useSyncExternalStore(
    notesState.subscribe("tree"),
    notesState.getSnapshot("tree"),
  );

  function handleSearch() {
    setShowSearch(true);
  }

  function handleDelete(uuid) {
    setDeleteUuid(uuid);
  }

  function handleAdd(parentUuid, type) {
    notesState.addNode({ parentUuid, type });
  }

  if (showSideBar) {
    const anyChanges = tree.some((node) => node.change);
    return (
      <nav className="absolute flex h-full w-64 flex-col border-r border-stone-500 bg-stone-100 pt-3 md:static">
        <div className="mx-3 flex justify-between">
          <button onClick={() => setShowSideBar(false)}>
            <Menu />
            <span className="sr-only">Close menu</span>
          </button>
          <button onClick={() => setShowInfo(true)}>
            <Info />
            <span className="sr-only">Show info</span>
          </button>
          <button onClick={() => handleSearch()}>
            <Search />
            <span className="sr-only">Search</span>
          </button>
          <button onClick={() => handleDelete(notesState.currentNodeUuid)}>
            <Trash2 />
            <span className="sr-only">Delete</span>
          </button>
          <button onClick={() => handleAdd("0", "folder")}>
            <FolderPlus />
            <span className="sr-only">Add folder</span>
          </button>
          <button onClick={() => handleAdd("0", "note")}>
            <Plus />
            <span className="sr-only">Add note</span>
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
                  handleAdd,
                  handleDelete,
                }}
              />
            ))}
        </div>
        {anyChanges && (
          <Approve
            containerClassName="flex-col gap-1.5 pb-3"
            approveText="Approve all changes"
            approveOnClick={() => notesState.approveAllChanges()}
            rejectText="Reject all changes"
            rejectOnClick={() => notesState.rejectAllChanges()}
          />
        )}
      </nav>
    );
  } else {
    return (
      <div className="absolute ml-3 mt-3">
        <button onClick={() => setShowSideBar(!showSideBar)}>
          <Menu />
          <span className="sr-only">Open menu</span>
        </button>
      </div>
    );
  }
}

function Node({ notesState, node, handleAdd, handleDelete }) {
  const [renameValue, setRenameValue] = useState(null);

  function handleRename(e) {
    e.preventDefault();
    notesState.updateNode({
      uuid: node.uuid,
      name: renameValue.trim(),
    });
    setRenameValue(null);
  }

  const style = { marginLeft: `${(node.depth - 1) * 16}px` };

  const baseClassName = "rounded-lg px-2 py-0.5 text-sm ";
  const renameClassName =
    baseClassName + "grow border border-stone-500 bg-white";
  const nodeClassName =
    baseClassName +
    `group cursor-pointer flex items-center gap-2 hover:bg-stone-300 ${
      notesState.currentNodeUuid === node.uuid
        ? "bg-stone-200 outline outline-1 outline-stone-500"
        : ""
    }`;
  let nameClassName = "grow truncate text-left";
  const iconClassName = "w-4 h-4";
  const hoverButtonClassName =
    "md:opacity-0 md:focus:opacity-100 md:group-hover:opacity-100"; //buttons need to appear on mobile

  if (renameValue !== null) {
    return (
      <form onSubmit={handleRename} className="flex">
        <input
          style={style}
          className={renameClassName}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRename}
          autoFocus
          onFocus={(e) => e.target.select()}
          aria-label="Rename"
        />
      </form>
    );
  }
  let changesComponent;
  const changesClassName = `font-bold font-mono `;
  if (node.change === "new") {
    changesComponent = (
      <span className={changesClassName + "text-green-500"}>N</span>
    );
  } else if (node.change === "moved") {
    changesComponent = (
      <span className={changesClassName + "text-purple-500"}>M</span>
    );
  } else if (node.change === "renamed") {
    changesComponent = (
      <span className={changesClassName + "text-amber-500"}>R</span>
    );
  } else if (node.change === "edited") {
    changesComponent = (
      <span className={changesClassName + "text-blue-500"}>E</span>
    );
  } else if (node.change === "deleted") {
    changesComponent = (
      <span className={changesClassName + "text-red-500"}>D</span>
    );
    nameClassName += " line-through";
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
          changesComponent,
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
          changesComponent,
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
      style={style}
      className={nodeClassName}
      title={`${node.name}${node.changeDetails ? ` (${node.changeDetails})` : ""}`}
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
  changesComponent,
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
          <>
            <ChevronRight className={iconClassName} />
            <span className="sr-only">Expand folder</span>
          </>
        ) : (
          <>
            <ChevronDown className={iconClassName} />
            <span className="sr-only">Collapse folder</span>
          </>
        )}
      </button>
      <button
        className={nameClassName}
        onClick={() => notesState.setCurrentNodeUuid(node.uuid)}
        onDoubleClick={() => setRenameValue(node.name)}
      >
        {changesComponent}
        {changesComponent && " "}
        {node.name}
      </button>
      <button
        className={hoverButtonClassName}
        onClick={() => handleAdd(node.uuid, "folder")}
      >
        <FolderPlus className={iconClassName} />
        <span className="sr-only">Add folder</span>
      </button>
      <button
        className={hoverButtonClassName}
        onClick={() => handleAdd(node.uuid, "note")}
      >
        <Plus className={iconClassName} />
        <span className="sr-only">Add note</span>
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
  changesComponent,
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
          <>
            <Check className={iconClassName} />
            <span className="sr-only">Uncheck note</span>
          </>
        ) : (
          <>
            <Square className={iconClassName} />
            <span className="sr-only">Check note</span>
          </>
        )}
      </button>
      <button
        className={`${nameClassName} ${node.inContext ? "font-bold" : ""}`}
        onClick={() => notesState.setCurrentNodeUuid(node.uuid)}
        onDoubleClick={() => setRenameValue(node.name)}
      >
        {changesComponent}
        {changesComponent && " "}
        {node.name}
      </button>
      <button
        className={node.starred ? "" : hoverButtonClassName}
        onClick={handleStar}
      >
        {node.starred ? (
          <>
            <Star className={iconClassName + " fill-yellow-500"} />
            <span className="sr-only">Unstar note</span>
          </>
        ) : (
          <>
            <Star className={iconClassName} />
            <span className="sr-only">Star note</span>
          </>
        )}
      </button>
    </>
  );
}

export default SideBar;
