import fs from "fs";
// import babelParser from "prettier/plugins/babel";
// import glob from "glob";
import * as espree from "espree";
import * as eslintScope from "eslint-scope";

const file = fs.readFileSync("apps/Dev/index.js", "utf8");
//const file = fs.readFileSync("apps/Assistant/index.js", "utf8");

const ast = espree.parse(file, {
  ecmaVersion: 2022,
  sourceType: "module",
  ecmaFeatures: { jsx: true },
  range: true, //required for eslint-scope
});

/*
this section is copied from eslint-scope/lib/index.js so we can override Referencer
*/
const eslintScopeOptions = {
  optimistic: false,
  directive: false,
  nodejsScope: false,
  impliedStrict: false,
  sourceType: "module",
  ecmaVersion: 2022,
  childVisitorKeys: null,
  fallback: "iteration",
  ignoreEval: true,
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

function analyze(tree, options) {
  const scopeManager = new eslintScope.ScopeManager(options);
  const referencer = new JSXReferencer(options, scopeManager);
  referencer.visit(tree);
  if (scopeManager.__currentScope !== null) {
    throw new Error("currentScope should be null.");
  }
  return scopeManager;
}

const scopeManager = analyze(ast, eslintScopeOptions);

console.log(scopeManager);

//const node = ast.body[21];
// const node = ast.body[9];
// const scope = scopeManager.acquire(node);
// const references = [];
// scope.through.forEach((reference) => {
//   references.push(...(reference.resolved?.defs || []));
// });

// console.log(references);

/*
for each node, get its scope plus its recursive child scopes. get all (resolved?) references
get variables from resolved references. then identifiers? or defs?
map import/export references
*/

// const ast = babelParser.parsers.babel.parse(file, { sourceType: "module" });
// const nodes = ast.program.body;

// console.log(nodes);

// for (const node of nodes) {
//   if (node.type === "ImportDeclaration") {
//     console.log(file.slice(node.start, node.end));
//   } else if (node.type === "FunctionDeclaration") {
//     console.log(file.slice(node.start, node.body.start));
//   } else if (node.type === "ExportNamedDeclaration") {
//     console.log(file.slice(node.start, node.end));
//   }
// }

// function parse(file) {
//   const content = fs.readFileSync(file, "utf8");
//   const ast = babelParser.parsers.babel.parse(content, {
//     sourceType: "module",
//   });
//   const nodes = ast.program.body;
//   let output = `\n=== ${file} ===\n`;
//   for (const node of nodes) {
//     output += `${node.type}\n`;
//     output += `${content.slice(node.start, Math.min(node.end, node.start + 100))}\n\n`;
//   }
//   return output;
// }

// function summarize(file) {
//   const ast = babelParser.parsers.babel.parse(file, {
//     sourceType: "module",
//   });
//   const nodes = ast.program.body;
//   for (const node of nodes) {
//     if (node.type === "ImportDeclaration") {
//       console.log(file.slice(node.start, node.end));
//     } else if (node.type === "FunctionDeclaration") {
//       console.log(file.slice(node.start, node.body.start));
//       //include comments?
//       //JSX?
//       //whole thing if short?
//     } else if (node.type === "ClassDeclaration") {
//       //todo
//     } else if (node.type === "VariableDeclaration") {
//       //todo
//     } else if (node.type === "ExpressionStatement") {
//       //todo
//     }
//   }
// }

// const files = glob.sync("./**/*.js", {
//   ignore: ["**/node_modules/**"],
//   absolute: true,
// });

// let allOutput = "";
// for (const file of files) {
//   try {
//     allOutput += parse(file);
//   } catch (error) {
//     allOutput += `\n=== ${file} ===\nError parsing file: ${error.message}\n`;
//   }
// }

// fs.writeFileSync("output.txt", allOutput);
