import React from "react";
import Confirm from "@components/Confirm.js";

function DeleteConfirm({
  deleteUuid,
  setDeleteUuid,
  nodes,
  setNodes,
  toastsRef,
}) {
  const deleteNode = nodes[deleteUuid];
  let header;
  if (deleteNode.childrenUuids) {
    header = `Are you sure you want to delete folder "${deleteNode.name}" and all its contents?`;
  } else {
    header = `Are you sure you want to delete note "${deleteNode.name}"?`;
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
      onClick: async () => {
        try {
          const nodesToDelete = new Set();
          const nodesToVisit = [deleteUuid];
          while (nodesToVisit.length > 0) {
            const currentUuid = nodesToVisit.pop();
            nodesToDelete.add(currentUuid);
            nodesToVisit.push(...nodes[currentUuid].childrenUuids);
          }
          setNodes((nodes) => {
            Object.fromEntries(
              Object.entries(nodes).filter(
                ([uuid]) => !nodesToDelete.has(uuid),
              ),
            );
          });
          setDeleteUuid(null);
          await Promise.all(
            nodesToDelete.map((uuid) => requestDeleteData(uuid)),
          );
        } catch (error) {
          console.error(error);
          toastsRef.current.addToast("Error deleting notes", "error");
        }
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
