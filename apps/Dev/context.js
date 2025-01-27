import { parse } from "./parser.js";
import * as eslintScope from "eslint-scope";

function analyze(content) {
  /*
  much of this is copied from eslint-scope/lib/index.js so we can override Referencer
  */
  const options = {
    optimistic: false,
    directive: false,
    nodejsScope: false,
    impliedStrict: false,
    sourceType: "module",
    ecmaVersion: 2022,
    childVisitorKeys: null,
    fallback: "iteration",
    ignoreEval: true, //required to resolve references in a file with eval
  };
  class JSXReferencer extends eslintScope.Referencer {
    constructor(options, scopeManager) {
      super(options, scopeManager);
    }
    JSXIdentifier(node) {
      //ignore tags like "div"
      if (node.name[0] === node.name[0].toUpperCase()) {
        //hack to change type to Identifier, otherwise eslint-scope will ignore it
        node.type = "Identifier";
        this.currentScope().__referencing(node);
      }
    }
  }
  const ast = parse(content);
  //https://eslint.org/docs/latest/extend/scope-manager-interface#scopemanager-interface
  const scopeManager = new eslintScope.ScopeManager(options);
  const referencer = new JSXReferencer(options, scopeManager);
  referencer.visit(ast);
  if (scopeManager.__currentScope !== null) {
    throw new Error("currentScope should be null.");
  }
  return { ast, scopeManager };
}

/*
tests:
- unnamed default export

todos:
- prompt: docs. use search/replace if files are large
- how to get docs for dependencies and Functions
- re-exporting/barrel modules/ExportAllDeclaration/ExportNamespaceSpecifier
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
    this.processedNodes = [];
  }

  get() {
    this.init();
    if (this.length <= this.maxLength) {
      return this.format((file) => file.content);
    }
    this.process();
    this.summarize();
    return this.format((file) => file.get());
  }

  init() {
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
  }

  process() {
    Object.values(this.files).forEach((file) => file.parse());
    Object.values(this.files).forEach((file) => {
      file.resolveReferences();
    });
    //selected nodes add themselves to this.nodes during file.parse()
    while (this.nodes.length > 0) {
      const node = this.nodes.shift();
      if (node.file.depth === null) {
        node.file.depth = node.depth;
      } else {
        node.file.depth = Math.min(node.file.depth, node.depth);
      }
      if (node.depth <= 1) {
        const nodesToAdd = node.edges;
        nodesToAdd.forEach((nodeToAdd) => {
          if (nodeToAdd.depth === null) {
            nodeToAdd.depth = node.depth + 1;
            this.nodes.push(nodeToAdd);
          }
        });
      }
      this.processedNodes.push(node);
    }
  }

  summarize() {
    /*
    - magic.json
    - depth 0 nodes
    - depth 0 files
    - non js files
    - depth 1 nodes
    - depth 1 files
    - depth 2 nodes
    - depth 2 files
    */
    this.length = 0;
    this.files["magic.json"].add();
  }

  format(method) {
    const fileStrings = [];
    this.files.forEach((file) => {
      const fileString = method(file);
      if (fileString) {
        fileStrings.push(`<${file.filename}>
${fileString}
</${file.filename}>`);
      }
    });
    return `<files>
${fileStrings.join("\n")}
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
    this.depth = null;
    this.exports = {}; //map of exported name to local name
    this.summary = [];
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
      const { ast, scopeManager } = analyze(this.content);
      this.ast = ast;
      this.scopeManager = scopeManager;
      this.ast.body.forEach((astNode, index) => {
        let selected = false;
        if (selectionStart && selectionEnd) {
          selected =
            astNode.start < selectionEnd && astNode.end > selectionStart;
        }
        const node = new Node(this.context, this, astNode, selected, index);
        this.nodes.push(node);
        if (astNode.type === "ExportNamedDeclaration") {
          astNode.specifiers.forEach((specifier) => {
            if (specifier.type === "ExportSpecifier") {
              this.exports[specifier.exported.name] = specifier.local.name;
            }
            // } else if (specifier.type === "ExportNamespaceSpecifier") {
            //   this.exports["*"] = specifier.local.name;
            // }
          });
        } else if (astNode.type === "ExportDefaultDeclaration") {
          this.exports["default"] =
            astNode.declaration.id?.name ||
            astNode.declaration.name ||
            "default";
        }
        // } else if (astNode.type === "ExportAllDeclaration") {
        //   //todo?
        // }
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
            let name;
            if (reference.node.type === "ImportDefaultSpecifier") {
              name = "default";
            } else if (reference.node.type === "ImportSpecifier") {
              name = reference.node.imported.name;
            } else if (reference.node.type === "ImportNamespaceSpecifier") {
              name = "*";
            } else {
              throw new Error(
                `Unexpected import syntax, specifier: ${reference.node.type}`,
              );
            }
            referenceFile.resolveReference(node, name, true);
          }
        } else {
          this.resolveReference(node, reference.name.name, false);
        }
      });
    });
  }

  resolveReference(node, name, isImport) {
    if (isImport) {
      name = this.exports[name];
    }
    const referencedNode = this.definitions[name];
    if (referencedNode) {
      node.edges.push(referencedNode);
      referencedNode.edges.push(node);
    }
  }

  add() {
    if (!this.js) {
      this.summary.push(this.content);
      return this.content.length;
    }
    //todo
  }

  addNode(node) {
    if (this.summary.length > 0) {
      //todo
    }
    //todo
  }

  get() {
    if (this.summary.length > 0) {
      return this.summary.join("\n");
    }
  }
}

class Node {
  constructor(context, file, astNode, selected, index) {
    this.context = context;
    this.file = file;
    this.astNode = astNode;
    this.selected = selected;
    this.index = index;
    this.depth = null;
    if (selected) {
      this.depth = 0;
      this.context.nodes.push(this);
    }
    let variables = this.file.scopeManager
      .getDeclaredVariables(this.astNode)
      .map((variable) => variable.name);
    if (
      variables.length === 0 &&
      this.astNode.type === "ExportDefaultDeclaration"
    ) {
      variables.push("default");
    }
    variables.forEach((variable) => {
      if (this.file.definitions[variable]) {
        console.warn("duplicate definition", variable); //todo remove this
      }
      this.file.definitions[variable] = this;
    });
    this.references = [];
    this.scope = this.file.scopeManager.acquire(this.astNode);
    //this.scope.through is a list of references outside the scope (which is what we want)
    //confusingly, this.scope.references is a list of references inside the scope - ignore this
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
    this.edges = [];
  }

  add() {
    return this.file.addNode(this);
  }
}

function context(rawFiles, selectedFilename, selection, scriptFile) {
  return new Context(rawFiles, selectedFilename, selection, scriptFile).get();
}

export { context, Context, File, Node };
