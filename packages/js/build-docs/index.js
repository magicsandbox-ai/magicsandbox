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
import { updateMagicJson } from "@magicsandbox.ai/dev";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function remarkToc() {
  return function (tree) {
    const result = toc(tree, { maxDepth: 3 });
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

function rehypeLinks() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName === "a" && node.properties.href.startsWith("#")) {
        node.properties.href =
          "https://magicsandbox.ai/?app=magicsandbox.Docs&id=" +
          node.properties.href.slice(1); //remove leading #
      }
    });
  };
}

async function handleMagicJson(folder) {
  try {
    await updateMagicJson(folder, (obj) => {
      obj.scriptFile = obj.scriptFile || "dist/index.js";
      obj.htmlFile = obj.htmlFile || "dist/index.html";
      obj.styleFile = obj.styleFile || "dist/index.css";
      obj.prebuild =
        obj.prebuild || "npx magicsandbox docs ${path.basename(folder)}";
      obj.esbuildOptions = {
        ...obj.esbuildOptions,
        loader: {
          ".md": "text",
          ...obj.esbuildOptions?.loader,
        },
      };
    });
  } catch (error) {
    if (error.code === "ENOENT") {
      const defaultMagicJson = `{
  name: "${path.basename(folder)}",
  version: "0.0.1",
  scriptFile: "dist/index.js",
  htmlFile: "dist/index.html",
  styleFile: "dist/index.css",
  prebuild: "npx magicsandbox docs ${path.basename(folder)}",
  esbuildOptions: {
    loader: { ".md": "text" },
  },
}`;
      await fs.writeFile(
        path.join(folder, "magic.json5"),
        defaultMagicJson,
        "utf8",
      );
    } else {
      throw error;
    }
  }
}

async function handleMarkdown(folder) {
  let markdown;
  try {
    markdown = await fs.readFile(path.join(folder, "index.md"), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      markdown = `# Sample Documentation
      
This file was automatically generated. Edit your documentation here!
`;
      await fs.writeFile(path.join(folder, "index.md"), markdown, "utf8");
    } else {
      throw error;
    }
  }
  return markdown;
}

async function handleHtml(folder) {
  const [markdown, html] = await Promise.all([
    handleMarkdown(folder),
    fs.readFile(path.join(__dirname, "files", "index.html"), "utf8"),
  ]);
  const [main, nav] = await Promise.all([
    unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeSlug)
      .use(rehypeCode)
      .use(rehypeHighlight)
      .use(rehypeLinks)
      .use(rehypeStringify)
      .process(markdown),
    unified()
      .use(remarkParse)
      .use(remarkToc)
      .use(remarkRehype)
      .use(rehypeIndentNav)
      .use(rehypeLinks)
      .use(rehypeStringify)
      .process(markdown),
  ]);
  let finalHtml = html.replace("%%MAIN%%", main);
  finalHtml = finalHtml.replace("%%NAV%%", nav);
  await fs.writeFile(
    path.join(folder, "dist", "index.html"),
    finalHtml,
    "utf8",
  );
}

async function buildDocs(folder) {
  await fs.mkdir(path.join(folder, "dist"), { recursive: true });
  await Promise.all([
    handleMagicJson(folder),
    handleHtml(folder),
    fs.copyFile(
      path.join(__dirname, "files", "index.js"),
      path.join(folder, "dist", "index.js"),
    ),
    fs.copyFile(
      path.join(__dirname, "files", "index.css"),
      path.join(folder, "dist", "index.css"),
    ),
  ]);
}

export { buildDocs };
