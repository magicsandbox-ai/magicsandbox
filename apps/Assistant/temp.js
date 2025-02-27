import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { visit } from "unist-util-visit";

function remarkHtmlToText() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type === "html") {
        node.type = "text";
      }
    });
  };
}

const parser = unified().use(remarkParse);
const tree = parser.parse("What's a <p> tag?");
const htmlToTexter = unified().use(remarkHtmlToText);
const tree2 = htmlToTexter.runSync(tree);
const rehyper = unified().use(remarkRehype);
const result = rehyper.runSync(tree2);
console.log(result);
