import * as espree from "espree";

function parse(file, handler) {
  const ast = espree.parse(file, {
    ecmaVersion: 2022,
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
