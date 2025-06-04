import { parse, type Node as AstNode } from "./parser.ts";
import * as eslintScope from "eslint-scope";
import { prompt } from "./prompt.ts";
import { ToastError } from "@utils/Toast.ts";
import type * as eslint from "eslint";
import type { DevState } from "./DevState.ts";
import { SourceMapConsumer } from "source-map-js";
import { getSourceMap } from "./plugins.ts";

type NodeWithDepth = Node & { depth: number };

type OriginalPositionResult = {
  line: number | null;
  column: number | null;
};

function analyze(content: string) {
  /*
  much of this is copied from eslint-scope/lib/index.js so we can override Referencer
  todo update to 8.3 which adds JSX support
  also - the types are only available for version 8, so causes some difficulties
  */
  const options: eslintScope.AnalyzeOptions = {
    optimistic: false,
    //@ts-ignore: removed in v8
    directive: false,
    nodejsScope: false,
    impliedStrict: false,
    sourceType: "module",
    ecmaVersion: 2022,
    childVisitorKeys: null,
    fallback: "iteration",
    ignoreEval: true, //required to resolve references in a file with eval
  };
  //@ts-ignore
  class JSXReferencer extends eslintScope.Referencer {
    constructor(
      options: eslintScope.AnalyzeOptions,
      scopeManager: InstanceType<typeof eslintScope.ScopeManager>,
    ) {
      super(options, scopeManager);
    }
    JSXIdentifier(node: any) {
      //ignore tags like "div"
      if (node.name[0] === node.name[0].toUpperCase()) {
        //hack to change type to Identifier, otherwise eslint-scope will ignore it
        node.type = "Identifier";
        //@ts-ignore
        this.currentScope().__referencing(node);
      }
    }
  }
  const ast = parse(content);
  //https://eslint.org/docs/latest/extend/scope-manager-interface#scopemanager-interface
  const scopeManager = new eslintScope.ScopeManager(options);
  const referencer = new JSXReferencer(options, scopeManager);
  //@ts-ignore
  referencer.visit(ast);
  //@ts-ignore
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
  devState: DevState;
  rawFiles: { [filename: string]: string };
  selectedFiles: Set<string>;
  selectedCode: string[];
  maxLength: number;
  length: number;
  files: { [filename: string]: File };
  nodes: NodeWithDepth[];
  processedNodes: NodeWithDepth[];
  constructor(
    devState: DevState,
    selectedFiles: string[],
    selectedCode: string[],
    maxLength?: number,
  ) {
    this.devState = devState;
    this.rawFiles = Object.fromEntries(
      Object.entries(devState.selectedApp.files).map(([filename, file]) => [
        filename,
        file.content,
      ]),
    );
    this.selectedFiles = new Set(selectedFiles);
    this.selectedCode = selectedCode;
    this.maxLength = maxLength || 25000; //todo allow user to configure?
    this.length = 0;
    this.files = {};
    this.nodes = [];
    this.processedNodes = [];
  }

  async get() {
    this.init();
    if (this.length <= this.maxLength) {
      return this.format(false);
    }
    await this.process();
    this.summarize();
    return this.format(true);
  }

  init() {
    Object.entries(this.rawFiles).forEach(([filename, content]) => {
      this.length += content.length;
      this.files[filename] = new File(this, filename, content);
    });
  }

  async process() {
    await Promise.all(Object.values(this.files).map((file) => file.parse()));
    Object.values(this.files).forEach((file) => {
      file.resolveReferences();
    });
    //selected nodes add themselves to this.nodes during file.parse()
    while (this.nodes.length > 0) {
      const node = this.nodes.shift()!;
      if (node.file.depth === undefined) {
        node.file.depth = node.depth;
      } else {
        node.file.depth = Math.min(node.file.depth, node.depth);
      }
      if (node.depth <= 1) {
        const nodesToAdd = node.edges;
        nodesToAdd.forEach((nodeToAdd) => {
          if (nodeToAdd.depth === undefined) {
            nodeToAdd.depth = node.depth + 1;
            this.nodes.push(nodeToAdd as NodeWithDepth);
          }
        });
      }
      this.processedNodes.push(node);
    }
  }

  summarize() {
    const items = [
      this.files["magic.json"],
      ...Object.values(this.files).filter(
        (file) => file.filename !== "magic.json" && file.js && file.selected,
      ),
      ...this.processedNodes.filter((node) => node.depth === 0),
      ...Object.values(this.files).filter(
        (file) => file.filename !== "magic.json" && !file.js && !file.selected,
      ),
      ...this.processedNodes.filter((node) => node.depth === 1),
      ...this.processedNodes.filter((node) => node.depth === 2),
    ];
    this.length = 0;
    let i = 0;
    while (i < items.length && this.length <= this.maxLength) {
      const item = items[i];
      if (item) {
        this.length += item.add();
      }
      i++;
    }
  }

  format(summarizedContext: boolean) {
    let method = (file: File) => file.content;
    if (summarizedContext) {
      method = (file: File) => file.get();
    }
    const fileStrings: string[] = [];
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
  context: Context;
  filename: string;
  js: boolean;
  content: string;
  selected: boolean;
  selectionRanges: number[][];
  nodes: Node[];
  definitions: Record<string, Node>;
  exports: Record<string, string>;
  summary: string[];
  depth?: number;
  ast?: AstNode[];
  scopeManager?: InstanceType<typeof eslintScope.ScopeManager>;
  transformedContent?: string;
  sourceMapConsumer?: SourceMapConsumer;
  constructor(context: Context, filename: string, content: string) {
    this.context = context;
    this.filename = filename;
    this.js = isJs(filename);
    this.content = content;
    this.selected = this.context.selectedFiles.has(filename);
    this.selectionRanges = [];
    this.nodes = [];
    this.definitions = {};
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

  async parse() {
    if (!this.js) {
      this.context.length += this.content.length;
      return;
    }
    this.selectionRanges = this.findSelectionRanges();
    try {
      let content = this.content;
      //can't parse TS, so first need to strip the types
      if (isTs(this.filename)) {
        content = await this.context.devState.getJs(this.filename);
        const { sourceMap } = getSourceMap(content);
        if (sourceMap) {
          this.transformedContent = content;
          this.sourceMapConsumer = new SourceMapConsumer(sourceMap);
        }
      }
      const { ast, scopeManager } = analyze(content);
      this.ast = ast.body;
      this.scopeManager = scopeManager;
      this.ast.forEach((astNode, index) => {
        const node = new Node(this.context, this, astNode, index);
        this.nodes.push(node);
        if (astNode.type === "ExportNamedDeclaration") {
          astNode.specifiers.forEach((specifier) => {
            if (specifier.type === "ExportSpecifier") {
              //@ts-ignore: todo handle literals
              this.exports[specifier.exported.name] = specifier.local.name;
            }
            // } else if (specifier.type === "ExportNamespaceSpecifier") {
            //   this.exports["*"] = specifier.local.name;
            // }
          });
          if (astNode.declaration) {
            if ("declarations" in astNode.declaration) {
              //VariableDeclaration: export const a = 1;
              //todo
            } else {
              //FunctionDeclaration: export function a() {}
              //ClassDeclaration: export class A {}
              this.exports[astNode.declaration.id.name] =
                astNode.declaration.id.name;
            }
          }
        } else if (astNode.type === "ExportDefaultDeclaration") {
          this.exports["default"] =
            //@ts-ignore
            astNode.declaration.id?.name ||
            //@ts-ignore
            astNode.declaration.name ||
            "default";
        }
        // } else if (astNode.type === "ExportAllDeclaration") {
        //   //todo?
        // }
      });
    } catch (e) {
      console.error(e);
      this.context.devState.errorHandler(
        new ToastError("Unexpected error gathering context", "error"),
      );
    }
  }

  resolveReferences() {
    this.nodes.forEach((node) => {
      node.references.forEach((reference) => {
        if (reference.type === "ImportBinding") {
          const referenceFilename = reference.parent.source.value;
          if (typeof referenceFilename !== "string") return;
          const referenceFile = this.context.files[referenceFilename.slice(2)]; //remove ./
          if (referenceFile) {
            let name;
            if (reference.node.type === "ImportDefaultSpecifier") {
              name = "default";
            } else if (reference.node.type === "ImportSpecifier") {
              //@ts-ignore: todo handle literals
              name = reference.node.imported.name;
            } else if (reference.node.type === "ImportNamespaceSpecifier") {
              name = "*";
            } else {
              const _exhaustiveCheck: never = reference.node;
              throw new Error(
                `Unexpected import syntax, specifier: ${_exhaustiveCheck}`,
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

  resolveReference(node: Node, name: string, isImport: boolean) {
    let lookupName: string | undefined = name;
    if (isImport) {
      lookupName = this.exports[name];
    }
    if (lookupName === undefined) return;
    const referencedNode = this.definitions[lookupName];
    if (referencedNode) {
      node.edges.push(referencedNode);
      referencedNode.edges.push(node);
    }
  }

  slice(start: number, end: number) {
    if (this.transformedContent && this.sourceMapConsumer) {
      const { line: startLine, column: startColumn } = indexToLineColumn(
        this.transformedContent,
        start,
      );
      const startOriginalPosition = this.sourceMapConsumer.originalPositionFor({
        line: startLine,
        column: startColumn,
      }) as OriginalPositionResult; //the type definition for originalPositionFor is wrong - it can return null
      if (
        startOriginalPosition.line === null ||
        startOriginalPosition.column === null
      ) {
        throw new Error("Failed to get original position from source map");
      }
      const { line: endLine, column: endColumn } = indexToLineColumn(
        this.transformedContent,
        end,
      );
      let endOriginalPositionLine: number;
      let endOriginalPositionColumn: number | null = null;
      const endOriginalPosition = this.sourceMapConsumer.originalPositionFor({
        line: endLine,
        column: endColumn,
        bias: SourceMapConsumer.LEAST_UPPER_BOUND,
      }) as OriginalPositionResult;
      if (
        endOriginalPosition.line === null ||
        endOriginalPosition.column === null
      ) {
        /*
        this 27 character line:
        import React from "react";
        is represented in the source map as positions: line 1, column 0; line 1, column 7; line 1, column 18
        any column > 18 using LEAST_UPPER_BOUND will return null (it'd be nice if it returned line 1, column 27, but it doesn't)
        so if we get a null, let's try again without LEAST_UPPER_BOUND to get the line number
        and we'll pass the column as null to lineColumnToIndex, which will return the index of the last character in the line
        */
        const endOriginalPosition = this.sourceMapConsumer.originalPositionFor({
          line: endLine,
          column: endColumn,
        }) as OriginalPositionResult;
        if (
          endOriginalPosition.line === null ||
          endOriginalPosition.column === null
        ) {
          throw new Error("Failed to get original position from source map");
        }
        endOriginalPositionLine = endOriginalPosition.line;
      } else {
        endOriginalPositionLine = endOriginalPosition.line;
        endOriginalPositionColumn = endOriginalPosition.column;
      }
      return this.content.slice(
        lineColumnToIndex(
          this.content,
          startOriginalPosition.line,
          startOriginalPosition.column,
        ),
        lineColumnToIndex(
          this.content,
          endOriginalPositionLine,
          endOriginalPositionColumn,
        ),
      );
    }
    return this.content.slice(start, end);
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

  addNode(node: Node): number {
    if (this.summary.length > 0) {
      const oldLength = this.summary[node.index]!.length;
      this.summary[node.index] = this.slice(
        node.astNode.start,
        node.astNode.end,
      );
      return this.summary[node.index]!.length - oldLength;
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
  context: Context;
  file: File;
  astNode: AstNode;
  index: number;
  depth?: number;
  selected: boolean;
  references: eslint.Scope.Definition[];
  edges: Node[];
  constructor(context: Context, file: File, astNode: AstNode, index: number) {
    this.context = context;
    this.file = file;
    this.astNode = astNode;
    this.index = index;
    this.selected = this.file.selectionRanges.some(
      ([start, end]) => this.astNode.start < end! && this.astNode.end > start!,
    );
    if (this.selected) {
      this.depth = 0;
      this.context.nodes.push(this as NodeWithDepth);
    }
    if (this.file.scopeManager === undefined) {
      throw new Error("scopeManager is undefined");
    }
    let variables = this.file.scopeManager
      //@ts-ignore: todo - I think maybe a version issue?
      .getDeclaredVariables(this.astNode)
      .map((variable) => variable.name);
    if (variables.length === 0) {
      if (this.astNode.type === "ExportDefaultDeclaration") {
        variables.push("default");
      } else if (this.astNode.type === "ExportNamedDeclaration") {
        //@ts-ignore
        variables.push(this.astNode.declaration?.id?.name);
      }
    }
    variables.forEach((variable) => {
      this.file.definitions[variable] = this;
    });
    this.references = [];
    //@ts-ignore: todo
    const scope = this.file.scopeManager.acquire(this.astNode);
    //not all nodes have a scope, like `import React from "react"` - this does define a variable React though
    if (scope !== null) {
      //this.scope.through is a list of references outside the scope (which is what we want)
      //confusingly, this.scope.references is a list of references inside the scope - ignore this
      scope.through.forEach((reference) => {
        const resolved = reference.resolved;
        if (resolved) {
          this.references.push(...resolved.defs);
        }
      });
    }
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
    const slice = (start: number, end: number) => this.file.slice(start, end);
    if (
      type === "ImportDeclaration" ||
      type === "ExportNamedDeclaration" ||
      type === "ExportAllDeclaration" ||
      //if we're default exporting something we already defined, include it, otherwise no
      (type === "ExportDefaultDeclaration" && "name" in astNode.declaration)
    ) {
      //pass, use start to end
    } else if ("params" in astNode) {
      //FunctionDeclaration, FunctionExpression, ArrowFunctionExpression
      end = astNode.body.start - 1;
    } else if (
      "body" in astNode &&
      "type" in astNode.body &&
      astNode.body.type === "ClassBody"
    ) {
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

async function context(
  devState: DevState,
  { files = [], code = [] }: { files?: string[]; code?: string[] } = {},
  maxLength?: number,
) {
  let selectedFiles: string[], selectedCode: string[];
  if (files.length > 0 || code.length > 0) {
    selectedFiles = files;
    selectedCode = code;
  } else {
    const selectedFilename = devState.selectedApp.selectedFileName;
    selectedFiles = [selectedFilename];
    if (!isJs(selectedFilename)) {
      //if we don't select at least one JS file, we won't get any JS context, so add scriptFile
      const magicObj = devState.getMagicObj();
      if (magicObj.scriptFile) {
        selectedFiles.push(magicObj.scriptFile);
      } else {
        //use default scriptFiles
        selectedFiles.push("index.js", "index.jsx", "index.ts", "index.tsx");
      }
    }
    const selection = getSelection();
    if (selection) {
      selectedCode = [selection.toString()];
    } else {
      selectedCode = [];
    }
  }
  return await new Context(
    devState,
    selectedFiles,
    selectedCode,
    maxLength,
  ).get();
}

export { context };

function indexOfAll(str: string, search: string) {
  if (!str) return []; //empty string matches every index
  const indices = [];
  let index = str.indexOf(search);
  while (index !== -1) {
    indices.push(index);
    index = str.indexOf(search, index + 1);
  }
  return indices;
}

function isJs(filename: string) {
  return (
    filename.endsWith(".js") ||
    filename.endsWith(".jsx") ||
    filename.endsWith(".ts") ||
    filename.endsWith(".tsx")
  );
}

function isTs(filename: string) {
  return filename.endsWith(".ts") || filename.endsWith(".tsx");
}

function indexToLineColumn(
  content: string,
  index: number,
): { line: number; column: number } {
  if (index < 0) {
    throw new Error("Index cannot be negative");
  }
  if (index > content.length) {
    throw new Error("Index exceeds content length");
  }
  let line = 1; // 1-based line number
  let column = 0; // 0-based column number
  let lastNewlineIndex = -1;
  for (let i = 0; i < index; i++) {
    if (content[i] === "\n") {
      line++;
      lastNewlineIndex = i;
    }
  }
  column = index - (lastNewlineIndex + 1);

  return { line, column };
}

function lineColumnToIndex(
  content: string,
  line: number,
  column: number | null,
): number {
  if (line < 1) {
    throw new Error("Line number must be positive");
  }
  if (column !== null && column < 0) {
    throw new Error("Column number cannot be negative");
  }
  let currentLine = 1;
  let currentIndex = 0;
  while (currentLine < line && currentIndex < content.length) {
    if (content[currentIndex] === "\n") {
      currentLine++;
    }
    currentIndex++;
  }
  if (currentLine < line) {
    throw new Error("Line number exceeds content length");
  }
  const nextNewlineIndex = content.indexOf("\n", currentIndex);
  const lineLength =
    nextNewlineIndex === -1
      ? content.length - currentIndex
      : nextNewlineIndex - currentIndex;
  if (column !== null && column > lineLength) {
    throw new Error("Column number exceeds line length");
  }
  return currentIndex + (column ?? lineLength);
}
