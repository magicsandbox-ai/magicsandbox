import { remark } from "remark";
import { visit, SKIP } from "unist-util-visit";

function remarkGetHeadings(headings) {
  return function (tree) {
    headings = new Set(headings);
    let currentDepth;
    const filteredNodes = [];
    visit(tree, (node) => {
      if (node.type === "heading") {
        if (headings.has(node.children[0].value)) {
          if (!currentDepth || node.depth < currentDepth) {
            currentDepth = node.depth;
          }
        } else if (node.depth <= currentDepth) {
          currentDepth = null;
        }
      }
      if (currentDepth) {
        filteredNodes.push({
          ...node,
          position: undefined, //remove position information to enable auto formatting
        });
        return SKIP; //don't traverse children if we added the node
      }
    });
    tree.children = filteredNodes;
  };
}

async function getHeadings(docs, headings) {
  const file = await remark().use(remarkGetHeadings, headings).process(docs);
  return file.value;
}

export { getHeadings };
