import { generateUuid } from "./utils.js";

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
    this.prevName = prevName;
    if (uuid !== "0") {
      //root node doesn't have a parent
      this.parentUuid = parentUuid || "0";
    }
    this.prevParentUuid = prevParentUuid;
    this.order = order || 0;
    if (this.type === "folder") {
      this.name = name || "New Folder";
      this.collapsed = collapsed || false;
    } else if (this.type === "note") {
      this.name = name || "New Note";
      this.content = content || "";
      this.prevContent = prevContent;
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
  constructor(
    nodes,
    currentNodeUuid,
    setCurrentNodeUuid,
    setTree,
    putErrorHandler,
  ) {
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
    this._setCurrentNodeUuid = setCurrentNodeUuid;
    this._setTree = setTree;
    this.putErrorHandler =
      putErrorHandler ||
      ((error) => {
        console.error(error);
      });
    this._createTree();
  }
  setCurrentNodeUuid(newCurrentNodeUuid) {
    this.currentNodeUuid = newCurrentNodeUuid;
    this._setCurrentNodeUuid(newCurrentNodeUuid);
    this._updateInContext(); //depends on currentNodeUuid
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
    tree.push({
      ...node,
      depth,
      ancestorNames,
      ancestorUuids,
      display,
    });
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
    this._setTree([...this.tree]);
  }
  _scheduleUpdateTree() {
    //debounce to try to update once per synchronous batch of node updates
    clearTimeout(this.updateTreeTimeoutId);
    this.updateTreeTimeoutId = setTimeout(() => {
      this._createTree();
    }, 16);
  }
  _scheduleUpdateInContext() {
    //debounce to try to update once per synchronous batch of node updates
    clearTimeout(this.updateInContextTimeoutId);
    this.updateInContextTimeoutId = setTimeout(() => {
      this._updateInContext();
    }, 16);
  }
  getDescendants(uuid) {
    const descendants = [];
    const nodesToVisit = [uuid];
    while (nodesToVisit.length > 0) {
      const currentUuid = nodesToVisit.pop();
      const node = this.nodes[currentUuid];
      descendants.push(currentUuid);
      nodesToVisit.push(...node.childrenUuids);
    }
    return descendants;
  }
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
  addNode(node) {
    const uuid = generateUuid();
    this.nodes[uuid] = new Node({
      notesState: this,
      uuid,
      ...node,
    });
    this._scheduleUpdateTree();
  }
  deleteNode(uuid) {
    this.nodes[uuid].delete();
    delete this.nodes[uuid];
    this._scheduleUpdateTree();
  }
}

export default NotesState;
