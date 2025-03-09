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
    }, 250);
  }
  delete() {
    clearTimeout(this.timeoutId);
    requestDeleteData(this.uuid).catch(this.notesState.putErrorHandler);
  }
}

class NotesState {
  constructor(nodes, currentNodeUuid) {
    if (!nodes) {
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
      Object.entries(nodes).map(([uuid, node]) => [uuid, new Node(node)]),
    );
    this.currentNodeUuid = currentNodeUuid;
    this.contents = {
      content: this.nodes[currentNodeUuid].content,
      prevContent: this.nodes[currentNodeUuid].prevContent,
    };
    this.putErrorHandler = (error) => {
      console.error(error); //todo use toastsRef and debounce
    };
    this._subscribers = {};
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
  setCurrentNodeUuid(newCurrentNodeUuid) {
    this.currentNodeUuid = newCurrentNodeUuid;
    this.set("contents", {
      content: this.nodes[newCurrentNodeUuid].content,
      prevContent: this.nodes[newCurrentNodeUuid].prevContent,
    });
    requestPutData("currentNodeUuid", newCurrentNodeUuid).catch(
      this.putErrorHandler,
    );
    this._scheduleUpdateInContext(); //depends on currentNodeUuid
  }
  _createTree() {
    //add childrenUuids to parent nodes
    Object.entries(this.nodes).forEach(([uuid, node]) => {
      if (uuid === "0") return; //skip root
      const parentNode = this.nodes[node.parentUuid];
      if (parentNode) {
        if (parentNode.childrenUuids) {
          parentNode.childrenUuids.push(uuid);
        } else if (parentNode.type === "folder") {
          parentNode.childrenUuids = [uuid];
        } else {
          this.nodes[uuid].parentUuid = "0"; //assign to root if its parent is not a folder
        }
      } else {
        this.nodes[uuid].parentUuid = "0"; //assign to root if its parent is missing
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
    ancestorNames = [],
    ancestorUuids = [],
    display = true,
  } = {}) {
    let tree = [];
    const node = this.nodes[rootUuid];
    node.depth = depth;
    node.ancestorNames = ancestorNames;
    node.ancestorUuids = ancestorUuids;
    node.display = rootUuid === "0" ? false : display; //don't display root
    tree.push(node);
    if (node.childrenUuids) {
      for (const childUuid of node.childrenUuids) {
        tree.push(
          ...this._createTreeRecursive({
            rootUuid: childUuid,
            depth: depth + 1,
            ancestorNames: [...ancestorNames, node.name],
            ancestorUuids: [...ancestorUuids, node.uuid],
            display: display && !node.collapsed,
          }),
        );
      }
    }
    return tree;
  }
  _updateInContext() {
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
    this.set("tree", this.tree);
  }
  _scheduleUpdateTree() {
    //debounce to try to update once per synchronous batch of node updates
    clearTimeout(this._updateTreeTimeoutId);
    this._updateTreeTimeoutId = setTimeout(() => {
      this._createTree();
    }, 0);
  }
  _scheduleUpdateInContext() {
    //debounce to try to update once per synchronous batch of node updates
    clearTimeout(this._updateInContextTimeoutId);
    this._updateInContextTimeoutId = setTimeout(() => {
      this._updateInContext();
    }, 0);
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
      nodesToVisit.push(...node.childrenUuids);
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
    const keysThatUpdateTree = ["name", "parentUuid", "order", "collapsed"];
    const keysThatUpdateInContext = ["checked", "starred"];
    if (keysThatUpdateTree.some((key) => key in node)) {
      this._scheduleUpdateTree();
    } else if (keysThatUpdateInContext.some((key) => key in node)) {
      this._scheduleUpdateInContext();
    }
  }
  /**
   * addNode(node: object)
   * - type: required, "folder" or "note"
   * - order: if not provided, set such that the new node is the last child of its parent
   */
  addNode(node) {
    const parentUuid = node.parentUuid || "0";
    const parent = this.nodes[parentUuid];
    if (!parent || parent.type !== "folder") {
      throw new Error(`Invalid parentUuid ${parentUuid}`);
    }
    if (!("order" in node)) {
      const sibling =
        this.nodes[parent.childrenUuids[parent.childrenUuids.length - 1]];
      node.order = sibling ? sibling.order + 1000 : 0;
    }
    if (!("uuid" in node)) {
      node.uuid = generateUuid();
    }
    this.nodes[node.uuid] = new Node({
      notesState: this,
      ...node,
    });
    this._scheduleUpdateTree();
  }
  deleteNode(uuid) {
    this.nodes[uuid].delete();
    delete this.nodes[uuid];
    this._scheduleUpdateTree();
  }
  apiAddNote(parentId, name, content, folders) {
    const finalParentId = this._getAndCreateFolders(parentId, folders);
    const uuid = generateUuid();
    this.addNode({
      uuid,
      type: "note",
      name,
      parentUuid: finalParentId,
      content,
    });
    this.setCurrentNodeUuid(uuid);
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
      this.deleteNode(node.uuid);
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
    if (folders.length > 0) {
      const newFolderUuids = folders.map(() => generateUuid());
      for (let i = 0; i < folders.length; i++) {
        this.addNode({
          uuid: newFolderUuids[i],
          type: "folder",
          name: folders[i],
          parentUuid: i === 0 ? parent.uuid : newFolderUuids[i - 1],
        });
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
