import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import { toc } from "mdast-util-toc";
import { visit, SKIP } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";
import { promises as fs } from "fs";

function remarkToc() {
  return function (tree) {
    const result = toc(tree);
    tree.children = [result.map];
  };
}

function rehypeIndentNav() {
  return (tree) => {
    visitParents(tree, "element", (node, parents) => {
      const parent = parents[parents.length - 1];
      const depth = parents.filter((p) => p.tagName === "ul").length;
      if (node.tagName === "a") {
        parent.properties.style = `margin: 8px 0px 0px ${(depth - 1) * 16}px;`; //subtract 1 since we don't want to indent the first level
      }
    });
  };
}

function rehypeCode() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (
        node.tagName === "pre" &&
        node.children.length === 1 &&
        node.children[0].tagName === "code"
      ) {
        node.properties.className = [
          "not-prose text-sm bg-stone-50 border border-stone-500 rounded-md overflow-x-auto px-2 py-2",
        ];
        return SKIP; //don't traverse children
      }
    });
  };
}

async function docs(paths, folder) {
  const markdowns = await Promise.all(
    paths.map((path) => fs.readFile(new URL(path, folder), "utf8")),
  );
  const markdown = markdowns.join("\n");
  let html = await fs.readFile(
    new URL("./files/index.html", import.meta.url),
    "utf8",
  );
  const main = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeCode)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(markdown);
  const nav = await unified()
    .use(remarkParse)
    .use(remarkToc)
    .use(remarkRehype)
    .use(rehypeIndentNav)
    .use(rehypeStringify)
    .process(markdown);
  html = html.replace("%%MAIN%%", main);
  html = html.replace("%%NAV%%", nav);
  await fs.writeFile(new URL("./index.html", folder), html, "utf8");
  await fs.copyFile(
    new URL("./files/index.js", import.meta.url),
    new URL("./index.js", folder),
  );
  await fs.copyFile(
    new URL("./files/index.css", import.meta.url),
    new URL("./index.css", folder),
  );
  await fs.writeFile(new URL("./index.md", folder), markdown, "utf8");
}

export { docs };
