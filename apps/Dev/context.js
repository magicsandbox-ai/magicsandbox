import { parse } from "./parser.js";
import * as eslintScope from "eslint-scope";
import { prompt } from "./prompt.js";

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
- re-exporting/barrel modules/ExportAllDeclaration/ExportNamespaceSpecifier
*/

class Context {
  constructor(rawFiles = {}, selectedFiles = [], selectedCode = [], toastsRef) {
    this.rawFiles = rawFiles;
    this.selectedFiles = new Set(selectedFiles);
    this.selectedCode = selectedCode;
    this.maxLength = 25000; //todo make configurable
    this.length = 0;
    this.files = {};
    this.nodes = [];
    this.processedNodes = [];
    this.toastsRef = toastsRef;
  }

  get() {
    this.init();
    if (this.length <= this.maxLength) {
      return this.format(false);
    }
    this.process();
    this.summarize();
    return this.format(true);
  }

  init() {
    Object.entries(this.rawFiles).forEach(([filename, content]) => {
      this.length += content.length;
      this.files[filename] = new File(this, filename, content);
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
    const items = [
      this.files["magic.json"],
      ...this.files.filter((file) => !file.js && file.selected),
      ...this.processedNodes.filter((node) => node.depth === 0),
      ...this.files.filter((file) => !file.js && !file.selected),
      ...this.processedNodes.filter((node) => node.depth === 1),
      ...this.processedNodes.filter((node) => node.depth === 2),
    ];
    this.length = 0;
    let i = 0;
    while (i < items.length && this.length <= this.maxLength) {
      const item = items[i];
      this.length += item.add();
      i++;
    }
  }

  format(summarizedContext) {
    let method = (file) => file.content;
    if (summarizedContext) {
      method = (file) => file.get();
    }
    const fileStrings = [];
    Object.values(this.files).forEach((file) => {
      fileStrings.push(`<${file.filename}>
${method(file)}
</${file.filename}>`);
    });
    const context = `<files>
${fileStrings.join("\n")}
</files>`;
    return prompt({ context, summarizedContext });
  }
}

class File {
  constructor(context, filename, content) {
    this.context = context;
    this.filename = filename;
    this.js = this.filename.endsWith(".js") || this.filename.endsWith(".jsx");
    this.content = content;
    this.selected = this.context.selectedFiles.has(filename);
    this.selectionRanges = [];
    this.nodes = [];
    this.definitions = {};
    this.depth = null;
    this.exports = {}; //map of exported name to local name
    this.summary = [];
  }

  findSelectionRanges() {
    if (this.selected) return [[0, this.content.length]];
    const ranges = [];
    for (const selection of this.context.selectedCode) {
      for (const index of indexOfAll(this.content, selection)) {
        ranges.push([index, index + selection.length]);
      }
    }
    return ranges;
  }

  parse() {
    if (!this.js) {
      this.context.length += this.content.length;
      return;
    }
    this.selectionRanges = this.findSelectionRanges();
    try {
      const { ast, scopeManager } = analyze(this.content);
      this.ast = ast;
      this.scopeManager = scopeManager;
      this.ast.body.forEach((astNode, index) => {
        const node = new Node(this.context, this, astNode, index);
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
      console.error(e);
      this.context.toastsRef.current.addToast(
        `Unexpected error gathering context`,
        "error",
      );
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
    } else {
      let summaryLength = 0;
      this.nodes.forEach((node) => {
        const nodeSummary = node.summarize();
        summaryLength += nodeSummary.length;
        this.summary.push(nodeSummary);
      });
      return summaryLength;
    }
  }

  addNode(node) {
    if (this.summary.length > 0) {
      const oldLength = this.summary[node.index].length;
      this.summary[node.index] = this.content.slice(
        node.astNode.start,
        node.astNode.end,
      );
      return this.summary[node.index].length - oldLength;
    } else {
      const summaryLength = this.add();
      const additionalNodeLength = this.addNode(node);
      return summaryLength + additionalNodeLength;
    }
  }

  get() {
    if (this.summary.length > 0) {
      return this.summary.join("\n");
    }
    return "...";
  }
}

class Node {
  constructor(context, file, astNode, index) {
    this.context = context;
    this.file = file;
    this.astNode = astNode;
    this.index = index;
    this.depth = null;
    this.selected = this.file.selectionRanges.some(
      ([start, end]) => this.astNode.start < end && this.astNode.end > start,
    );
    if (this.selected) {
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
      this.file.definitions[variable] = this;
    });
    this.references = [];
    this.scope = this.file.scopeManager.acquire(this.astNode);
    //this.scope.through is a list of references outside the scope (which is what we want)
    //confusingly, this.scope.references is a list of references inside the scope - ignore this
    this.scope.through.forEach((reference) => {
      const resolved = reference.resolved;
      if (resolved) {
        this.references.push(...resolved.defs);
      }
    });
    this.edges = [];
  }

  add() {
    return this.file.addNode(this);
  }

  summarize() {
    const astNode = this.astNode;
    const type = astNode.type;
    let start = astNode.start;
    let end = astNode.end;
    const slice = (start, end) => this.file.content.slice(start, end);
    if (
      type === "ImportDeclaration" ||
      type === "ExportNamedDeclaration" ||
      type === "ExportAllDeclaration" ||
      //if we're default exporting something we already defined, include it, otherwise no
      (type === "ExportDefaultDeclaration" && astNode.declaration.name)
    ) {
      //pass, use start to end
    } else if (astNode.params) {
      //FunctionDeclaration, FunctionExpression, ArrowFunctionExpression
      end = astNode.body.start - 1;
    } else if (astNode.body?.type === "ClassBody") {
      //ClassDeclaration, ClassExpression
      const body = astNode.body.body
        .filter((node) => node.type === "MethodDefinition")
        .map((node) => slice(node.start, node.value.body.start - 1));
      return `${slice(start, astNode.body.start - 1)} {
${body.join("\n")}
}`;
    } else {
      end = Math.min(end, start + 100);
    }
    const content = slice(start, end);
    if (end < astNode.end) {
      return content + "...";
    }
    return content;
  }
}

function context(devState, { files = [], code = [] } = {}) {
  let selectedFiles, selectedCode;
  if (files.length > 0 || code.length > 0) {
    selectedFiles = files;
    selectedCode = code;
  } else {
    selectedFiles = [devState.selectedFilename];
    if (
      !(
        devState.selectedFilename.endsWith(".js") ||
        devState.selectedFilename.endsWith(".jsx")
      )
    ) {
      //if we don't select at least one JS file, we won't get any JS context, so add scriptFile
      selectedFiles.push(devState.scriptFile);
    }
    selectedCode = [window.getSelection().toString()];
  }
  return new Context(
    devState.files,
    selectedFiles,
    selectedCode,
    devState.toastsRef,
  ).get();
}

export { context };

function indexOfAll(str, search) {
  if (!str) return []; //empty string matches every index
  const indices = [];
  let index = str.indexOf(search);
  while (index !== -1) {
    indices.push(index);
    index = str.indexOf(search, index + 1);
  }
  return indices;
}
