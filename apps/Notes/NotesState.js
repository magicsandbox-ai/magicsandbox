import { v4 as uuid } from "uuid";

function generateUuid() {
  return uuid();
}

class Node {
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
  }) {
    this.notesState = notesState;
    this.uuid = uuid || generateUuid();
    this.type = type;
    this.state = state;
    this.prevName = prevName || null;
    if (uuid !== "0") {
      //root node doesn't have a parent
      this.parentUuid = parentUuid || "0";
    }
    this.prevParentUuid = prevParentUuid || null;
    this.order = order || 0;
    if (this.type === "folder") {
      this.name = name || "New Folder";
      this.collapsed = collapsed || false;
    } else if (this.type === "note") {
      this.name = name || "New Note";
      this.content = content || "";
      this.prevContent = prevContent || null;
      this.checked = checked || false;
      this.starred = starred || false;
    } else {
      throw new Error("Invalid Node type");
    }
    this.save();
  }
  update(node) {
    Object.entries(node).forEach(([key, value]) => {
      this[key] = value;
    });
    this.save();
  }
  save() {
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      requestPutData(this.uuid, {
        uuid: this.uuid,
        type: this.type,
        state: this.state,
        name: this.name,
        prevName: this.prevName,
        parentUuid: this.parentUuid,
        prevParentUuid: this.prevParentUuid,
        order: this.order,
        collapsed: this.collapsed,
        content: this.content,
        prevContent: this.prevContent,
        checked: this.checked,
        starred: this.starred,
      }).catch(this.notesState.putErrorHandler);
    }, 300);
  }
  delete() {
    clearTimeout(this.timeoutId);
    requestDeleteData(this.uuid).catch(this.notesState.putErrorHandler);
  }
}

