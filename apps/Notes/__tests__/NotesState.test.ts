//@ts-nocheck

import { describe, test, expect, beforeEach } from "@jest/globals";
import NotesState from "../NotesState.ts";
import type { NodeData } from "../NotesState.ts";

/*
npm run jest -- apps/Notes/__tests__/NotesState.test.ts
*/

global.requestPutData = () => Promise.resolve(true);
global.requestDeleteData = () => Promise.resolve(true);

//wait for _scheduleUpdate
const flushTimeouts = () => new Promise((resolve) => setTimeout(resolve, 0));

let notesState: NotesState;

const nodes: Record<string, NodeData> = {
  ["0"]: {
    uuid: "0",
    type: "folder",
    name: "Root Folder",
    order: 0,
    collapsed: false,
    childrenUuids: [],
  },
  ["101"]: {
    uuid: "101",
    type: "note",
    state: "new",
    name: "note 1",
    parentUuid: "0",
    order: 0,
    content: "content 1",
    checked: false,
    starred: true,
  },
  ["201"]: {
    uuid: "201",
    type: "folder",
    name: "folder 1",
    prevName: "previous folder 1",
    parentUuid: "0",
    order: 1000,
    collapsed: false,
    childrenUuids: [],
  },
  ["102"]: {
    uuid: "102",
    type: "note",
    state: "deleted",
    name: "note 2",
    parentUuid: "201",
    order: 0,
    content: "content 2",
    checked: false,
    starred: false,
  },
  ["202"]: {
    uuid: "202",
    type: "folder",
    name: "folder 2",
    parentUuid: "0",
    order: 2000,
    collapsed: false,
    childrenUuids: [],
  },
  ["103"]: {
    uuid: "103",
    type: "note",
    name: "note 3",
    parentUuid: "202",
    prevParentUuid: "0",
    order: 0,
    content: "content 3",
    checked: false,
    starred: true,
  },
  ["104"]: {
    uuid: "104",
    type: "note",
    name: "note 4",
    parentUuid: "202",
    order: 1000,
    content: "content 4",
    prevContent: "previous content 4",
    checked: true,
    starred: false,
  },
};
const currentNodeUuid = "102";

beforeEach(() => {
  notesState = new NotesState(nodes, currentNodeUuid);
});

