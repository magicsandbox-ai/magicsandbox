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

/**
 * Returns {path: string, names: {name: localName}}
 */
function getImport(node) {
  if (node.type === "ImportDeclaration") {
    const names = {};
    node.specifiers.forEach((specifier) => {
      if (specifier.type === "ImportDefaultSpecifier") {
        names.default = specifier.local.name;
      } else if (specifier.type === "ImportSpecifier") {
        names[specifier.imported.name] = specifier.local.name;
      } else if (specifier.type === "ImportNamespaceSpecifier") {
        names["*"] = specifier.local.name;
      } else {
        throw new Error(
          `Unexpected import syntax, specifier: ${specifier.type}`,
        );
      }
    });
    return { path: node.source.value, names };
  } else if (node.type === "ExportNamedDeclaration" && node.source?.value) {
    const names = {};
    node.specifiers.forEach((specifier) => {
      if (specifier.type === "ExportSpecifier") {
        names[specifier.local.name] = specifier.exported.name;
      } else if (specifier.type === "ExportNamespaceSpecifier") {
        names["*"] = specifier.exported.name;
      } else {
        throw new Error(
          `Unexpected export syntax, specifier: ${specifier.type}`,
        );
      }
    });
    return { path: node.source.value, names };
  } else if (node.type === "ExportAllDeclaration" && node.source?.value) {
    return { path: node.source.value, names: { "*": "*" } };
  }
}

export { parse, getImport };
