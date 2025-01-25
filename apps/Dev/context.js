import { parse } from "./parser.js";
import * as eslintScope from "eslint-scope";
//10000 token context limit - 25000 characters
//use search/replace if files are large
//later - some kind of graph approach to pick out most relevant files? only include functions that are imported/exported?
//show all of current file? focus on what's higlighted? what's the UX?
//loop through specifiers in highlighted to see what's defined?
//later - how to get docs for dependencies and Functions

/*
- highlighted node
- definition of references in highlighted node plus their imports
- current file (if js) summary
- current file (if js)
- current file references
- scriptfile summary
- scriptfile
- scriptfile references
- all file summaries ranked by depth
- all files ranked by depth

handle if non js too big. also if non js file is selected how to indicate that? also file selection in general
if exported, I want to see where it's used
*/

class Context {
  constructor(rawFiles, selectedFilename, selection, scriptFile) {
    this.rawFiles = rawFiles;
    if (
      this.selectedFilename.endsWith(".js") ||
      this.selectedFilename.endsWith(".jsx")
    ) {
      this.selectedFilename = selectedFilename;
      this.selection = selection;
    } else {
      this.selectedFilename = scriptFile;
      this.selection = null;
    }
    this.maxLength = 25000; //todo make configurable
    this.length = 0;
    this.files = {};
    this.nodes = [];
  }

  get() {
    Object.entries(this.rawFiles).forEach(([filename, content]) => {
      this.length += content.length;
      if (this.selectedFilename === filename) {
        this.files[filename] = new File(
          this,
          filename,
          content,
          true,
          this.selection,
        );
      } else {
        this.files[filename] = new File(this, filename, content, false, null);
      }
    });
    if (this.length <= this.maxLength) {
      return this.format((file) => file.content);
    }
    Object.values(this.files).forEach((file) => file.parse());
    Object.values(this.files).forEach((file) => {
      file.resolveReferences();
    });
    //selected nodes add themselves to this.nodes during file.parse()
    let nextPriority = 1;
    while (this.nodes.length > 0) {
      const node = this.nodes.shift();
      if (node.file.priority === null) {
        node.file.priority = nextPriority;
        nextPriority++;
      }
      if (node.depth <= 1) {
        const nodesToAdd = node.getReferences();
        nodesToAdd.forEach((nodeToAdd) => {
          if (nodeToAdd.depth === null) {
            nodeToAdd.depth = node.depth + 1;
            this.nodes.push(nodeToAdd);
          }
        });
      }
    }
    return this.format((file) => file.get());
  }

  format(method) {
    //todo sort
    const files = [this.files["magic.json"]];
    const jsFiles = Object.values(this.files)
      .filter((file) => file.priority !== null)
      .sort((a, b) => a.priority - b.priority);
    files.push(...jsFiles);
    files.push(
      ...Object.values(this.files).filter(
        (file) => !file.js && file.filename !== "magic.json",
      ),
    );
    return `<files>
  ${files
    .map(
      (file) => `<${file.filename}>
${method(file)}
</${file.filename}>`,
    )
    .join("\n")}
</files>`;
  }
}

class File {
  constructor(context, filename, content, selected, selection) {
    this.context = context;
    this.filename = filename;
    this.js = this.filename.endsWith(".js") || this.filename.endsWith(".jsx");
    this.content = content;
    this.selected = selected;
    this.selection = selection;
    this.nodes = [];
    this.definitions = {};
    this.priority = null;
  }

  parse() {
    if (!this.js) {
      this.context.length += this.content.length;
      return;
    }
    let selectionStart, selectionEnd;
    if (this.selection && this.selection.length < this.content.length) {
      selectionStart = this.content.indexOf(this.selection);
      selectionEnd = selectionStart + this.selection.length;
    } else if (this.selection) {
      selectionStart = 0;
      selectionEnd = this.content.length;
    }
    try {
      this.ast = parse(this.content);
      //https://eslint.org/docs/latest/extend/scope-manager-interface#scopemanager-interface
      this.scopeManager = eslintScope.analyze(this.ast, {
        ecmaVersion: 2022, //todo this is duplicated
        sourceType: "module",
      });
      this.ast.body.forEach((astNode) => {
        let selected = false;
        if (selectionStart && selectionEnd) {
          selected =
            astNode.start < selectionEnd && astNode.end > selectionStart;
        }
        const node = new Node(this.context, this, astNode, selected);
        this.nodes.push(node);
      });
    } catch (e) {
      console.error(e); //todo
    }
  }

  resolveReferences() {
    this.nodes.forEach((node) => {
      node.references.forEach((reference) => {
        if (reference.type === "ImportBinding") {
          const referenceFilename = reference.parent.source.value.slice(2); //remove ./
          const referenceFile = this.context.files[referenceFilename];
          if (referenceFile) {
            referenceFile.resolveReference(reference);
          }
        } else {
          this.resolveReference(reference);
        }
      });
    });
  }

  resolveReference(reference) {
    //todo - find the top level node that contains the reference
    //references should be a dict?
  }

  get() {
    if (!this.js) return this.content;
    //todo
  }
}

class Node {
  constructor(context, file, astNode, selected) {
    this.context = context;
    this.file = file;
    this.astNode = astNode;
    this.selected = selected;
    this.depth = null;
    if (selected) {
      this.depth = 0;
      this.context.nodes.push(this);
    }
    this.scope = this.file.scopeManager.acquire(this.astNode);
    this.file.scopeManager
      .getDeclaredVariables(this.astNode)
      .forEach((variable) => {
        if (this.file.definitions[variable.name]) {
          console.warn("duplicate definition", variable); //todo remove this
        }
        this.file.definitions[variable.name] = variable.defs;
      });
    this.references = [];
    //this.scope.through is a list of references outside the scope (which is what we want)
    //confusingly, this.scope.references is a list of references inside the scope - ignore this
    //need child scopes even for through. why is references shorter than through??
    this.scope.through.forEach((reference) => {
      const resolved = reference.resolved;
      if (resolved) {
        if (resolved.identifiers.length !== resolved.defs.length) {
          console.warn("identifiers !== defs", reference); //todo remove this
        }
        if (resolved.defs.length === 0) {
          console.warn("no defs", reference); //todo remove this
        }
        this.references.push(...resolved.defs);
      } else {
        console.warn("unresolved reference", reference); //todo remove this
      }
    });
  }
}

function context(rawFiles, selectedFilename, selection, scriptFile) {
  return new Context(rawFiles, selectedFilename, selection, scriptFile).get();
}

export { context };
