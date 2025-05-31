import React, { useSyncExternalStore, useState } from "react";
import { X, Plus } from "lucide-react";
import Confirm from "@components/Confirm.js";
import type { DevState } from "./DevState.ts";

export default function FilePicker({ devState }: { devState: DevState }) {
  const appIds = useSyncExternalStore(
    devState.subscribe("appIds"),
    devState.getSnapshot("appIds"),
  );
  const selectedApp = useSyncExternalStore(
    devState.subscribe("selectedApp"),
    devState.getSnapshot("selectedApp"),
  );
  const [newFilename, setNewFilename] = useState("");
  const [confirmDeleteApp, setConfirmDeleteApp] = useState("");

  const handleAddFile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newFilename.trim()) {
      devState.addFile(newFilename.trim());
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
            //@ts-ignore
            style={{ fieldSizing: "content" }}
            value={selectedApp.id}
            onChange={(e) => devState.setSelectedApp(e.target.value)}
          >
            {appIds.map((appId) => (
              <option key={appId}>{appId}</option>
            ))}
          </select>
          <button
            className="relative"
            onClick={() => {
              setConfirmDeleteApp(selectedApp.id);
            }}
          >
            <X size={16} />
            <span className="sr-only">Delete App</span>
          </button>
        </div>
        {Object.entries(selectedApp.files).map(([filename, file]) => (
          <div
            className={`flex rounded-md ${selectedApp.selectedFile.name === filename ? "border-2 border-black" : "border"} gap-px px-1 py-px`}
            key={filename}
          >
            <button onClick={() => devState.selectFile(filename)}>
              {`${filename}${file.changeSet ? "*" : ""}`}
            </button>
            {filename !== "magic.json" && (
              <button onClick={() => devState.deleteFile(filename)}>
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
            aria-label="New file"
            enterKeyHint="done"
          />
          <button type="submit" className="relative">
            <Plus size={16} />
            <span className="sr-only">Add File</span>
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
                devState.deleteApp(confirmDeleteApp);
                setConfirmDeleteApp("");
              },
              className: "bg-red-500 hover:bg-red-700 text-white",
            },
          ]}
          customContent={undefined}
          message={undefined}
        />
      )}
    </>
  );
}
