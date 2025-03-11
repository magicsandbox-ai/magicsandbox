import React from "react";
import Confirm from "@components/Confirm.js";

function DeleteConfirm({ deleteUuid, setDeleteUuid, notesState }) {
  const deleteNode = notesState.nodes[deleteUuid];
  let header;
  if (deleteNode.type === "folder") {
    header = `Are you sure you want to delete folder "${deleteNode.path}" and all its contents?`;
  } else {
    header = `Are you sure you want to delete note "${deleteNode.path}"?`;
  }
  const buttons = [
    {
      text: "Cancel",
      className: "bg-stone-300 hover:bg-stone-400 text-black w-32",
      onClick: () => setDeleteUuid(null),
    },
    {
      text: "Delete",
      className: "bg-red-500 hover:bg-red-700 text-white w-32",
      onClick: () => {
        const descendants = notesState.getDescendants(deleteUuid);
        descendants.forEach((node) => {
          notesState.deleteNode(node.uuid);
        });
        setDeleteUuid(null);
      },
    },
  ];
  return (
    <Confirm
      onClose={() => setDeleteUuid(null)}
      header={header}
      buttons={buttons}
    />
  );
}

export default DeleteConfirm;
