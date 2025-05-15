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
import Approve from "./Approve.tsx";
import type NotesState from "./NotesState.ts";
import type { TreeNode, TreeFolder, TreeNote } from "./NotesState.ts";

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
}: {
  notesState: NotesState;
  showSideBar: boolean;
  setShowSideBar: (showSideBar: boolean) => void;
  setShowInfo: (showInfo: boolean) => void;
  setDeleteUuid: (deleteUuid: string) => void;
  setShowSearch: (showSearch: boolean) => void;
}) {
  const tree = useSyncExternalStore(
    notesState.subscribe("tree"),
    notesState.getSnapshot("tree"),
  );

  function handleSearch() {
    setShowSearch(true);
  }

  function handleDelete(uuid: string) {
    setDeleteUuid(uuid);
  }

  function handleAdd(parentUuid: string, type: "folder" | "note") {
    notesState.addNode({ parentUuid, type });
  }

  if (showSideBar) {
    const anyChanges = tree.some((node) => node.changeData.change);
    return (
      <nav className="absolute flex h-full w-64 flex-none flex-col border-r border-stone-500 bg-stone-100 pt-3 md:static">
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
            .filter((node) => node.treeData.display)
            .map((node) => (
              <Node
                key={node.nodeData.uuid}
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
      <div className="absolute z-10 ml-3 mt-3">
        <button onClick={() => setShowSideBar(!showSideBar)}>
          <Menu />
          <span className="sr-only">Open menu</span>
        </button>
      </div>
    );
  }
}

function Node({
  notesState,
  node,
  handleAdd,
  handleDelete,
}: {
  notesState: NotesState;
  node: TreeNode;
  handleAdd: (parentUuid: string, type: "folder" | "note") => void;
  handleDelete: (uuid: string) => void;
}) {
  const [renameValue, setRenameValue] = useState<string | undefined>(undefined);

  function handleRename(
    e: React.FormEvent<HTMLFormElement> | React.FocusEvent<HTMLInputElement>,
  ) {
    e.preventDefault();
    const newName = (renameValue || "").trim();
    if (newName.length > 0) {
      notesState.updateNode({
        uuid: node.nodeData.uuid,
        name: newName,
      });
    }
    setRenameValue(undefined);
  }

  const style = { marginLeft: `${(node.treeData.depth - 1) * 16}px` };

  const baseClassName = "rounded-lg px-2 py-0.5 text-sm ";
  const renameClassName =
    baseClassName + "grow border border-stone-500 bg-white";
  const nodeClassName =
    baseClassName +
    `group flex items-center gap-2 hover:bg-stone-300 ${
      notesState.currentNodeUuid === node.nodeData.uuid
        ? "bg-stone-200 outline outline-1 outline-stone-500"
        : ""
    }`;
  let nameClassName = "grow truncate text-left";
  const iconClassName = "w-4 h-4";
  const hoverButtonClassName =
    "md:opacity-0 md:focus:opacity-100 md:group-hover:opacity-100"; //buttons need to appear on mobile

  if (renameValue !== undefined) {
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
          enterKeyHint="done"
        />
      </form>
    );
  }
  let changesComponent;
  const changesClassName = `font-bold font-mono `;
  if (node.changeData.change === "new") {
    changesComponent = (
      <span className={changesClassName + "text-green-500"}>N</span>
    );
  } else if (node.changeData.change === "moved") {
    changesComponent = (
      <span className={changesClassName + "text-purple-500"}>M</span>
    );
  } else if (node.changeData.change === "renamed") {
    changesComponent = (
      <span className={changesClassName + "text-amber-500"}>R</span>
    );
  } else if (node.changeData.change === "edited") {
    changesComponent = (
      <span className={changesClassName + "text-blue-500"}>E</span>
    );
  } else if (node.changeData.change === "deleted") {
    changesComponent = (
      <span className={changesClassName + "text-red-500"}>D</span>
    );
    nameClassName += " line-through";
  }
  let component;
  if (node.isFolder()) {
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
  } else if (node.isNote()) {
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

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey) {
      const descendants = notesState.getDescendants(node.nodeData.uuid);
      let newChecked = false; //if all notes are checked, we'll uncheck
      for (const node of descendants) {
        if (node.isNote() && !node.nodeData.checked) {
          newChecked = true; //but if a single note is unchecked, we'll check
        }
      }
      for (const node of descendants) {
        if (node.isNote() && node.nodeData.checked !== newChecked) {
          notesState.updateNode({
            uuid: node.nodeData.uuid,
            checked: newChecked,
          });
        } else if (node.isFolder() && node.nodeData.collapsed) {
          notesState.updateNode({
            uuid: node.nodeData.uuid,
            collapsed: false,
          });
        }
      }
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Delete") {
      handleDelete(node.nodeData.uuid);
    }
  }

  return (
    <div
      style={style}
      className={nodeClassName}
      title={`${node.nodeData.name}${node.changeData.changeDetails ? ` (${node.changeData.changeDetails})` : ""}`}
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
}: {
  notesState: NotesState;
  nameClassName: string;
  iconClassName: string;
  hoverButtonClassName: string;
  node: TreeFolder;
  setRenameValue: (value: string) => void;
  handleAdd: (parentUuid: string, type: "folder" | "note") => void;
  changesComponent: React.ReactNode;
}) {
  function handleCollapse() {
    notesState.updateNode({
      uuid: node.nodeData.uuid,
      collapsed: !node.nodeData.collapsed,
    });
  }

  return (
    <>
      <button onClick={handleCollapse}>
        {node.nodeData.collapsed ? (
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
        onClick={() => notesState.setCurrentNodeUuid(node.nodeData.uuid)}
        onDoubleClick={() => setRenameValue(node.nodeData.name)}
      >
        {changesComponent}
        {changesComponent && " "}
        {node.nodeData.name}
      </button>
      <button
        className={hoverButtonClassName}
        onClick={() => handleAdd(node.nodeData.uuid, "folder")}
      >
        <FolderPlus className={iconClassName} />
        <span className="sr-only">Add folder</span>
      </button>
      <button
        className={hoverButtonClassName}
        onClick={() => handleAdd(node.nodeData.uuid, "note")}
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
}: {
  notesState: NotesState;
  nameClassName: string;
  iconClassName: string;
  hoverButtonClassName: string;
  node: TreeNote;
  setRenameValue: (value: string) => void;
  changesComponent: React.ReactNode;
}) {
  function handleCheck() {
    notesState.updateNode({
      uuid: node.nodeData.uuid,
      checked: !node.nodeData.checked,
    });
  }

  function handleStar() {
    notesState.updateNode({
      uuid: node.nodeData.uuid,
      starred: !node.nodeData.starred,
    });
  }

  return (
    <>
      <button
        className={node.nodeData.checked ? "" : hoverButtonClassName}
        onClick={handleCheck}
      >
        {node.nodeData.checked ? (
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
        className={`${nameClassName} ${node.treeData.inContext ? "font-bold" : ""}`}
        onClick={() => notesState.setCurrentNodeUuid(node.nodeData.uuid)}
        onDoubleClick={() => setRenameValue(node.nodeData.name)}
      >
        {changesComponent}
        {changesComponent && " "}
        {node.nodeData.name}
      </button>
      <button
        className={node.nodeData.starred ? "" : hoverButtonClassName}
        onClick={handleStar}
      >
        {node.nodeData.starred ? (
          <>
            <Star className={iconClassName + " fill-yellow-200"} />
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
