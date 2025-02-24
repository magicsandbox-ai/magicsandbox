import React from "react";
import Confirm from "@components/Confirm.js";

function DeleteConfirm({ deleteId, setDeleteId, nodes, setNodes }) {
  const deleteNode = nodes[deleteId];
  let header;
  if (deleteNode.childrenIds) {
    header = `Are you sure you want to delete folder "${deleteNode.name}" and all its contents?`;
  } else {
    header = `Are you sure you want to delete note "${deleteNode.name}"?`;
  }
  const nodesToDelete = new Set();
  const nodesToVisit = [deleteId];
  while (nodesToVisit.length > 0) {
    const currentId = nodesToVisit.pop();
    nodesToDelete.add(currentId);
    nodesToVisit.push(...nodes[currentId].childrenIds);
  }
  const buttons = [
    {
      text: "Cancel",
      className: "bg-stone-300 hover:bg-stone-400 text-black w-32",
      onClick: () => setDeleteId(null),
    },
    {
      text: "Delete",
      className: "bg-red-500 hover:bg-red-700 text-white w-32",
      onClick: () => {
        setNodes((nodes) => {
          Object.fromEntries(
            Object.entries(nodes).filter(([id]) => !nodesToDelete.has(id)),
          );
        });
        setDeleteId(null);
      },
    },
  ];
  return (
    <Confirm
      onClose={() => setDeleteId(null)}
      header={header}
      buttons={buttons}
    />
  );
}

export default DeleteConfirm;
