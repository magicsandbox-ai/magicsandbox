import babelParser from "prettier/plugins/babel";
import fs from "fs";
import glob from "glob";

// const file = fs.readFileSync("apps/Dev/index.js", "utf8");

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

function parse(file) {
  const content = fs.readFileSync(file, "utf8");
  const ast = babelParser.parsers.babel.parse(content, {
    sourceType: "module",
  });
  const nodes = ast.program.body;
  let output = `\n=== ${file} ===\n`;
  for (const node of nodes) {
    output += `${node.type}\n`;
    output += `${content.slice(node.start, Math.min(node.end, node.start + 100))}\n\n`;
  }
  return output;
}

const files = glob.sync("./**/*.js", {
  ignore: ["**/node_modules/**"],
  absolute: true,
});

let allOutput = "";
for (const file of files) {
  try {
    allOutput += parse(file);
  } catch (error) {
    allOutput += `\n=== ${file} ===\nError parsing file: ${error.message}\n`;
  }
}

fs.writeFileSync("output.txt", allOutput);
