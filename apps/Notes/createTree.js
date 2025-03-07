function createTree(nodes, currentNodeUuid) {
  //make a copy
  const updatedNodes = Object.fromEntries(
    Object.entries(nodes).map(([uuid, node]) => [uuid, { ...node }]),
  );

  //add childrenUuids to parent nodes
  Object.entries(updatedNodes).forEach(([uuid, node]) => {
    if (node.parentUuid === null) return; //skip root
    const parentNode = updatedNodes[node.parentUuid];
    if (parentNode) {
      if (parentNode.childrenUuids) {
        parentNode.childrenUuids.push(uuid);
      } else if ("collapsed" in parentNode) {
        parentNode.childrenUuids = [uuid];
      } else {
        updatedNodes[uuid].parentUuid = "0"; //assign to root if its parent is not a folder
      }
    } else {
      updatedNodes[uuid].parentUuid = "0"; //assign to root if its parent is missing
    }
  });

  //sort childrenUuids
  Object.entries(updatedNodes).forEach(([, node]) => {
    if (node.childrenUuids?.length > 1) {
      node.childrenUuids.sort(
        (a, b) => updatedNodes[a].order - updatedNodes[b].order,
      );
    }
  });
  return createTreeRecursive({
    nodes: updatedNodes,
    currentNodeUuid,
  });
}

function createTreeRecursive({
  nodes,
  currentNodeUuid,
  rootUuid = "0",
  depth = 0,
  ancestorNames = [],
  ancestorUuids = [],
}) {
  let tree = [];
  const node = nodes[rootUuid];
  const inContext =
    node.content && (currentNodeUuid === node.uuid || node.checked);
  delete node.content;
  delete node.prevContent;
  tree.push({
    ...node,
    depth,
    ancestorNames,
    ancestorUuids,
    inContext,
  });
  if (node.childrenUuids) {
    for (const childUuid of node.childrenUuids) {
      tree.push(
        ...createTreeRecursive({
          nodes,
          currentNodeUuid,
          rootUuid: childUuid,
          depth: depth + 1,
          ancestorNames: [...ancestorNames, node.name],
          ancestorUuids: [...ancestorUuids, node.uuid],
        }),
      );
    }
  }
  if (depth === 0) {
    /*
    at the top level we:
    - add id (which is just the index of the node in the array)
    - apply the starred inContext logic (see Info)
    - convert tree from an array into an object
    */
    const currentNode = tree.find((node) => node.uuid === currentNodeUuid);
    const currentNodeParents = new Set(currentNode.ancestorUuids);
    tree = Object.fromEntries(
      tree.map((node, id) => {
        node.id = id;
        if (node.starred && currentNodeParents.has(node.parentUuid)) {
          node.inContext = true;
        }
        return [id, node];
      }),
    );
  }
  return tree;
}

export { createTree };