class NotesState {
  constructor(nodes, currentNodeUuid) {
    if (!nodes || Object.keys(nodes).length === 0) {
      const uuid = generateUuid();
      nodes = {
        ["0"]: new Node({
          notesState: this,
          uuid: "0",
          type: "folder",
          name: "root",
          parentUuid: null,
        }),
        [uuid]: new Node({
          notesState: this,
          uuid,
          type: "note",
        }),
      };
      currentNodeUuid = uuid;
    }
    this.nodes = Object.fromEntries(
      Object.entries(nodes).map(([uuid, node]) => [
        uuid,
        new Node({ notesState: this, ...node }),
      ]),
    );
    this.currentNodeUuid = currentNodeUuid;
    this.currentNode = this.nodes[currentNodeUuid];
    this.putErrorHandler = (error) => {
      console.error(error); //todo use toastsRef and debounce
    };
    this._subscribers = {};
    this._update = null;
    this._createTree();
  }
  subscribe(prop) {
    return (callback) => {
      if (!this._subscribers[prop]) {
        this._subscribers[prop] = [];
      }
      this._subscribers[prop].push(callback);
      return () => {
        this._subscribers[prop] = this._subscribers[prop].filter(
          (subscriber) => subscriber !== callback,
        );
      };
    };
  }
  getSnapshot(prop) {
    return () => {
      return this[prop];
    };
  }
  set(prop, value) {
    this[prop] = value;
    this._subscribers[prop]?.forEach((subscriber) => subscriber());
  }
  setCurrentNodeUuid(newCurrentNodeUuid, scheduleUpdate = true) {
    /*
    if the user navigates away from a new node, we mark it as no longer new
    but if apiAddNote is called twice in a batch, setCurrentNodeUuid is called twice
    and we don't want to mark the first note as no longer new on the second call
    so we check to see if currentNode.id is set, which is a hacky way to identify "batches" of apiAddNote calls
    todo come up with a better solution
    */
    const currentNode = this.nodes[this.currentNodeUuid];
    if (currentNode?.state === "new" && currentNode.id) {
      this.updateNode({
        uuid: currentNode.uuid,
        state: null,
      });
    }
    this.currentNodeUuid = newCurrentNodeUuid;
    clearTimeout(this._putCurrentNodeUuidTimeoutId);
    this._putCurrentNodeUuidTimeoutId = setTimeout(() => {
      requestPutData("currentNodeUuid", newCurrentNodeUuid).catch(
        this.putErrorHandler,
      );
    }, 300);
    if (scheduleUpdate) {
      this._scheduleUpdate("inContext"); //depends on currentNodeUuid
    }
  }
  _createTree() {
    //init children array
    Object.values(this.nodes).forEach((node) => {
      if (node.type === "folder") {
        node.childrenUuids = [];
      }
    });

    //add childrenUuids to parent nodes
    Object.entries(this.nodes).forEach(([uuid, node]) => {
      if (uuid === "0") return; //skip root
      const parentNode = this.nodes[node.parentUuid];
      if (parentNode?.type === "folder") {
        parentNode.childrenUuids.push(uuid);
      } else {
        //assign to root if its parent is missing (or not a folder somehow)
        //this can happen if the user approves parent deletion and rejects a child move
        this.nodes[uuid].parentUuid = "0";
        this.nodes["0"].childrenUuids.push(uuid);
        //todo toast to let user know
      }
    });

    //sort childrenUuids
    Object.values(this.nodes).forEach((node) => {
      if (node.childrenUuids?.length > 1) {
        node.childrenUuids.sort(
          (a, b) => this.nodes[a].order - this.nodes[b].order,
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
  } = {}) {
    let tree = [];
    const node = this.nodes[rootUuid];
    node.depth = depth;
    const newPath = path ? `${path}/${node.name}` : node.name;
    node.path = newPath;
    node.ancestorUuids = ancestorUuids;
    node.display = rootUuid === "0" ? false : display; //don't display root
    tree.push(node);
    if (node.childrenUuids) {
      for (const childUuid of node.childrenUuids) {
        tree.push(
          ...this._createTreeRecursive({
            rootUuid: childUuid,
            depth: depth + 1,
            path: rootUuid === "0" ? "" : newPath, //don't include root in path
            ancestorUuids: [...ancestorUuids, node.uuid],
            display: display && !node.collapsed,
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
      if (this.tree.length > 1) {
        newCurrentNodeUuid = this.tree[1].uuid; //set to first child of root
      } else {
        newCurrentNodeUuid = "0"; //set to root if no children
      }
      this.setCurrentNodeUuid(newCurrentNodeUuid, false);
    }
    const currentNode = this.nodes[this.currentNodeUuid];
    const currentNodeParents = new Set(currentNode.ancestorUuids);
    this.tree.forEach((node, id) => {
      node.id = id; //add id here to save us an iteration through the tree in _createTree
      node.inContext = false;
      if (node.uuid === currentNode.uuid) {
        node.inContext = true;
      } else if (node.checked) {
        node.inContext = true;
      } else if (node.starred && currentNodeParents.has(node.parentUuid)) {
        node.inContext = true;
      }
    });
    this.set("tree", [...this.tree]);
    this.set("currentNode", {
      ...currentNode,
    });
  }
  _scheduleUpdate(update) {
    //updating the tree takes precedence over updating inContext
    if (this._update === "tree") {
      return; //already scheduled
    } else if (this._update === "inContext") {
      if (update === "tree") {
        this._update = update; //override scheduled inContext update with tree update
      }
    } else if (this._update === null) {
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
    }
    this._update = null;
  }
  /**
   * getDescendants(uuid) => Node[]
   *
   * Returns an array with the node and all its descendants
   */
  getDescendants(uuid) {
    const descendants = [];
    const nodesToVisit = [uuid];
    while (nodesToVisit.length > 0) {
      const currentUuid = nodesToVisit.pop();
      const node = this.nodes[currentUuid];
      descendants.push(node);
      if (node.type === "folder") {
        nodesToVisit.push(...node.childrenUuids);
      }
    }
    return descendants;
  }
  /**
   * updateNode(node: object)
   *
   * node should be an object with a uuid property. besides uuid, include only properties that should be updated.
   */
  updateNode(node) {
    this.nodes[node.uuid].update(node);
    const keysThatUpdateTree = [
      "name",
      "prevName",
      "parentUuid",
      "prevParentUuid",
      "order",
      "collapsed",
    ];
    const keysThatUpdateInContext = ["state", "checked", "starred"];
    if (keysThatUpdateTree.some((key) => key in node)) {
      this._scheduleUpdate("tree");
    } else if (keysThatUpdateInContext.some((key) => key in node)) {
      this._scheduleUpdate("inContext");
    } else if (this.currentNodeUuid === node.uuid) {
      this.set("currentNode", {
        ...this.nodes[node.uuid],
      });
    }
  }
  /**
   * addNode(node: object, options: object)
   * - type: required, "folder" or "note"
   * - order: if not provided, set such that the new node is the last child of its parent
   *
   * options:
   * - setCurrent (boolean, default true): if true, set the new node as the current node
   */
  addNode(node, options = {}) {
    const { setCurrent = true } = options;
    const parentUuid = node.parentUuid || "0";
    const parent = this.nodes[parentUuid];
    if (!parent || parent.type !== "folder") {
      throw new Error(`Invalid parentUuid ${parentUuid}`);
    }
    if (!("order" in node)) {
      if (!parent.childrenUuids) {
        //parent may have just been added and hasn't had childrenUuids set yet
        parent.childrenUuids = [];
        node.order = 0;
      } else {
        const sibling =
          this.nodes[parent.childrenUuids[parent.childrenUuids.length - 1]];
        node.order = sibling ? sibling.order + 1000 : 0;
        parent.childrenUuids.push(node.uuid);
      }
    }
    if (!("uuid" in node)) {
      node.uuid = generateUuid();
    }
    this.nodes[node.uuid] = new Node({
      notesState: this,
      ...node,
    });
    if (setCurrent) {
      this.setCurrentNodeUuid(node.uuid);
    }
    this._scheduleUpdate("tree");
  }
  deleteNode(uuid) {
    if (uuid === "0") return; //can't delete root
    this.nodes[uuid].delete();
    delete this.nodes[uuid];
    this._scheduleUpdate("tree");
  }
  approveChange(uuid) {
    const node = this.nodes[uuid];
    if (!node) {
      throw new Error(`Node with uuid ${uuid} not found`);
    }
    if (node.state === "deleted") {
      this.deleteNode(uuid);
    } else {
      const newNode = { uuid };
      if (node.state !== null) {
        newNode.state = null;
      }
      if (node.prevParentUuid !== null) {
        newNode.prevParentUuid = null;
      }
      if (node.prevName !== null) {
        newNode.prevName = null;
      }
      if (node.prevContent !== null) {
        newNode.prevContent = null;
      }
      if (Object.keys(newNode).length > 1) {
        this.updateNode(newNode);
      }
    }
  }
  rejectChange(uuid) {
    const node = this.nodes[uuid];
    if (!node) {
      throw new Error(`Node with uuid ${uuid} not found`);
    }
    if (node.state === "new") {
      this.deleteNode(uuid);
    } else {
      const newNode = { uuid };
      if (node.state !== null) {
        newNode.state = null;
      }
      if (node.prevParentUuid !== null) {
        newNode.parentUuid = node.prevParentUuid;
        newNode.prevParentUuid = null;
      }
      if (node.prevName !== null) {
        newNode.name = node.prevName;
        newNode.prevName = null;
      }
      if (node.prevContent !== null) {
        newNode.content = node.prevContent;
        newNode.prevContent = null;
      }
      if (Object.keys(newNode).length > 1) {
        this.updateNode(newNode);
      }
    }
  }
  approveAllChanges() {
    Object.values(this.nodes).forEach((node) => {
      this.approveChange(node.uuid);
    });
  }
  rejectAllChanges() {
    Object.values(this.nodes).forEach((node) => {
      this.rejectChange(node.uuid);
    });
  }
  apiAddNote(parentId, name, content, folders) {
    const finalParentId = this._getAndCreateFolders(parentId, folders);
    const uuid = generateUuid();
    this.addNode({
      uuid,
      type: "note",
      state: "new",
      name,
      parentUuid: finalParentId,
      content,
    });
  }
  apiAppendToNote(id, content) {
    const note = this._getNote(id);
    this._handleEdit(
      note.uuid,
      note.content,
      (note.content?.trimEnd?.() || note.content) +
        "\n\n" +
        (content?.trimStart?.() || content),
    );
  }
  apiReplaceNote(id, content) {
    const note = this._getNote(id);
    this._handleEdit(note.uuid, note.content, content);
  }
  apiEditNote(id, find, replace) {
    const note = this._getNote(id);
    this._handleEdit(
      note.uuid,
      note.content,
      note.content.replaceAll(find, replace),
    );
  }
  apiRenameNode(id, name) {
    const node = this._getNode(id);
    this.updateNode({
      uuid: node.uuid,
      prevName: node.name,
      name,
    });
  }
  apiMoveNodes(ids, parentId, folders) {
    const finalParentId = this._getAndCreateFolders(parentId, folders);
    for (const id of ids) {
      const node = this._getNode(id);
      this.updateNode({
        uuid: node.uuid,
        prevParentUuid: node.parentUuid,
        parentUuid: finalParentId,
      });
    }
  }
  apiDeleteNodes(ids) {
    for (const id of ids) {
      const node = this._getNode(id);
      this.updateNode({
        uuid: node.uuid,
        state: "deleted",
      });
    }
  }
  _getAndCreateFolders(parentId, folders) {
    const parent = this.tree[parentId];
    if (!parent) {
      throw new Error(`Parent with id ${parentId} not found`);
    }
    if (parent.type !== "folder") {
      throw new Error(`parentId ${parentId} is a note, not a folder`);
    }
    if (folders?.length > 0) {
      const newFolderUuids = folders.map(() => generateUuid());
      for (let i = 0; i < folders.length; i++) {
        this.addNode(
          {
            uuid: newFolderUuids[i],
            type: "folder",
            state: "new",
            name: folders[i],
            parentUuid: i === 0 ? parent.uuid : newFolderUuids[i - 1],
          },
          { setCurrent: false },
        );
      }
      return newFolderUuids[folders.length - 1];
    } else {
      return parent.uuid;
    }
  }
  _getNote(id) {
    const note = this.tree[id];
    if (!note) {
      throw new Error(`Note with id ${id} not found`);
    }
    if (note.type !== "note") {
      throw new Error(`id ${id} is a folder, not a note`);
    }
    return note;
  }
  _handleEdit(uuid, prevContent, content) {
    this.updateNode({
      uuid,
      prevContent,
      content,
    });
    this.setCurrentNodeUuid(uuid);
  }
  _getNode(id) {
    const node = this.tree[id];
    if (!node) {
      throw new Error(`Node with id ${id} not found`);
    }
    return node;
  }
}

export default NotesState;
