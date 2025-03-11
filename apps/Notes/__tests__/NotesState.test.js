import { describe, test, expect, beforeEach } from "@jest/globals";
import NotesState from "../NotesState.js";

/*
npm run jest -- apps/Notes
*/

global.requestPutData = () => Promise.resolve(true);
global.requestDeleteData = () => Promise.resolve(true);

//wait for _scheduleUpdate
const flushTimeouts = () => new Promise((resolve) => setTimeout(resolve, 0));

const nodes = {
  ["0"]: {
    uuid: "0",
    type: "folder",
    name: "root",
    parentUuid: null,
    order: 0,
  },
  ["101"]: {
    uuid: "101",
    type: "note",
    name: "note 1",
    parentUuid: "0",
    order: 0,
    content: "content 1",
    starred: true,
  },
  ["201"]: {
    uuid: "201",
    type: "folder",
    name: "folder 1",
    parentUuid: "0",
    order: 1000,
  },
  ["102"]: {
    uuid: "102",
    type: "note",
    name: "note 2",
    parentUuid: "201",
    order: 0,
    content: "content 2",
  },
  ["202"]: {
    uuid: "202",
    type: "folder",
    name: "folder 2",
    parentUuid: "0",
    order: 2000,
  },
  ["103"]: {
    uuid: "103",
    type: "note",
    name: "note 3",
    parentUuid: "202",
    order: 0,
    content: "content 3",
    starred: true,
  },
  ["104"]: {
    uuid: "104",
    type: "note",
    name: "note 4",
    parentUuid: "202",
    order: 1000,
    content: "content 4",
    checked: true,
  },
};
const currentNodeUuid = "102";
let notesState;

beforeEach(() => {
  notesState = new NotesState(nodes, currentNodeUuid);
});

