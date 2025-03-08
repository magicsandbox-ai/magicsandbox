import { describe, expect, test } from "@jest/globals";
import { createTree } from "../createTree.js";

/*
npm run jest -- apps/Notes

todo test order
*/

describe("createTree", () => {
  test("should work", () => {
    const nodes = {
      ["0"]: {
        uuid: "0",
        type: "folder",
        name: "root",
        parentUuid: null,
        collapsed: false,
      },
      ["101"]: {
        uuid: "101",
        type: "note",
        name: "note 1",
        content: "content 1",
        prevContent: "new content 1",
        checked: false,
        starred: true,
        parentUuid: "0",
      },
      ["201"]: {
        uuid: "201",
        type: "folder",
        name: "folder 1",
        parentUuid: "0",
        collapsed: false,
      },
      ["102"]: {
        uuid: "102",
        type: "note",
        name: "note 2",
        content: "content 2",
        prevContent: "new content 2",
        parentUuid: "201",
        checked: false,
        starred: false,
      },
      ["202"]: {
        uuid: "202",
        type: "folder",
        name: "folder 2",
        collapsed: false,
        parentUuid: "0",
      },
      ["103"]: {
        uuid: "103",
        type: "note",
        name: "note 3",
        content: "content 3",
        prevContent: "new content 3",
        checked: false,
        starred: true,
        parentUuid: "202",
      },
      ["104"]: {
        uuid: "104",
        type: "note",
        name: "note 4",
        content: "content 4",
        prevContent: "new content 4",
        checked: true,
        starred: false,
        parentUuid: "202",
      },
    };
    const currentNodeUuid = "102";
    const tree = createTree(nodes, currentNodeUuid);
    expect(Object.keys(tree).length).toBe(7);
    expect(tree[0].uuid).toBe("0");
    expect(tree[1].uuid).toBe("101");
    expect(tree[1].inContext).toBe(true); //starred
    expect(tree[1].depth).toEqual(1);
    expect(tree[1].content).toBeUndefined();
    expect(tree[2].uuid).toBe("201");
    expect(tree[2].id).toBe(2);
    expect(tree[3].uuid).toBe("102");
    expect(tree[3].depth).toEqual(2);
    expect(tree[3].inContext).toBe(true); //current
    expect(tree[4].uuid).toBe("202");
    expect(tree[4].childrenUuids).toEqual(["103", "104"]);
    expect(tree[5].uuid).toBe("103");
    expect(tree[5].prevContent).toBeUndefined();
    expect(tree[5].inContext).toBeFalsy(); //starred, but not above current
    expect(tree[6].uuid).toBe("104");
    expect(tree[6].inContext).toBe(true); //checked
    expect(tree[6].ancestorNames).toEqual(["root", "folder 2"]);
  });
});
