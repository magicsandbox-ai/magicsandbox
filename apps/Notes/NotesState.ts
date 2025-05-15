import { v4 as uuid } from "uuid";
import SyncExternalStore from "./SyncExternalStore.ts";
import type { ToastsRef } from "@components/Toasts.tsx";

/*
The database has keys:

- currentNodeUuid: string
- [uuid]: NodeData

Notes:
- NodeData is the "source of truth" - this is what's stored in the database
  - This actually not strictly true - childrenUuids should be moved to TreeData? Or just scrap this approach and do something simpler?
  - The root node is a folder with uuid "0"
- ChangeData is computed from NodeData and used to describe changes
- TreeData is computed from NodeData and used to display the tree, aka folder and note structure
  - id is an integer that's easy for the assistant to reference vs. a long uuid
  - The root node has id 0, and the remaining nodes 1...n in depth first order
- NotesState.tree is an array of nodes, with the index in the array being the node's id
*/

declare let setTimeout: WindowOrWorkerGlobalScope["setTimeout"];

type NodeType = "folder" | "note";

type NodeState = "new" | "deleted";

/**
 * Base data structure shared between folders and notes
 */
interface BaseData {
  /** Unique identifier for the node. Root node has uuid "0" */
  uuid: string;
  /** Type of node - either "folder" or "note" */
  type: NodeType;
  /** Current state of the node - "new" or "deleted" */
  state?: NodeState;
  /** Display name of the node */
  name: string;
  /** Previous name of the node, used for tracking renames */
  prevName?: string;
  /** UUID of the parent node. Undefined for root node */
  parentUuid?: string;
  /** Previous parent UUID, used for tracking moves */
  prevParentUuid?: string;
  /** Position of the node within its parent's children */
  order: number;
}

/**
 * Folder specific data
 */
interface FolderData {
  /** Whether the folder is collapsed */
  collapsed: boolean;
  /** Uuids of the folder's children (not grandchildren, etc.), sorted by order */
  childrenUuids: string[];
}

/**
 * Note specific data
 */
interface NoteData {
  /** Content of the note */
  content: string;
  /** Previous content of the note, used for tracking edits */
  prevContent?: string;
  /** Whether the note is checked, impacts inContext */
  checked: boolean;
  /** Whether the note is starred, impacts inContext */
  starred: boolean;
}

/**
 * Combined data structure for folders and notes, source of truth data
 */
type NodeData = BaseData & (FolderData | NoteData);

/**
 * Tree data, computed from NodeData
 */
interface TreeData {
  /** Integer id for the node, easy for the assistant to reference vs. a long uuid. Root node has id 0, and the remaining nodes 1...n in depth first order */
  id: number;
  /** Depth of the node in the tree */
  depth: number;
  /** Path of the node in the tree (parent, grandparent, etc. folder names) */
  path: string;
  /** Uuids of the node's ancestors (parent, grandparent, etc.) */
  ancestorUuids: string[];
  /** Whether the node is displayed in the tree (i.e. are any of its ancestors collapsed?) */
  display: boolean;
  /** Whether the note is in context for the assistant - see Info.tsx */
  inContext: boolean;
}

type TreeNode = Node & { treeData: TreeData };
type TreeFolder = TreeNode & { nodeData: FolderData };
type TreeNote = TreeNode & { nodeData: NoteData };

interface ChangeData {
  change?: "new" | "deleted" | "moved" | "renamed" | "edited";
  changeDetails?: string;
}

type NotesStateUpdate = "tree" | "inContext" | "setTree";

type ClonedNode = Pick<
  TreeNode,
  "nodeData" | "changeData" | "treeData" | "isFolder" | "isNote" | "isFolder"
>;

/**
 * Clone a node, preserving isFolder and isNote methods
 */
function cloneNode(node: TreeNode): ClonedNode {
  return {
    nodeData: node.nodeData,
    changeData: node.changeData,
    treeData: node.treeData,
    isFolder: node.isFolder,
    isNote: node.isNote,
  };
}

function generateUuid() {
  return uuid();
}

class Node {
  notesState: NotesState;
  nodeData: NodeData;
  changeData: ChangeData;
  treeData?: TreeData;
  private timeoutId?: number;

