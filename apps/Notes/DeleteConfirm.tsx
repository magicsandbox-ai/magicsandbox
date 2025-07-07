import React from "react";
import Confirm from "@components/Confirm.tsx";
import NotesState from "./NotesState.ts";

function DeleteConfirm({
  deleteUuid,
  setDeleteUuid,
  notesState,
}: {
  deleteUuid: string;
  setDeleteUuid: (deleteUuid: string | undefined) => void;
  notesState: NotesState;
}) {
  const deleteNode = notesState.nodes[deleteUuid];
  if (!deleteNode?.treeData) return;
  let header;
  if (deleteNode.isFolder()) {
    header = `Are you sure you want to delete folder "${deleteNode.treeData.path}" and all its contents?`;
  } else {
    header = `Are you sure you want to delete note "${deleteNode.treeData.path}"?`;
  }
  const buttons = [
    {
      text: "Cancel",
      className: "bg-stone-300 hover:bg-stone-400 text-black w-32",
      onClick: () => setDeleteUuid(undefined),
    },
    {
      text: "Delete",
      className: "bg-red-500 hover:bg-red-700 text-white w-32",
      onClick: () => {
        const descendants = notesState.getDescendants(deleteUuid);
        descendants.forEach((node) => {
          notesState.deleteNode(node.nodeData.uuid);
        });
        setDeleteUuid(undefined);
      },
    },
  ];
  return (
    <Confirm
      onClose={() => setDeleteUuid(undefined)}
      header={header}
      buttons={buttons}
    />
  );
}

export default DeleteConfirm;
