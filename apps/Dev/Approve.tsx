import React, { useSyncExternalStore } from "react";
import { Text, type ChangeSet } from "@codemirror/state";
import type { DevState } from "./DevState";

function Approve({ devState }: { devState: DevState }) {
  const selectedApp = useSyncExternalStore(
    devState.subscribe("selectedApp"),
    devState.getSnapshot("selectedApp"),
  );

  const filesWithChangeSets = Object.values(selectedApp.files).filter(
    (file) => file.changeSet,
  );
  if (filesWithChangeSets.length === 0) {
    return null;
  }

  const approveButtonStyle =
    "rounded-lg border border-stone-500 py-1 text-sm w-28 font-medium";

  const selectedFile = selectedApp.files[selectedApp.selectedFileName]!;

  return (
    <div className="absolute bottom-4 left-2 right-2 flex flex-wrap justify-center gap-2">
      <div className="flex gap-2">
        <button
          className={`${approveButtonStyle} bg-green-200 hover:bg-green-300`}
          onClick={() => {
            devState.updateFiles(
              Object.fromEntries(
                filesWithChangeSets.map((file) => [
                  file.name,
                  { changeSet: undefined },
                ]),
              ),
            );
          }}
        >
          Accept All Files
        </button>
        {selectedFile.changeSet && (
          <button
            className={`${approveButtonStyle} bg-green-200 hover:bg-green-300`}
            onClick={() => {
              devState.updateFile({ changeSet: undefined });
            }}
          >
            Accept File
          </button>
        )}
      </div>
      <div className="flex gap-2">
        {selectedFile.changeSet && (
          <button
            className={`${approveButtonStyle} bg-red-200 hover:bg-red-300`}
            onClick={() => {
              devState.updateFile({
                changeSet: undefined,
                content: applyChangeSet(
                  selectedFile.changeSet!,
                  selectedFile.content,
                ),
              });
            }}
          >
            Reject File
          </button>
        )}
        <button
          className={`${approveButtonStyle} bg-red-200 hover:bg-red-300`}
          onClick={() => {
            devState.updateFiles(
              Object.fromEntries(
                filesWithChangeSets.map((file) => [
                  file.name,
                  {
                    changeSet: undefined,
                    content: applyChangeSet(file.changeSet!, file.content),
                  },
                ]),
              ),
            );
          }}
        >
          Reject All Files
        </button>
      </div>
    </div>
  );
}

export default Approve;

function applyChangeSet(changeSet: ChangeSet, file: string) {
  return changeSet.apply(Text.of(file.split("\n"))).toString();
}
