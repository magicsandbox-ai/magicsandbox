import React, { useState, memo } from "react";
import { Menu, Search, Trash2, Plus } from "lucide-react";

const SideBar = memo(function SideBar({
  folders,
  currentFolder,
  setCurrentFolder,
  setNotes,
}) {
  const [show, setShow] = useState(window.innerWidth > 768);
  const [editingFolder, setEditingFolder] = useState(null);
  const [editValue, setEditValue] = useState("");

  function handleSearch() {
    console.log("search");
  }

  function handleDelete() {
    console.log("delete");
  }

  function handleAdd() {
    setNotes((notes) => ({ ...notes, "New Folder": "" }));
  }

  function handleDoubleClick(folder) {
    setEditingFolder(folder);
    setEditValue(folder);
  }

  function handleRename(e) {
    e.preventDefault();
    if (editValue.trim() && editValue !== editingFolder) {
      setNotes((notes) => {
        const newNotes = { ...notes };
        newNotes[editValue.trim()] = newNotes[editingFolder];
        delete newNotes[editingFolder];
        return newNotes;
      });
    }
    setEditingFolder(null);
  }

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
          <button onClick={() => handleAdd()}>
            <Plus />
          </button>
        </div>
        <div className="grow space-y-3 overflow-y-auto px-3">
          {folders.map((folder) =>
            editingFolder === folder ? (
              <form key={folder} onSubmit={handleRename} className="w-full">
                <input
                  className="w-full rounded-lg border border-stone-500 bg-white px-1 py-0.5 text-sm"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleRename}
                  autoFocus
                />
              </form>
            ) : (
              <button
                className={`w-full truncate rounded-lg px-1 py-0.5 text-sm hover:bg-stone-300 ${
                  currentFolder === folder
                    ? "bg-stone-200 outline outline-1 outline-stone-500"
                    : ""
                }`}
                onClick={() => setCurrentFolder(folder)}
                onDoubleClick={() => handleDoubleClick(folder)}
                key={folder}
                title={folder}
              >
                {folder}
              </button>
            ),
          )}
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
});

export default SideBar;
