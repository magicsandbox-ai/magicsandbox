import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import mermaid from "mermaid";
import { visit } from "unist-util-visit";
import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";
import { toc } from "mdast-util-toc";
import { visitParents } from "unist-util-visit-parents";
import { promises as fs } from "fs";

mermaid.initialize({ startOnLoad: false });

function rehypeMermaid() {
  return async (tree) => {
    const nodes = [];
    visit(tree, "element", (node) => {
      if (
        node.tagName === "pre" &&
        node.children.length === 1 &&
        node.children[0].tagName === "code" &&
        node.children[0].properties.className?.includes("language-mermaid")
      ) {
        nodes.push(node);
      }
    });
    await Promise.all(
      nodes.map(async (node, i) => {
        const { svg } = await mermaid.render(
          `mermaid-${i}`, //these need to be unique
          node.children[0].children[0].value,
        );
        node.tagName = "div";
        node.properties = { className: "mermaid" };
        node.children = fromHtmlIsomorphic(svg, { fragment: true }).children;
      }),
    );
  };
}

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
        parent.properties.style = `padding-left: ${(depth - 1) * 8}px;`; //subtract 1 since we don't want to indent the first level
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
    .use(rehypeMermaid)
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
  html = html.replace("%%MAIN%%", main.result);
  html = html.replace("%%NAV%%", nav.result);
  await fs.writeFile(new URL("./index.html", folder), html, "utf8");
  await fs.copyFile(
    new URL("./files/index.js", import.meta.url),
    new URL("./index.js", folder),
  );
  await fs.copyFile(
    new URL("./files/index.css", import.meta.url),
    new URL("./index.css", folder),
  );
  await fs.copyFile(
    new URL("./files/tailwind.config.mjs", import.meta.url),
    new URL("./tailwind.config.mjs", folder),
  );
  await fs.writeFile(new URL("./index.md", folder), markdown, "utf8");
}

export { docs };