describe("NotesState", () => {
  test("constructor", () => {
    const tree = notesState.tree;
    expect(Object.keys(tree).length).toBe(7);
    expect(tree[0].nodeData.uuid).toBe("0");
    expect(tree[1].nodeData.uuid).toBe("101");
    expect(tree[1].treeData.inContext).toBe(true); //starred
    expect(tree[1].treeData.depth).toEqual(1);
    expect(tree[1].nodeData.content).toBe("content 1");
    expect(tree[2].nodeData.uuid).toBe("201");
    expect(tree[2].treeData.id).toBe(2);
    expect(tree[3].nodeData.uuid).toBe("102");
    expect(tree[3].treeData.depth).toEqual(2);
    expect(tree[3].treeData.inContext).toBe(true); //current
    expect(tree[4].nodeData.uuid).toBe("202");
    expect(tree[4].nodeData.childrenUuids).toEqual(["103", "104"]);
    expect(tree[5].nodeData.uuid).toBe("103");
    expect(tree[5].treeData.inContext).toBeFalsy(); //starred, but not above current
    expect(tree[6].nodeData.uuid).toBe("104");
    expect(tree[6].treeData.inContext).toBe(false); //checked set to false on init
    expect(tree[6].treeData.path).toEqual("folder 2/note 4");
  });
  test("setCurrentNodeUuid", async () => {
    const prevTree = notesState.getSnapshot("tree")();
    notesState.setCurrentNodeUuid("104");
    await flushTimeouts();
    const tree = notesState.getSnapshot("tree")();
    expect(tree).not.toBe(prevTree); //tree should be new object, not just mutated
    expect(notesState.currentNodeUuid).toBe("104");
    const nodes = notesState.nodes;
    expect(nodes["101"].treeData.inContext).toBe(true); //starred in parent folder
    expect(nodes["102"].treeData.inContext).toBe(false); //no longer current
    expect(nodes["103"].treeData.inContext).toBe(true); //starred in current folder
    expect(nodes["104"].treeData.inContext).toBe(true); //current, also checked
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
      .map((node) => node.nodeData.uuid)
      .sort();
    expect(descendantsUuids).toEqual(["103", "104", "202"]);
  });
  test("update content", async () => {
    const prevTree = notesState.getSnapshot("tree")();
    notesState.updateNode({
      uuid: "101",
      content: "new content",
    });
    await flushTimeouts();
    expect(notesState.getSnapshot("tree")()).toBe(prevTree); //should not have changed
    expect(notesState.nodes["101"].nodeData.content).toBe("new content");
  });
  test("update starred", async () => {
    notesState.updateNode({
      uuid: "101",
      starred: false,
    });
    await flushTimeouts();
    expect(notesState.nodes["101"].nodeData.starred).toBe(false);
    expect(notesState.nodes["101"].treeData.inContext).toBe(false);
  });
  test("update order", async () => {
    notesState.updateNode({
      uuid: "103",
      order: 2000,
    });
    await flushTimeouts();
    expect(notesState.nodes["103"].nodeData.order).toBe(2000);
    expect(notesState.nodes["202"].nodeData.childrenUuids).toEqual([
      "104",
      "103",
    ]);
    expect(notesState.tree[5].nodeData.uuid).toBe("104");
    expect(notesState.tree[6].nodeData.uuid).toBe("103");
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
    expect(notesState.nodes["105"].nodeData.name).toBe("new note");
    expect(notesState.nodes["105"].nodeData.content).toBe("new content");
    expect(notesState.nodes["105"].nodeData.order).toBe(1000);
    expect(notesState.nodes["201"].nodeData.childrenUuids).toContain("105");
  });
  test("deleteNode", async () => {
    const prevTreeLength = notesState.tree.length;
    const note = { ...notesState.nodes["102"] };
    notesState.deleteNode(note.nodeData.uuid);
    await flushTimeouts();
    expect(notesState.tree.length).toBe(prevTreeLength - 1);
    expect(notesState.nodes[note.nodeData.uuid]).toBeUndefined();
    expect(
      notesState.nodes[note.nodeData.parentUuid].nodeData.childrenUuids,
    ).not.toContain(note.nodeData.uuid);
    expect(notesState.currentNodeUuid).not.toBe(note.nodeData.uuid); //deleted current node
  });
  test("apiAddNote", async () => {
    const prevTreeLength = notesState.tree.length;
    const parent = notesState.nodes["201"];
    notesState.apiAddNote(parent.treeData.id, "API Note", "API Content", []);
    await flushTimeouts();
    // new note should be last child of parent
    const newNoteUuid =
      parent.nodeData.childrenUuids[parent.nodeData.childrenUuids.length - 1];
    const newNote = notesState.nodes[newNoteUuid];
    expect(notesState.tree.length).toBe(prevTreeLength + 1);
    expect(newNote.nodeData.parentUuid).toBe(parent.nodeData.uuid);
    expect(newNote.nodeData.state).toBe("new");
    expect(newNote.nodeData.name).toBe("API Note");
    expect(newNote.nodeData.content).toBe("API Content");
    expect(notesState.currentNodeUuid).toBe(newNote.nodeData.uuid);
  });
  test("apiAddNote with folders", async () => {
    const prevTreeLength = notesState.tree.length;
    const parent = notesState.nodes["0"];
    notesState.apiAddNote(parent.treeData.id, "Nested Note", "Nested Content", [
      "New Folder",
      "Subfolder",
    ]);
    await flushTimeouts();
    const newFolderUuid =
      parent.nodeData.childrenUuids[parent.nodeData.childrenUuids.length - 1];
    const newFolder = notesState.nodes[newFolderUuid];
    const subFolderUuid =
      newFolder.nodeData.childrenUuids[
        newFolder.nodeData.childrenUuids.length - 1
      ];
    const subFolder = notesState.nodes[subFolderUuid];
    const newNoteUuid =
      subFolder.nodeData.childrenUuids[
        subFolder.nodeData.childrenUuids.length - 1
      ];
    const newNote = notesState.nodes[newNoteUuid];
    expect(notesState.tree.length).toBe(prevTreeLength + 3);
    expect(newFolder.nodeData.name).toBe("New Folder");
    expect(newFolder.nodeData.state).toBe("new");
    expect(newFolder.nodeData.parentUuid).toBe(parent.nodeData.uuid);
    expect(newFolder.nodeData.childrenUuids).toEqual([subFolderUuid]);
    expect(subFolder.nodeData.parentUuid).toBe(newFolder.nodeData.uuid);
    expect(newNote.nodeData.parentUuid).toBe(subFolder.nodeData.uuid);
    expect(newNote.nodeData.state).toBe("new");
    expect(newNote.nodeData.name).toBe("Nested Note");
    expect(newNote.nodeData.content).toBe("Nested Content");
    expect(notesState.currentNodeUuid).toBe(newNote.nodeData.uuid);
  });
  test("apiAddNote multiple to a new folder", async () => {
    const prevTreeLength = notesState.tree.length;
    const parent = notesState.nodes["0"];
    const newFolderId = notesState.apiAddNote(
      parent.treeData.id,
      "Note 1",
      "Content 1",
      ["New Folder"],
    );
    notesState.apiAddNote(newFolderId, "Note 2", "Content 2");
    await flushTimeouts();
    const newFolderUuid =
      parent.nodeData.childrenUuids[parent.nodeData.childrenUuids.length - 1];
    const newFolder = notesState.nodes[newFolderUuid];
    const note1Uuid = newFolder.nodeData.childrenUuids[0];
    const note1 = notesState.nodes[note1Uuid];
    const note2Uuid = newFolder.nodeData.childrenUuids[1];
    const note2 = notesState.nodes[note2Uuid];
    expect(notesState.tree.length).toBe(prevTreeLength + 3);
    expect(note1.nodeData.parentUuid).toBe(newFolder.nodeData.uuid);
    expect(note1.nodeData.name).toBe("Note 1");
    expect(note1.nodeData.content).toBe("Content 1");
    expect(note2.nodeData.parentUuid).toBe(newFolder.nodeData.uuid);
    expect(note2.nodeData.name).toBe("Note 2");
    expect(note2.nodeData.content).toBe("Content 2");
  });
  test("apiAppendToNote", async () => {
    const note = notesState.nodes["102"];
    notesState.apiAppendToNote(note.treeData.id, "Appended content");
    await flushTimeouts();
    expect(note.nodeData.content).toBe("content 2\nAppended content");
    expect(note.nodeData.prevContent).toBe("content 2");
    expect(notesState.currentNodeUuid).toBe(note.nodeData.uuid);
  });
  test("apiReplaceNote", async () => {
    const note = notesState.nodes["101"];
    notesState.apiReplaceNote(note.treeData.id, "Replaced content");
    await flushTimeouts();
    expect(note.nodeData.content).toBe("Replaced content");
    expect(note.nodeData.prevContent).toBe("content 1");
    expect(notesState.currentNodeUuid).toBe(note.nodeData.uuid);
  });
  test("apiEditNote", async () => {
    const note = notesState.nodes["102"];
    notesState.apiEditNote(note.treeData.id, "content", "edited content");
    await flushTimeouts();
    expect(note.nodeData.content).toBe("edited content 2");
    expect(note.nodeData.prevContent).toBe("content 2");
    expect(notesState.currentNodeUuid).toBe(note.nodeData.uuid);
  });
  test("apiRenameNode", async () => {
    const note = notesState.nodes["102"];
    notesState.apiRenameNode(note.treeData.id, "Renamed Note");
    await flushTimeouts();
    expect(note.nodeData.name).toBe("Renamed Note");
    expect(note.nodeData.prevName).toBe("note 2");
  });
  test("apiMoveNodes", async () => {
    const note = notesState.nodes["102"];
    const prevParentUuid = note.nodeData.parentUuid;
    const parent = notesState.nodes["202"];
    notesState.apiMoveNodes([note.treeData.id], parent.treeData.id);
    await flushTimeouts();
    expect(note.nodeData.parentUuid).toBe(parent.nodeData.uuid);
    expect(note.nodeData.prevParentUuid).toBe(prevParentUuid);
    expect(parent.nodeData.childrenUuids).toContain(note.nodeData.uuid);
    expect(
      notesState.nodes[prevParentUuid].nodeData.childrenUuids,
    ).not.toContain(note.nodeData.uuid);
  });
  test("apiMoveNodes with folders", async () => {
    const note = notesState.nodes["102"];
    const prevParentUuid = note.nodeData.parentUuid;
    const parent = notesState.nodes["202"];
    notesState.apiMoveNodes([note.treeData.id], parent.treeData.id, [
      "New Move Folder",
    ]);
    await flushTimeouts();
    const newFolderUuid =
      parent.nodeData.childrenUuids[parent.nodeData.childrenUuids.length - 1];
    const newFolder = notesState.nodes[newFolderUuid];
    expect(newFolder.nodeData.parentUuid).toBe(parent.nodeData.uuid);
    expect(parent.nodeData.childrenUuids).toContain(newFolder.nodeData.uuid);
    expect(newFolder.nodeData.name).toBe("New Move Folder");
    expect(note.nodeData.parentUuid).toBe(newFolder.nodeData.uuid);
    expect(note.nodeData.prevParentUuid).toBe(prevParentUuid);
    expect(newFolder.nodeData.childrenUuids).toContain(note.nodeData.uuid);
    expect(
      notesState.nodes[prevParentUuid].nodeData.childrenUuids,
    ).not.toContain(note.nodeData.uuid);
  });
  test("apiDeleteNodes", async () => {
    const note = notesState.nodes["102"];
    notesState.apiDeleteNodes([note.treeData.id]);
    await flushTimeouts();
    expect(note.nodeData.state).toBe("deleted");
  });
  test("uncollapseAncestors", async () => {
    const parent = notesState.nodes["202"];
    const child = notesState.nodes["103"];
    notesState.updateNode({
      uuid: parent.nodeData.uuid,
      collapsed: true,
    });
    await flushTimeouts();
    expect(parent.nodeData.collapsed).toBe(true);
    notesState.setCurrentNodeUuid(child.nodeData.uuid); //should trigger ancestors to uncollapse
    await flushTimeouts();
    expect(parent.nodeData.collapsed).toBe(false);
  });
  test("approveAllChanges", async () => {
    notesState.approveAllChanges();
    await flushTimeouts();
    expect(notesState.nodes["101"].nodeData.state).toBeUndefined();
    expect(notesState.nodes["201"].nodeData.prevName).toBeUndefined();
    expect(notesState.nodes["102"]).toBeUndefined();
    expect(notesState.nodes["103"].nodeData.prevParentUuid).toBeUndefined();
    expect(notesState.nodes["104"].nodeData.prevContent).toBeUndefined();
  });
  test("rejectAllChanges", async () => {
    notesState.rejectAllChanges();
    await flushTimeouts();
    expect(notesState.nodes["101"]).toBeUndefined();
    expect(notesState.nodes["201"].nodeData.name).toBe("previous folder 1");
    expect(notesState.nodes["201"].nodeData.prevName).toBeUndefined();
    expect(notesState.nodes["102"].nodeData.state).toBeUndefined();
    expect(notesState.nodes["103"].nodeData.parentUuid).toBe("0");
    expect(notesState.nodes["103"].nodeData.prevParentUuid).toBeUndefined();
    expect(notesState.nodes["104"].nodeData.content).toBe("previous content 4");
    expect(notesState.nodes["104"].nodeData.prevContent).toBeUndefined();
  });
});
