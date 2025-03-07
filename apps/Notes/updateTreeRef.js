function updateTreeRef({
  nodes,
  currentNodeUuid,
  prevTreeRef,
  rootUuid = "0",
  depth = 0,
  parentNames = [],
  parentUuid = null,
  parentUuids = [],
}) {
  let tree = [];
  const node = nodes[rootUuid];
  const inContext =
    node.content && (currentNodeUuid === node.uuid || node.checked);
  tree.push({
    ...node,
    depth,
    parentNames,
    parentUuid,
    parentUuids,
    inContext,
  });
  if (node.childrenUuids) {
    for (const childUuid of node.childrenUuids) {
      tree.push(
        ...updateTreeRef({
          nodes,
          currentNodeUuid,
          rootUuid: childUuid,
          depth: depth + 1,
          parentNames: [...parentNames, node.name],
          parentUuid: node.uuid,
          parentUuids: [...parentUuids, node.uuid],
        }),
      );
    }
  }
  if (depth === 0) {
    /*
    at the top level we:
    - add id (which is just the index of the node in the array)
    - apply the starred inContext logic (see Info)
    - add content and newContent
    - convert tree from an array into an object
    */
    const currentNode = tree.find((node) => node.uuid === currentNodeUuid);
    const currentNodeParents = new Set(currentNode.parentUuids);
    const contentLookup = Object.fromEntries(
      //need to lookup using uuid since ids are not stable
      Object.entries(prevTreeRef).map(([, node]) => [
        node.uuid,
        { content: node.content, newContent: node.newContent },
      ]),
    );
    tree = Object.fromEntries(
      tree.map((node, id) => {
        node.id = id;
        if (
          node.starred &&
          node.content &&
          currentNodeParents.has(node.parentUuid)
        ) {
          node.inContext = true;
        }
        if (!node.childrenUuids) {
          const { content = "", newContent = "" } =
            contentLookup[node.uuid] || {};
          node.content = content;
          node.newContent = newContent;
        }
        return [id, node];
      }),
    );
  }
  return tree;
}

export { updateTreeRef };
