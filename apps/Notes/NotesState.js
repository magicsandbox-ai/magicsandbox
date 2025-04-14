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
    save = true,
  }) {
    this.notesState = notesState;
    this.uuid = uuid || generateUuid();
    this.type = type;
    this.state = state || null;
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
    this.updateChange();
    if (save) {
      this.save();
    }
  }
  update(node) {
    Object.entries(node).forEach(([key, value]) => {
      this[key] = value;
    });
    this.updateChange();
    this.save();
  }
  updateChange() {
    let change = null;
    const changeDetails = [];
    if (this.state === "new") {
      change = "new";
      changeDetails.push("New");
    }
    if (
      this.prevParentUuid !== null &&
      this.prevParentUuid !== this.parentUuid
    ) {
      change = "moved";
      const prevParent = this.notesState.nodes[this.prevParentUuid];
      changeDetails.push(
        prevParent.name ? `Moved from ${prevParent.name}` : "Moved",
      );
    }
    if (this.prevName !== null && this.prevName !== this.name) {
      change = "renamed";
      changeDetails.push(
        this.prevName ? `Renamed from ${this.prevName}` : "Renamed",
      );
    }
    if (this.prevContent !== null && this.prevContent !== this.content) {
      change = "edited";
      changeDetails.push("Edited");
    }
    if (this.state === "deleted") {
      change = "deleted";
      changeDetails.push("Deleted");
    }
    this.change = change;
    this.changeDetails = `${changeDetails.reverse().join(", ")}`;
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
          name: "Root Folder",
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
    this.nodes = nodes; //this is referenced by the Node constructor, so we need to assign it first
    this.nodes = Object.fromEntries(
      Object.entries(nodes).map(([uuid, node]) => [
        uuid,
        new Node({
          notesState: this,
          ...node,
          checked: false, //reset checked when starting a new session
          save: false, //don't need to save on initial load
        }),
      ]),
    );
    this.currentNodeUuid = currentNodeUuid;
    this.currentNode = this.nodes[currentNodeUuid];
    this.putErrorHandler = (error) => {
      console.error(error);
      if (this._toastsRef && !this._putErrorHandled) {
        let message = "Unexpected error saving notes";
        if (error.message === "Database size limit exceeded") {
          message =
            "Error saving notes: maximum storage limit reached. Delete some notes to free up space.";
        }
        this._toastsRef.current.addToast(message, "error");
        this._putErrorHandled = true; //avoid displaying too many toasts
        setTimeout(() => {
          this._putErrorHandled = false;
        }, 5000);
      }
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
    if (!(newCurrentNodeUuid in this.nodes)) {
      throw new Error(`Node with uuid ${newCurrentNodeUuid} not found`);
    }
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
    this._uncollapseAncestors(newCurrentNodeUuid);
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
      if (node.type === "folder") return;
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
    } else if (this._update === "setTree") {
      this.set("tree", [...this.tree]);
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
    if (keysThatRebuildTree.some((key) => key in node)) {
      this._scheduleUpdate("tree");
    } else if (keysThatUpdateInContext.some((key) => key in node)) {
      this._scheduleUpdate("inContext");
    } else if (keysThatSetTree.some((key) => key in node)) {
      //don't need to rebuild tree or update inContext, but we do need to set it for subscribers
      this._scheduleUpdate("setTree");
    }
    if (this.currentNodeUuid === node.uuid) {
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
  _context(init) {
    const sections = [];
    const treeString = this.tree
      .slice(1)
      .map((node) => {
        return `${" ".repeat((node.depth - 1) * 2)}- (${node.id}) (${node.type}) ${node.name}`;
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
    const currentNote = this.nodes[this.currentNodeUuid].type === "note";
    const notesInContext = currentNote
      ? [this.nodes[this.currentNodeUuid]]
      : [];
    notesInContext.push(
      ...this.tree.filter(
        (node) => node.inContext && node.uuid !== this.currentNodeUuid,
      ),
    );
    const contextString = notesInContext
      .map((node) => {
        return `<(${node.id}) ${node.name}>
${node.content}
</(${node.id}) ${node.name}>`;
      })
      .join("\n");
    sections.push(`The notes currently in context are shown below. Each note is enclosed in an XML tag and labeled with its ID in parentheses.${currentNote ? " The current note that the user has open is listed first." : ""}

<context>
${contextString}
</context>
`);
    return sections.join("\n\n");
  }
  apiAddNote(parentId, name, content, folders) {
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
  apiAppendToNote(id, content) {
    const note = this._getNote(id);
    this._handleEdit(
      note.uuid,
      note.content,
      (note.content?.trimEnd?.() || note.content) +
        "\n" +
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
    this._uncollapseAncestors(node.uuid);
  }
  apiMoveNodes(ids, parentId, folders) {
    const finalParentUuid = this._getAndCreateFolders(parentId, folders);
    for (const id of ids) {
      const node = this._getNode(id);
      this.updateNode({
        uuid: node.uuid,
        prevParentUuid: node.parentUuid,
        parentUuid: finalParentUuid,
      });
      this._uncollapseAncestors(node.uuid);
    }
    return finalParentUuid;
  }
  apiDeleteNodes(ids) {
    for (const id of ids) {
      const node = this._getNode(id);
      const descendants = this.getDescendants(node.uuid);
      for (const descendant of descendants) {
        this.updateNode({
          uuid: descendant.uuid,
          state: "deleted",
        });
        this._uncollapseAncestors(descendant.uuid);
      }
    }
  }
  apiLogNotes(ids) {
    ids.forEach((id, i) => {
      const note = this._getNote(id);
      if (i == 0 && this._init) {
        this.setCurrentNodeUuid(note.uuid);
      }
      assistant.full(`<(${note.id}) ${note.name}>
${note.content}
</(${note.id}) ${note.name}>`);
    });
  }
  _getAndCreateFolders(parentId, folders) {
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
  _uncollapseAncestors(uuid) {
    //this can be called when a node is added and ancestorUuids is not yet populated, so can only use parentUuid
    while (uuid !== "0") {
      if (this.nodes[uuid].collapsed) {
        this.updateNode({
          uuid,
          collapsed: false,
        });
      }
      uuid = this.nodes[uuid].parentUuid;
    }
  }
}

export default NotesState;