describe("NotesState", () => {
  test("constructor", () => {
    const tree = notesState.tree;
    expect(Object.keys(tree).length).toBe(7);
    expect(tree[0].uuid).toBe("0");
    expect(tree[1].uuid).toBe("101");
    expect(tree[1].inContext).toBe(true); //starred
    expect(tree[1].depth).toEqual(1);
    expect(tree[1].content).toBe("content 1");
    expect(tree[2].uuid).toBe("201");
    expect(tree[2].id).toBe(2);
    expect(tree[3].uuid).toBe("102");
    expect(tree[3].depth).toEqual(2);
    expect(tree[3].inContext).toBe(true); //current
    expect(tree[4].uuid).toBe("202");
    expect(tree[4].childrenUuids).toEqual(["103", "104"]);
    expect(tree[5].uuid).toBe("103");
    expect(tree[5].inContext).toBeFalsy(); //starred, but not above current
    expect(tree[6].uuid).toBe("104");
    expect(tree[6].inContext).toBe(true); //checked
    expect(tree[6].path).toEqual("folder 2/note 4");
  });
  test("setCurrentNodeUuid", async () => {
    const prevTree = notesState.tree;
    notesState.setCurrentNodeUuid("104");
    await flushTimeouts();
    const tree = notesState.tree;
    expect(tree).not.toBe(prevTree); //tree should be new object, not just mutated
    expect(notesState.currentNodeUuid).toBe("104");
    const nodes = notesState.nodes;
    expect(nodes["101"].inContext).toBe(true); //starred in parent folder
    expect(nodes["102"].inContext).toBe(false); //no longer current
    expect(nodes["103"].inContext).toBe(true); //starred in current folder
    expect(nodes["104"].inContext).toBe(true); //current, also checked
  });
  test("subscribe", async () => {
    const subscribeTree = notesState.subscribe("tree"); //first argument to useSyncExternalStore
    const getSnapshotTree = notesState.getSnapshot("tree"); //second argument to useSyncExternalStore
    let notificationCount = 0;
    const callback = () => {
      notificationCount++;
    };
    const unsubscribe = subscribeTree(callback);
    const prevTree = getSnapshotTree();
    notesState.setCurrentNodeUuid("104");
    await flushTimeouts();
    expect(notificationCount).toBe(1);
    const tree = getSnapshotTree();
    expect(tree).not.toBe(prevTree);
    unsubscribe();
    notesState.setCurrentNodeUuid("102");
    await flushTimeouts();
    expect(notificationCount).toBe(1); //should not change after unsubscribing
  });
  test("getDescendants", () => {
    const descendantsUuids = notesState
      .getDescendants("202")
      .map((node) => node.uuid)
      .sort();
    expect(descendantsUuids).toEqual(["103", "104", "202"]);
  });
  test("update content", async () => {
    const prevTree = notesState.tree;
    notesState.updateNode({
      uuid: "101",
      content: "new content",
    });
    await flushTimeouts();
    expect(notesState.tree).toBe(prevTree); //should not have changed
    expect(notesState.nodes["101"].content).toBe("new content");
  });
  test("update starred", async () => {
    notesState.updateNode({
      uuid: "101",
      starred: false,
    });
    await flushTimeouts();
    expect(notesState.nodes["101"].starred).toBe(false);
    expect(notesState.nodes["101"].inContext).toBe(false);
  });
  test("update order", async () => {
    notesState.updateNode({
      uuid: "103",
      order: 2000,
    });
    await flushTimeouts();
    expect(notesState.nodes["103"].order).toBe(2000);
    expect(notesState.nodes["202"].childrenUuids).toEqual(["104", "103"]);
    expect(notesState.tree[5].uuid).toBe("104");
    expect(notesState.tree[6].uuid).toBe("103");
  });
  test("addNode", async () => {
    const prevTreeLength = notesState.tree.length;
    notesState.addNode({
      uuid: "105",
      type: "note",
      name: "new note",
      parentUuid: "201",
      content: "new content",
    });
    await flushTimeouts();
    expect(notesState.tree.length).toBe(prevTreeLength + 1);
    expect(notesState.nodes["105"]).toBeDefined();
    expect(notesState.nodes["105"].name).toBe("new note");
    expect(notesState.nodes["105"].content).toBe("new content");
    expect(notesState.nodes["105"].order).toBe(1000);
    expect(notesState.nodes["201"].childrenUuids).toContain("105");
  });
  test("deleteNode", async () => {
    const prevTreeLength = notesState.tree.length;
    const note = { ...notesState.nodes["102"] };
    notesState.deleteNode(note.uuid);
    await flushTimeouts();
    expect(notesState.tree.length).toBe(prevTreeLength - 1);
    expect(notesState.nodes[note.uuid]).toBeUndefined();
    expect(notesState.nodes[note.parentUuid].childrenUuids).not.toContain(
      note.uuid,
    );
    expect(notesState.currentNodeUuid).not.toBe(note.uuid); //deleted current node
  });
  test("apiAddNote", async () => {
    const prevTreeLength = notesState.tree.length;
    const parent = notesState.nodes["201"];
    notesState.apiAddNote(parent.id, "API Note", "API Content", []);
    await flushTimeouts();
    // new note should be last child of parent
    const newNoteUuid = parent.childrenUuids[parent.childrenUuids.length - 1];
    const newNote = notesState.nodes[newNoteUuid];
    expect(notesState.tree.length).toBe(prevTreeLength + 1);
    expect(newNote.parentUuid).toBe(parent.uuid);
    expect(newNote.state).toBe("new");
    expect(newNote.name).toBe("API Note");
    expect(newNote.content).toBe("API Content");
    expect(notesState.currentNodeUuid).toBe(newNote.uuid);
  });
  test("apiAddNote with folders", async () => {
    const prevTreeLength = notesState.tree.length;
    const parent = notesState.nodes["0"];
    notesState.apiAddNote(parent.id, "Nested Note", "Nested Content", [
      "New Folder",
      "Subfolder",
    ]);
    await flushTimeouts();
    const newFolderUuid = parent.childrenUuids[parent.childrenUuids.length - 1];
    const newFolder = notesState.nodes[newFolderUuid];
    const subFolderUuid =
      newFolder.childrenUuids[newFolder.childrenUuids.length - 1];
    const subFolder = notesState.nodes[subFolderUuid];
    const newNoteUuid =
      subFolder.childrenUuids[subFolder.childrenUuids.length - 1];
    const newNote = notesState.nodes[newNoteUuid];
    expect(notesState.tree.length).toBe(prevTreeLength + 3);
    expect(newNote.parentUuid).toBe(subFolder.uuid);
    expect(newNote.state).toBe("new");
    expect(newNote.name).toBe("Nested Note");
    expect(newNote.content).toBe("Nested Content");
    expect(notesState.currentNodeUuid).toBe(newNote.uuid);
  });
  test("apiAppendToNote", async () => {
    const note = notesState.nodes["102"];
    notesState.apiAppendToNote(note.id, "Appended content");
    await flushTimeouts();
    expect(note.content).toBe("content 2\n\nAppended content");
    expect(note.prevContent).toBe("content 2");
    expect(notesState.currentNodeUuid).toBe(note.uuid);
  });
  test("apiReplaceNote", async () => {
    const note = notesState.nodes["101"];
    notesState.apiReplaceNote(note.id, "Replaced content");
    await flushTimeouts();
    expect(note.content).toBe("Replaced content");
    expect(note.prevContent).toBe("content 1");
    expect(notesState.currentNodeUuid).toBe(note.uuid);
  });
  test("apiEditNote", async () => {
    const note = notesState.nodes["102"];
    notesState.apiEditNote(note.id, "content", "edited content");
    await flushTimeouts();
    expect(note.content).toBe("edited content 2");
    expect(note.prevContent).toBe("content 2");
    expect(notesState.currentNodeUuid).toBe(note.uuid);
  });
  test("apiRenameNode", async () => {
    const note = notesState.nodes["102"];
    notesState.apiRenameNode(note.id, "Renamed Note");
    await flushTimeouts();
    expect(note.name).toBe("Renamed Note");
    expect(note.prevName).toBe("note 2");
  });
  test("apiMoveNodes", async () => {
    const note = notesState.nodes["102"];
    const prevParentUuid = note.parentUuid;
    const parent = notesState.nodes["202"];
    notesState.apiMoveNodes([note.id], parent.id);
    await flushTimeouts();
    expect(note.parentUuid).toBe(parent.uuid);
    expect(note.prevParentUuid).toBe(prevParentUuid);
    expect(parent.childrenUuids).toContain(note.uuid);
    expect(notesState.nodes[prevParentUuid].childrenUuids).not.toContain(
      note.uuid,
    );
  });
  test("apiMoveNodes with folders", async () => {
    const note = notesState.nodes["102"];
    const prevParentUuid = note.parentUuid;
    const parent = notesState.nodes["202"];
    notesState.apiMoveNodes([note.id], parent.id, ["New Move Folder"]);
    await flushTimeouts();
    const newFolderUuid = parent.childrenUuids[parent.childrenUuids.length - 1];
    const newFolder = notesState.nodes[newFolderUuid];
    expect(newFolder.parentUuid).toBe(parent.uuid);
    expect(parent.childrenUuids).toContain(newFolder.uuid);
    expect(newFolder.name).toBe("New Move Folder");
    expect(note.parentUuid).toBe(newFolder.uuid);
    expect(note.prevParentUuid).toBe(prevParentUuid);
    expect(newFolder.childrenUuids).toContain(note.uuid);
    expect(notesState.nodes[prevParentUuid].childrenUuids).not.toContain(
      note.uuid,
    );
  });
  test("apiDeleteNodes", async () => {
    const note = notesState.nodes["102"];
    notesState.apiDeleteNodes([note.id]);
    await flushTimeouts();
    expect(note.state).toBe("deleted");
  });
});
