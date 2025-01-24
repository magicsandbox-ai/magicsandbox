//import { parse } from '@babel/parser';
import babelParser from "prettier/plugins/babel"; //hack to reduce bundle size, for some reason prettier plugins are pre bundled

function babelParse(file, handler) {
  const ast = babelParser.parsers.babel.parse(file, { sourceType: "module" });
  const nodes = ast.program.body;
  nodes.forEach((node, i, nodes) => {
    handler(node, i, nodes, file);
  });
}

export { babelParse };