  constructor({
    notesState,
    uuid,
    type,
    state,
    name,
    prevName,
    parentUuid,
    prevParentUuid,
    order,
    collapsed,
    content,
    prevContent,
    checked,
    starred,
    save = true,
  }: {
    notesState: NotesState;
    uuid?: string;
    type: NodeType;
    state?: NodeState;
    name?: string;
    prevName?: string;
    parentUuid?: string;
    prevParentUuid?: string;
    order?: number;
    collapsed?: boolean;
    content?: string;
    prevContent?: string;
    checked?: boolean;
    starred?: boolean;
    save?: boolean;
  }) {
    this.notesState = notesState;
    this.nodeData = {
      // Base data
      uuid: uuid || generateUuid(),
      type,
      state: state || undefined, //for backwards compatibility - at one point this was allowed to be null. null || undefined resolves to undefined
      name: name || (type === "folder" ? "New Folder" : "New Note"),
      prevName: prevName || undefined,
      parentUuid: uuid !== "0" ? parentUuid || "0" : undefined,
      prevParentUuid: prevParentUuid || undefined,
      order: order || 0,
      ...(type === "folder"
        ? {
            collapsed: collapsed || false,
            childrenUuids: [],
          }
        : {
            content: content || "",
            prevContent: prevContent || undefined,
            checked: checked || false,
            starred: starred || false,
          }),
    };
    this.changeData = this.getChangeData();
    if (save) {
      this.save();
    }
  }
  isFolder(): this is Node & { nodeData: BaseData & FolderData } {
    return this.nodeData.type === "folder";
  }
  isNote(): this is Node & { nodeData: BaseData & NoteData } {
    return this.nodeData.type === "note";
  }
  update(nodeData: Partial<NodeData>) {
    this.nodeData = { ...this.nodeData, ...nodeData };
    this.changeData = this.getChangeData();
    this.save();
  }
  getChangeData(): ChangeData {
    const { state, parentUuid, prevParentUuid, name, prevName } = this.nodeData;
    let change: ChangeData["change"];
    const changeDetails = [];
    if (state === "new") {
      change = "new";
      changeDetails.push("New");
    }
    if (prevParentUuid !== undefined && prevParentUuid !== parentUuid) {
      change = "moved";
      const prevParent = this.notesState.nodesData?.[prevParentUuid];
      changeDetails.push(
        prevParent ? `Moved from ${prevParent.name}` : "Moved",
      );
    }
    if (prevName !== undefined && prevName !== name) {
      change = "renamed";
      changeDetails.push(prevName ? `Renamed from ${prevName}` : "Renamed");
    }
    if (
      this.isNote() &&
      this.nodeData.prevContent !== undefined &&
      this.nodeData.prevContent !== this.nodeData.content
    ) {
      change = "edited";
      changeDetails.push("Edited");
    }
    if (state === "deleted") {
      change = "deleted";
      changeDetails.push("Deleted");
    }
    return { change, changeDetails: changeDetails.reverse().join(", ") };
  }
  save() {
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      requestPutData(this.nodeData.uuid, this.nodeData).catch((error) => {
        this.notesState.putErrorHandler(error);
      });
    }, 300);
  }
  delete() {
    clearTimeout(this.timeoutId);
    requestDeleteData(this.nodeData.uuid).catch((error) => {
      this.notesState.putErrorHandler(error);
    });
  }
}

