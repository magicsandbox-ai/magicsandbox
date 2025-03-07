import { describe, expect, test } from "@jest/globals";
import { updateTreeRef } from "../updateTreeRef.js";

/*
npm run jest -- apps/Notes

checked always in
starred sometimes
*/

describe("updateTreeRef", () => {
  test("should work", () => {
    const prevTreeRef = {
      0: {
        id: 0,
        uuid: "0",
        name: "root",
        childrenUuids: ["101", "102", "103", "104"],
      },
      1: {
        id: 1,
        uuid: "101",
        name: "note 1",
        content: "content 1",
        newContent: "new content 1",
      },
      2: {
        id: 2,
        uuid: "102",
        name: "note 2",
        content: "content 2",
        newContent: "new content 2",
      },
      3: {
        id: 3,
        uuid: "103",
        name: "note 3",
        content: "content 3",
        newContent: "new content 3",
      },
      4: {
        id: 4,
        uuid: "104",
        name: "note 4",
        content: "content 4",
        newContent: "new content 4",
      },
    };
    const nodes = {
      ["0"]: {
        uuid: "0",
        name: "root",
        childrenUuids: ["101", "201", "202"],
      },
      ["101"]: {
        uuid: "101",
        name: "note 1",
        content: "content 1",
        newContent: "new content 1",
        starred: true,
      },
      ["201"]: {
        uuid: "201",
        name: "folder 1",
        childrenUuids: ["102"],
      },
      ["102"]: {
        uuid: "102",
        name: "note 2",
        content: "content 2",
        newContent: "new content 2",
      },
      ["202"]: {
        uuid: "202",
        name: "folder 2",
        childrenUuids: ["103", "104"],
      },
      ["103"]: {
        uuid: "103",
        name: "note 3",
        content: "content 3",
        newContent: "new content 3",
        starred: true,
      },
      ["104"]: {
        uuid: "104",
        name: "note 4",
        content: "content 4",
        newContent: "new content 4",
        checked: true,
      },
    };
    const currentNodeUuid = "102";
    const treeRef = updateTreeRef({ nodes, currentNodeUuid, prevTreeRef });
    expect(Object.keys(treeRef).length).toBe(7);
    expect(treeRef[0].uuid).toBe("0");
    expect(treeRef[1].uuid).toBe("101");
    expect(treeRef[1].inContext).toBe(true); //starred
    expect(treeRef[1].depth).toEqual(1);
    expect(treeRef[1].content).toEqual("content 1");
    expect(treeRef[2].uuid).toBe("201");
    expect(treeRef[2].id).toBe(2);
    expect(treeRef[3].uuid).toBe("102");
    expect(treeRef[3].depth).toEqual(2);
    expect(treeRef[3].inContext).toBe(true); //current
    expect(treeRef[4].uuid).toBe("202");
    expect(treeRef[4].childrenUuids).toEqual(["103", "104"]);
    expect(treeRef[5].uuid).toBe("103");
    expect(treeRef[5].newContent).toEqual("new content 3");
    expect(treeRef[5].inContext).toBeFalsy(); //starred, but not above current
    expect(treeRef[6].uuid).toBe("104");
    expect(treeRef[6].inContext).toBe(true); //checked
    expect(treeRef[6].parentNames).toEqual(["root", "folder 2"]);
  });
});
