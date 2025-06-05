import * as espree from "espree";
import type { Statement, ModuleDeclaration } from "acorn";

//todo: espree is version 9.6.1, but types are version 10.1.0 - there are no types available for version 9?
//and it seems like espree just uses the types from acorn?

type Node = Statement | ModuleDeclaration;

function parse(
  file: string,
  handler?: (node: Node, index: number, nodes: Node[], file: string) => void,
) {
  const ast = espree.parse(file, {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
    range: true, //required for eslint-scope
  });
  const nodes = ast.body;
  if (handler) {
    nodes.forEach((node, i, nodes) => {
      handler(node, i, nodes, file);
    });
  }
  return ast;
}

export { parse };
export type { Node };