class NotesState extends SyncExternalStore<{
  currentNode: ClonedNode;
  tree: TreeNode[];
}> {
  nodesData: Record<string, NodeData> | undefined;
  nodes: Record<string, Node>;
  currentNodeUuid: string;
  _toastsRef?: ToastsRef;
  _putErrorHandled?: boolean;
  _update?: NotesStateUpdate;
  tree!: TreeNode[];
  _putCurrentNodeUuidTimeoutId?: number;
  _init?: boolean;

  constructor(nodesData?: Record<string, NodeData>, currentNodeUuid?: string) {
    super();
    this.nodesData = nodesData;
    if (!nodesData || Object.keys(nodesData).length === 0) {
      const uuid = generateUuid();
      this.nodes = {
        ["0"]: new Node({
          notesState: this,
          uuid: "0",
          type: "folder",
          name: "Root Folder",
          parentUuid: undefined,
        }),
        [uuid]: new Node({
          notesState: this,
          uuid,
          type: "note",
        }),
      };
      currentNodeUuid = uuid;
    } else {
      this.nodes = Object.fromEntries(
        Object.entries(nodesData).map(([uuid, node]) => [
          uuid,
          new Node({
            notesState: this,
            ...node,
            checked: false, //reset checked when starting a new session
            save: false, //don't need to save on initial load
          }),
        ]),
      );
    }
    this.currentNodeUuid = currentNodeUuid || "0";
    this._createTree();
  }
  putErrorHandler(error: Error) {
    console.error(error);
    if (this._toastsRef && !this._putErrorHandled) {
      let message = "Unexpected error saving notes";
      if (error.message === "Database size limit exceeded") {
        message =
          "Error saving notes: maximum storage limit reached. Delete some notes to free up space.";
      }
      this._toastsRef.addToast(message, "error");
      this._putErrorHandled = true; //avoid displaying too many toasts
      setTimeout(() => {
        this._putErrorHandled = false;
      }, 5000);
    }
  }
  setCurrentNodeUuid(newCurrentNodeUuid: string, scheduleUpdate = true) {
    if (!(newCurrentNodeUuid in this.nodes)) {
      throw new Error(`Node with uuid ${newCurrentNodeUuid} not found`);
    }
    /*
    if the user navigates away from a new node, we mark it as no longer new
    but if apiAddNote is called twice in a batch, setCurrentNodeUuid is called twice
    and we don't want to mark the first note as no longer new on the second call
    so we check to see if currentNode.treeData.id is set, which is a hacky way to identify "batches" of apiAddNote calls
    todo come up with a better solution
    */
    const currentNode = this.nodes[this.currentNodeUuid];
    if (currentNode?.nodeData.state === "new" && currentNode.treeData?.id) {
      this.updateNode({
        uuid: currentNode.nodeData.uuid,
        state: undefined,
      });
    }
    this.currentNodeUuid = newCurrentNodeUuid;
    clearTimeout(this._putCurrentNodeUuidTimeoutId);
    this._putCurrentNodeUuidTimeoutId = setTimeout(() => {
      requestPutData("currentNodeUuid", newCurrentNodeUuid).catch((error) => {
        this.putErrorHandler(error);
      });
    }, 300);
    if (scheduleUpdate) {
      this._scheduleUpdate("inContext"); //depends on currentNodeUuid
    }
    this._uncollapseAncestors(newCurrentNodeUuid);
  }
  _createTree() {
    //init children array
    Object.values(this.nodes).forEach((node) => {
      if (node.isFolder()) {
        node.nodeData.childrenUuids = [];
      }
    });

    //add childrenUuids to parent nodes
    Object.entries(this.nodes).forEach(([uuid, node]) => {
      if (uuid === "0") return; //skip root
      const parentNode = this.nodes[node.nodeData.parentUuid!];
      if (parentNode?.isFolder()) {
        parentNode.nodeData.childrenUuids.push(uuid);
      } else {
        //assign to root if its parent is missing (or not a folder somehow)
        //this can happen if the user approves parent deletion and rejects a child move
        node.nodeData.parentUuid = "0";
        //@ts-ignore
        this.nodes["0"].nodeData.childrenUuids.push(uuid);
      }
    });

    //sort childrenUuids
    Object.values(this.nodes).forEach((node) => {
      if (node.isFolder() && node.nodeData.childrenUuids?.length > 1) {
        node.nodeData.childrenUuids.sort(
          (a, b) =>
            (this.nodes[a]?.nodeData.order ?? 0) -
            (this.nodes[b]?.nodeData.order ?? 0),
        );
      }
    });
    this.tree = this._createTreeRecursive();
    this._updateInContext();
  }
  _createTreeRecursive({
    rootUuid = "0",
    depth = 0,
    path = "",
    ancestorUuids = [],
    display = true,
  }: {
    rootUuid?: string;
    depth?: number;
    path?: string;
    ancestorUuids?: string[];
    display?: boolean;
  } = {}) {
    let tree: TreeNode[] = [];
    const node = this.nodes[rootUuid];
    if (!node) {
      return tree;
    }
    const newPath = path ? `${path}/${node.nodeData.name}` : node.nodeData.name;
    node.treeData = {
      id: -1, //will be set in _updateInContext
      depth,
      path: newPath,
      ancestorUuids,
      display: rootUuid === "0" ? false : display, //don't display root
      inContext: false, //will be set in _updateInContext
    };
    tree.push(node as TreeNode);
    if (node.isFolder()) {
      for (const childUuid of node.nodeData.childrenUuids) {
        tree.push(
          ...this._createTreeRecursive({
            rootUuid: childUuid,
            depth: depth + 1,
            path: rootUuid === "0" ? "" : newPath, //don't include root in path
            ancestorUuids: [...ancestorUuids, node.nodeData.uuid],
            display: display && !node.nodeData.collapsed,
          }),
        );
      }
    }
    return tree;
  }
  _updateInContext() {
    if (!(this.currentNodeUuid in this.nodes)) {
      //maybe deleted current node, set a new one
      let newCurrentNodeUuid;
      if (this.tree[1]) {
        newCurrentNodeUuid = this.tree[1].nodeData.uuid; //set to first child of root
      } else {
        newCurrentNodeUuid = "0"; //set to root if no children
      }
      this.setCurrentNodeUuid(newCurrentNodeUuid, false);
    }
    const currentNode = this.nodes[this.currentNodeUuid] as TreeNode;
    if (!currentNode || !currentNode.treeData) {
      throw new Error("Invalid updateInContext call");
    }
    const currentNodeParents = new Set(currentNode.treeData.ancestorUuids);
    this.tree.forEach((node, id) => {
      node.treeData.id = id; //add id here to save us an iteration through the tree in _createTree
      node.treeData.inContext = false;
      if (!node.isNote()) return;
      if (node.nodeData.uuid === currentNode?.nodeData.uuid) {
        node.treeData.inContext = true;
      } else if (node.nodeData.checked) {
        node.treeData.inContext = true;
      } else if (
        node.nodeData.starred &&
        currentNodeParents.has(node.nodeData.parentUuid!)
      ) {
        node.treeData.inContext = true;
      }
    });
    this.set("tree", [...this.tree]);
    this.set("currentNode", cloneNode(currentNode));
  }
  _scheduleUpdate(update: NotesStateUpdate) {
    //priority: tree > inContext > setTree
    if (this._update === "tree") {
      return; //already scheduled
    } else if (this._update === "inContext") {
      if (update === "tree") {
        this._update = update; //override scheduled inContext update
      }
    } else if (this._update === "setTree") {
      if (update === "tree" || update === "inContext") {
        this._update = update; //override scheduled setTree update
      }
    } else if (this._update === undefined) {
      this._update = update;
      setTimeout(() => {
        this._runUpdate();
      }, 0);
    }
  }
  _runUpdate() {
    if (this._update === "tree") {
      this._createTree();
    } else if (this._update === "inContext") {
      this._updateInContext();
    } else if (this._update === "setTree") {
      this.set("tree", [...this.tree]);
    }
    this._update = undefined;
  }
  /**
   * Returns an array with the node and all its descendants
   */
  getDescendants(uuid: string): Node[] {
    const descendants = [];
    const nodesToVisit = [uuid];
    while (nodesToVisit.length > 0) {
      const currentUuid = nodesToVisit.pop();
      const node = this.nodes[currentUuid!];
      if (!node) {
        continue;
      }
      descendants.push(node);
      if (node.isFolder()) {
        nodesToVisit.push(...node.nodeData.childrenUuids);
      }
    }
    return descendants;
  }
  getPrevSibling(uuid: string) {
    const siblingUuids = this._getSiblingUuids(uuid);
    const index = siblingUuids.indexOf(uuid);
    if (index === -1) {
      throw new Error("Unexpected error");
    }
    const prevSiblingUuid = siblingUuids[index - 1];
    if (!prevSiblingUuid) {
      return undefined;
    }
    const prevSibling = this.nodes[prevSiblingUuid];
    if (!prevSibling || !prevSibling.treeData) {
      throw new Error("Unexpected error");
    }
    return prevSibling as TreeNode;
  }
  getNextSibling(uuid: string) {
    const siblingUuids = this._getSiblingUuids(uuid);
    const index = siblingUuids.indexOf(uuid);
    if (index === -1) {
      throw new Error("Unexpected error");
    }
    const nextSiblingUuid = siblingUuids[index + 1];
    if (!nextSiblingUuid) {
      return undefined;
    }
    const nextSibling = this.nodes[nextSiblingUuid];
    if (!nextSibling || !nextSibling.treeData) {
      throw new Error("Unexpected error");
    }
    return nextSibling as TreeNode;
  }
  _getSiblingUuids(uuid: string) {
    const node = this.nodes[uuid];
    if (!node || node.nodeData.parentUuid === undefined) {
      throw new Error(`Invalid uuid ${uuid}`);
    }
    const parent = this.nodes[node.nodeData.parentUuid];
    if (!parent || !parent.isFolder()) {
      throw new Error("Unexpected error");
    }
    return parent.nodeData.childrenUuids;
  }
  /**
   * nodeData must include uuid, otherwise, include only properties that should be updated
   */
  updateNode(nodeData: { uuid: string } & Partial<NodeData>) {
    const node = this.nodes[nodeData.uuid];
    if (!node) {
      throw new Error(`Node with uuid ${nodeData.uuid} not found`);
    }
    node.update(nodeData);
    const keysThatRebuildTree = [
      "name", //path
      "parentUuid",
      "order",
      "collapsed", //display
    ];
    const keysThatUpdateInContext = ["checked", "starred"];
    const keysThatSetTree = [
      "state",
      "prevName",
      "prevParentUuid",
      "prevContent",
    ];
    if (keysThatRebuildTree.some((key) => key in nodeData)) {
      this._scheduleUpdate("tree");
    } else if (keysThatUpdateInContext.some((key) => key in nodeData)) {
      this._scheduleUpdate("inContext");
    } else if (keysThatSetTree.some((key) => key in nodeData)) {
      //don't need to rebuild tree or update inContext, but we do need to set it for subscribers
      this._scheduleUpdate("setTree");
    }
    if (this.currentNodeUuid === nodeData.uuid && node.treeData) {
      this.set("currentNode", cloneNode(node as TreeNode));
    }
  }
  /**
   * nodeData:
   * - type is required
   * - order, if not provided, is set such that the new node is the last child of its parent
   *
   * options:
   * - setCurrent (boolean, default true): if true, set the new node as the current node
   */
  addNode(
    nodeData: { type: NodeType } & Partial<NodeData>,
    options: { setCurrent?: boolean } = {},
  ) {
    const { setCurrent = true } = options;
    const parentUuid = nodeData.parentUuid || "0";
    const parent = this.nodes[parentUuid];
    if (!parent || !parent.isFolder()) {
      throw new Error(`Invalid parentUuid ${parentUuid}`);
    }
    if (!("order" in nodeData)) {
      const siblingUuids = parent.nodeData.childrenUuids;
      const lastSiblingUuid = siblingUuids[siblingUuids.length - 1];
      if (lastSiblingUuid && this.nodes[lastSiblingUuid]) {
        nodeData.order = this.nodes[lastSiblingUuid].nodeData.order + 1000;
      } else {
        nodeData.order = 0;
      }
    }
    if (nodeData.uuid === undefined) {
      nodeData.uuid = generateUuid();
    }
    this.nodes[nodeData.uuid] = new Node({
      notesState: this,
      ...nodeData,
    });
    if (setCurrent) {
      this.setCurrentNodeUuid(nodeData.uuid);
    }
    this._scheduleUpdate("tree");
  }
  deleteNode(uuid: string) {
    if (uuid === "0") return; //can't delete root
    this.nodes[uuid]?.delete();
    delete this.nodes[uuid];
    this._scheduleUpdate("tree");
  }
  approveChange(uuid: string) {
    const node = this.nodes[uuid];
    if (!node) {
      throw new Error(`Node with uuid ${uuid} not found`);
    }
    if (node.nodeData.state === "deleted") {
      this.deleteNode(uuid);
    } else {
      const newNodeData: {
        uuid: string;
        state?: undefined;
        prevParentUuid?: undefined;
        prevName?: undefined;
        prevContent?: undefined;
      } = { uuid };
      if (node.nodeData.state !== undefined) {
        newNodeData.state = undefined;
      }
      if (node.nodeData.prevParentUuid !== undefined) {
        newNodeData.prevParentUuid = undefined;
      }
      if (node.nodeData.prevName !== undefined) {
        newNodeData.prevName = undefined;
      }
      if (node.isNote() && node.nodeData.prevContent !== undefined) {
        newNodeData.prevContent = undefined;
      }
      if (Object.keys(newNodeData).length > 1) {
        this.updateNode(newNodeData);
      }
    }
  }
  rejectChange(uuid: string) {
    const node = this.nodes[uuid];
    if (!node) {
      throw new Error(`Node with uuid ${uuid} not found`);
    }
    if (node.nodeData.state === "new") {
      this.deleteNode(uuid);
    } else {
      const newNodeData: {
        uuid: string;
        state?: undefined;
        parentUuid?: string;
        prevParentUuid?: undefined;
        name?: string;
        prevName?: undefined;
        content?: string;
        prevContent?: undefined;
      } = { uuid };
      if (node.nodeData.state !== undefined) {
        newNodeData.state = undefined;
      }
      if (node.nodeData.prevParentUuid !== undefined) {
        newNodeData.parentUuid = node.nodeData.prevParentUuid;
        newNodeData.prevParentUuid = undefined;
      }
      if (node.nodeData.prevName !== undefined) {
        newNodeData.name = node.nodeData.prevName;
        newNodeData.prevName = undefined;
      }
      if (node.isNote() && node.nodeData.prevContent !== undefined) {
        newNodeData.content = node.nodeData.prevContent;
        newNodeData.prevContent = undefined;
      }
      if (Object.keys(newNodeData).length > 1) {
        this.updateNode(newNodeData);
      }
    }
  }
  approveAllChanges() {
    Object.values(this.nodes).forEach((node) => {
      this.approveChange(node.nodeData.uuid);
    });
  }
  rejectAllChanges() {
    Object.values(this.nodes).forEach((node) => {
      this.rejectChange(node.nodeData.uuid);
    });
  }
  context(init = false) {
    this._init = init;
    const currentContext = this._context(init);
    const logNotesInstruction = init
      ? "Because the app has just opened, there are no notes in context. First, run a script that uses `app.api.logNotes` to log notes that are relevant to the user's request. Then, use the notes you logged as context to solve the user's request."
      : "Use `app.api.logNotes` sparingly and try to solve the user's request given the context provided. Only use `app.api.logNotes` if it's clear that the user expects you to reference a note that's not currently in context.";
    return `# magicsandbox.Notes

magicsandbox.Notes lets users take notes in a hierarchical folder structure.

## Context Management

The user can manage which notes appear in the context by:
- Clicking the checkbox next to a note in the sidebar
- Using Ctrl+Click in the sidebar to select notes and folders
- Starring a note by clicking the star icon next to it in the sidebar. Starred notes are included in the context when:
  - They are in the same folder as the current note the user has open
  - They are in any parent folder above the current note the user has open

Notes that are included in the context are shown in bold in the sidebar.

The user may not be aware that they can manage the context. They can see these instructions by clicking the Info icon in the sidebar.

## Context

${currentContext}

## API

### app.api.addNote(parentId: number, name: string, content: string, folders?: string[])

Add a new note.

- \`parentId\`: ID of the parent folder (use 0 for the root folder)
- \`name\`: Name of the new note
- \`content\`: Content of the new note
- \`folders\`: (Optional) Array of folder names to create as a path to the note. If provided, the note will be created in the last folder in this path.

Returns: If \`folders\` is provided, returns the ID of the last folder created in the path.

Examples:
- \`addNote(0, "New Note", "content")\` Creates a note named "New Note" in the root folder
- \`addNote(2, "New Note", "content")\` Creates a note named "New Note" in the folder with ID 2
- \`addNote(2, "New Note", "content", ["New Folder"])\` Creates a folder named "New Folder" in the folder with ID 2, then creates a note named "New Note" in the new folder
- \`addNote(2, "New Note", "content", ["Folder 1", "Folder 2"])\` Creates a folder named "Folder 1" in the folder with ID 2, then creates a folder named "Folder 2" in "Folder 1", then creates a note named "New Note" in "Folder 2"

To create a folder and add multiple notes to it, use the returned folder ID:

~~~javascript
const newFolderId = app.api.addNote(0, "Note 1", "Content 1", ["New Folder"]);
app.api.addNote(newFolderId, "Note 2", "Content 2")
~~~

### app.api.appendToNote(id: number, content: string)

Append content to an existing note.

### app.api.replaceNote(id: number, content: string)

Replace an existing note, completely overwriting the existing content.

### app.api.editNote(id: number, find: string, replace: string)

Edit an existing note. The \`find\` string must exactly match a portion of the existing content, character for character, including whitespace. All occurrences of the \`find\` string will be replaced with the \`replace\` string.

### app.api.renameNode(id: number, name: string)

Rename an existing note or folder.

### app.api.moveNodes(ids: number[], parentId: number, folders?: string[])

Move existing notes or folders to a new parent folder. Note that when a folder is moved, all of its children are also moved, so you don't need to specify their ids.

- \`ids\`: Array of IDs of notes or folders to move
- \`parentId\`: ID of the destination parent folder (use 0 for the root folder)
- \`folders\`: (Optional) Array of folder names to create as a path to the destination. If provided, the nodes will be moved to the last folder in this path.

Returns: If \`folders\` is provided, returns the ID of the last folder created in the path.

Examples:
- \`moveNodes([5, 6], 0)\`: Moves nodes with IDs 5 and 6 to the root folder
- \`moveNodes([5, 6], 2)\`: Moves nodes with IDs 5 and 6 to the folder with ID 2
- \`moveNodes([5, 6], 2, ["New Folder"])\`: Creates a folder named "New Folder" in the folder with ID 2, then moves nodes with IDs 5 and 6 to the new folder
- \`moveNodes([5, 6], 2, ["Folder 1", "Folder 2"])\`: Creates a folder named "Folder 1" in the folder with ID 2, then creates a folder named "Folder 2" in "Folder 1", then moves nodes with IDs 5 and 6 to "Folder 2"

### app.api.deleteNodes(ids: number[])

Delete existing notes or folders. Note that when a folder is deleted, all of its children are also deleted, so you don't need to specify their ids.

### app.api.logNotes(ids: number[])

Logs the content of existing notes so that you can reference them in your next message.

## Instructions

- If the user is simply asking a question about their notes, just answer it.
- If you're suggesting a change to a note, use the API. The user can view a diff of the changes and approve or reject them.
- If you're appending to a note, use \`app.api.appendToNote\`. If the note is not too long and you're replacing most of its content, use \`app.api.replaceNote\`. Otherwise, use \`app.api.editNote\` for targeted edits.
- The user can see the name of the note at the top of the page, so don't create a redundant heading with the note's name. For example, if adding a note named "My Note", don't begin the note with "# My Note...".
- Avoid making changes to many notes or renaming/moving/deleting nodes unless the user specifically asks (e.g. "reorganize all my notes").
- ${logNotesInstruction}
`;
  }
  _context(init: boolean) {
    const sections = [];
    const treeString = this.tree
      .slice(1)
      .map((node) => {
        return `${" ".repeat((node.treeData.depth - 1) * 2)}- (${node.treeData.id}) (${node.nodeData.type}) ${node.nodeData.name}`;
      })
      .join("\n");
    if (treeString) {
      sections.push(`The user's folder and note structure is shown below. The indentation level indicates the folder hierarchy. Each entry includes the node's ID in parentheses, the type (folder or note) in parentheses, and the node's name. So the entry "- (1) (note) New Note" indicates a note named "New Note" with ID 1.

<structure>
${treeString}
</structure>
`);
    } else {
      return "The user does not currently have any notes.";
    }
    if (init) return sections.join("\n\n"); //no additional context for init
    const notesInContext: TreeNode[] = [];
    const currentNote = this.nodes[this.currentNodeUuid]?.isNote();
    if (currentNote) {
      notesInContext.push(this.nodes[this.currentNodeUuid] as TreeNode);
    }
    notesInContext.push(
      ...this.tree.filter(
        (node) =>
          node.treeData.inContext &&
          node.nodeData.uuid !== this.currentNodeUuid,
      ),
    );
    const contextString = notesInContext
      .map((node) => {
        if (!node.isNote()) return;
        return `<(${node.treeData.id}) ${node.nodeData.name}>
${node.nodeData.content}
</(${node.treeData.id}) ${node.nodeData.name}>`;
      })
      .join("\n");
    sections.push(`The notes currently in context are shown below. Each note is enclosed in an XML tag and labeled with its ID in parentheses.${currentNote ? " The current note that the user has open is listed first." : ""}

<context>
${contextString}
</context>
`);
    return sections.join("\n\n");
  }
  apiAddNote(
    parentId: string | number,
    name: string,
    content: string,
    folders?: string[],
  ): string {
    const finalParentUuid = this._getAndCreateFolders(parentId, folders);
    const uuid = generateUuid();
    this.addNode({
      uuid,
      type: "note",
      state: "new",
      name,
      parentUuid: finalParentUuid,
      content,
    });
    return finalParentUuid;
  }
  apiAppendToNote(id: number, content: string) {
    const note = this._getNote(id);
    this._handleEdit(
      note.nodeData.uuid,
      note.nodeData.content,
      (note.nodeData.content?.trimEnd?.() || note.nodeData.content) +
        "\n" +
        (content?.trimStart?.() || content),
    );
  }
  apiReplaceNote(id: number, content: string) {
    const note = this._getNote(id);
    this._handleEdit(note.nodeData.uuid, note.nodeData.content, content);
  }
  apiEditNote(id: number, find: string, replace: string) {
    const note = this._getNote(id);
    this._handleEdit(
      note.nodeData.uuid,
      note.nodeData.content,
      note.nodeData.content.replaceAll(find, replace),
    );
  }
  apiRenameNode(id: number, name: string) {
    const node = this._getNode(id);
    this.updateNode({
      uuid: node.nodeData.uuid,
      prevName: node.nodeData.name,
      name,
    });
    this._uncollapseAncestors(node.nodeData.uuid);
  }
  apiMoveNodes(ids: number[], parentId: number, folders?: string[]): string {
    const finalParentUuid = this._getAndCreateFolders(parentId, folders);
    for (const id of ids) {
      const node = this._getNode(id);
      this.updateNode({
        uuid: node.nodeData.uuid,
        prevParentUuid: node.nodeData.parentUuid,
        parentUuid: finalParentUuid,
      });
      this._uncollapseAncestors(node.nodeData.uuid);
    }
    return finalParentUuid;
  }
  apiDeleteNodes(ids: number[]) {
    for (const id of ids) {
      const node = this._getNode(id);
      const descendants = this.getDescendants(node.nodeData.uuid);
      for (const descendant of descendants) {
        this.updateNode({
          uuid: descendant.nodeData.uuid,
          state: "deleted",
        });
        this._uncollapseAncestors(descendant.nodeData.uuid);
      }
    }
  }
  apiLogNotes(ids: number[]) {
    ids.forEach((id, i) => {
      const note = this._getNote(id);
      if (i == 0 && this._init) {
        this.setCurrentNodeUuid(note.nodeData.uuid);
      }
      assistant.full(`<(${note.treeData.id}) ${note.nodeData.name}>
${note.nodeData.content}
</(${note.treeData.id}) ${note.nodeData.name}>`);
    });
  }
  _getAndCreateFolders(parentId: string | number, folders?: string[]): string {
    let parent;
    if (typeof parentId === "string") {
      /*
      apiAddNote and apiMoveNodes return the parentUuid because a newly created parent node doesn't have an id yet
      so this method needs to accept a uuid as well
      */
      parent = this.nodes[parentId];
    } else {
      parent = this.tree[parentId];
    }
    if (!parent) {
      throw new Error(`Parent with id ${parentId} not found`);
    }
    if (!parent.isFolder()) {
      throw new Error(`parentId ${parentId} is a note, not a folder`);
    }
    if (folders && folders.length > 0) {
      const newFolderUuids = folders.map(() => generateUuid());
      for (let i = 0; i < folders.length; i++) {
        this.addNode(
          {
            uuid: newFolderUuids[i],
            type: "folder",
            state: "new",
            name: folders[i],
            parentUuid: i === 0 ? parent.nodeData.uuid : newFolderUuids[i - 1],
          },
          { setCurrent: false },
        );
      }
      return newFolderUuids[newFolderUuids.length - 1]!;
    } else {
      return parent.nodeData.uuid;
    }
  }
  _getNote(id: number) {
    const note = this.tree[id];
    if (!note) {
      throw new Error(`Note with id ${id} not found`);
    }
    if (!note.isNote()) {
      throw new Error(`id ${id} is a folder, not a note`);
    }
    return note;
  }
  _handleEdit(uuid: string, prevContent: string, content: string) {
    this.updateNode({
      uuid,
      prevContent,
      content,
    });
    this.setCurrentNodeUuid(uuid);
  }
  _getNode(id: number) {
    const node = this.tree[id];
    if (!node) {
      throw new Error(`Node with id ${id} not found`);
    }
    return node;
  }
  _uncollapseAncestors(uuid: string) {
    //this can be called when a node is added and ancestorUuids is not yet populated, so can only use parentUuid
    while (uuid !== "0") {
      const node = this.nodes[uuid];
      if (!node) {
        break;
      }
      if (node.isFolder() && node.nodeData.collapsed) {
        this.updateNode({
          uuid,
          collapsed: false,
        });
      }
      uuid = node.nodeData.parentUuid!;
    }
  }
}

export default NotesState;
export type { NodeData, TreeNode, TreeFolder, TreeNote, ClonedNode };
