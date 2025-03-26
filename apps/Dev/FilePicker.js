import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import Confirm from "@components/Confirm.js";

export default function FilePicker({
  apps,
  deleteApp,
  selectedApp,
  handleSelectApp,
  filenames,
  selectedFilename,
  setSelectedFilename,
  deleteFile,
  addFile,
}) {
  const [newFilename, setNewFilename] = useState("");
  const [confirmDeleteApp, setConfirmDeleteApp] = useState(false);

  const handleAddFile = (e) => {
    e.preventDefault();
    if (newFilename.trim()) {
      addFile(newFilename.trim());
      setNewFilename("");
    }
  };
  return (
    <>
      <div
        className="mt-0.5 flex shrink-0 gap-1 overflow-x-auto text-xs"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="flex cursor-pointer rounded-md border">
          <select
            style={{ fieldSizing: "content" }}
            value={selectedApp}
            onChange={(e) => handleSelectApp(e.target.value)}
          >
            {apps.map((app) => (
              <option key={app}>{app}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setConfirmDeleteApp(selectedApp);
            }}
          >
            <X size={16} />
          </button>
        </div>
        {filenames.map(({ filename, merge }) => (
          <div
            className={`flex rounded-md ${selectedFilename === filename ? "border-2 border-black" : "border"} gap-px px-1 py-px`}
            key={filename}
          >
            <button onClick={() => setSelectedFilename(filename)}>
              {`${filename}${merge ? "*" : ""}`}
            </button>
            {filename !== "magic.json" && (
              <button onClick={() => deleteFile(filename)}>
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        <form className="flex" onSubmit={handleAddFile}>
          <input
            className="w-20 border px-1"
            type="text"
            value={newFilename}
            onChange={(e) => setNewFilename(e.target.value)}
            placeholder="New file"
          />
          <button type="submit">
            <Plus size={16} />
          </button>
        </form>
      </div>
      {confirmDeleteApp && (
        <Confirm
          onClose={() => {
            setConfirmDeleteApp("");
          }}
          header={`Are you sure you want to delete ${confirmDeleteApp}?`}
          buttons={[
            {
              text: "Cancel",
              onClick: () => {
                setConfirmDeleteApp("");
              },
              className: "bg-stone-300 hover:bg-stone-400 text-black",
            },
            {
              text: "Delete",
              onClick: () => {
                deleteApp(confirmDeleteApp);
                setConfirmDeleteApp("");
              },
              className: "bg-red-500 hover:bg-red-700 text-white",
            },
          ]}
        />
      )}
    </>
  );
}
