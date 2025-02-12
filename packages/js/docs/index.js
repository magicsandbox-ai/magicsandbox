import { remark } from "remark";
import { visit, SKIP } from "unist-util-visit";

function remarkGetHeadings(headings) {
  return function (tree) {
    headings = new Set(headings);
    let currentDepth;
    const seenHeadings = new Set();
    const filteredNodes = [];
    visit(tree, (node) => {
      if (node.type === "heading") {
        if (headings.has(node.children[0].value)) {
          seenHeadings.add(node.children[0].value);
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
    if (seenHeadings.size < headings.size) {
      //better to throw than silently fail
      let missingHeadings = Array.from(headings).filter(
        (heading) => !seenHeadings.has(heading),
      );
      missingHeadings = missingHeadings.join(", ");
      throw new Error(
        `Some headings were not found in the document: ${missingHeadings}`,
      );
    }
    tree.children = filteredNodes;
  };
}

function getHeadings(docs, headings) {
  const file = remark().use(remarkGetHeadings, headings).processSync(docs);
  return file.value;
}

export { getHeadings };
