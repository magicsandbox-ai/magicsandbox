import { v4 as uuid } from "uuid";

function addNote(appState, parentId, name, content, folders) {
  const finalParentId = _getAndCreateFolders(appState, parentId, folders);
  const newNoteId = uuid();
  const newNote = {
    id: newNoteId,
    name,
    checked: false,
    starred: false,
  };
  appState.setNodes((nodes) => ({
    ...nodes,
    [finalParentId]: {
      ...nodes[finalParentId],
      childrenIds: [...nodes[finalParentId].childrenIds, newNoteId],
    },
    [newNoteId]: newNote,
  }));
  appState.updateContent(newNoteId, content);
}

function appendToNote(appState, id, content) {
  const note = _getNote(appState, id);
  const newContent =
    (note.content?.trimEnd?.() || note.content) +
    "\n\n" +
    (content?.trimStart?.() || content);
  appState.updateNewContent(id, newContent);
}

function replaceNote(appState, id, content) {
  _getNote(appState, id);
  appState.updateNewContent(id, content);
}

function editNote(appState, id, find, replace) {
  const note = _getNote(appState, id);
  appState.updateNewContent(id, note.content.replaceAll(find, replace));
}

function renameNode(appState, id, name) {
  _getNode(appState, id);
  appState.setNodes((nodes) => ({
    ...nodes,
    [id]: {
      ...nodes[id],
      name,
    },
  }));
}

function moveNodes(appState, ids, parentId, folders) {
  const finalParentId = _getAndCreateFolders(appState, parentId, folders);
  for (const id of ids) {
    _getNode(appState, id);
  }
  appState.setNodes((nodes) => ({
    ...nodes,
    [finalParentId]: {
      ...nodes[finalParentId],
      childrenIds: [...nodes[finalParentId].childrenIds, ...ids],
      collapsed: false,
    },
  }));
}

function deleteNodes(appState, ids) {
  for (const id of ids) {
    _getNode(appState, id);
  }
  const nodesToDelete = new Set(ids);
  const nodesToVisit = ids;
  while (nodesToVisit.length > 0) {
    const id = nodesToVisit.pop();
    nodesToDelete.add(id);
    if (appState.nodesRef.current[id].childrenIds) {
      nodesToVisit.push(...appState.nodesRef.current[id].childrenIds);
    }
  }
  appState.setNodes((nodes) =>
    Object.fromEntries(
      Object.entries(nodes).filter(([key]) => !nodesToDelete.has(key)),
    ),
  );
}

export {
  addNote,
  appendToNote,
  replaceNote,
  editNote,
  renameNode,
  moveNodes,
  deleteNodes,
};

function _getAndCreateFolders(appState, parentId, folders) {
  const parent = appState.nodesRef.current[parentId];
  if (!parent) {
    throw new Error(`Parent with id ${parentId} not found`);
  }
  if (!("childrenIds" in parent)) {
    throw new Error(`parentId ${parentId} is a note, not a folder`);
  }
  if (folders.length > 0) {
    const newFolders = [];
    const newFolderIds = folders.map(() => uuid());
    for (let i = 0; i < folders.length; i++) {
      const newFolder = {
        id: newFolderIds[i],
        name: folders[i],
        collapsed: false,
        childrenIds: i === folders.length - 1 ? [] : [newFolderIds[i + 1]],
      };
      newFolders.push(newFolder);
    }
    appState.setNodes((nodes) => ({
      ...nodes,
      [parentId]: {
        ...parent,
        childrenIds: [...parent.childrenIds, newFolderIds[0]],
      },
      ...newFolders,
    }));
    return newFolderIds[folders.length - 1];
  } else {
    return parentId;
  }
}

function _getNote(appState, id) {
  const note = appState.nodesRef.current[id];
  if (!note) {
    throw new Error(`Note with id ${id} not found`);
  }
  if (!("content" in note)) {
    throw new Error(`Cannot call appendToNote on a folder with id ${id}`);
  }
  return note;
}

function _getNode(appState, id) {
  const node = appState.nodesRef.current[id];
  if (!node) {
    throw new Error(`Node with id ${id} not found`);
  }
  return node;
}
