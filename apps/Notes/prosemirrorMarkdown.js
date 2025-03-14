import {
  schema,
  MarkdownParser,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import { Transform } from "prosemirror-transform";
import { Schema } from "prosemirror-model";
import MarkdownIt from "markdown-it";

/*
creating custom markdownParser, see: https://github.com/handlewithcarecollective/react-prosemirror/issues/44
this code is modified from: https://github.com/ProseMirror/prosemirror-markdown/blob/master/src/from_markdown.ts
*/

function listIsTight(tokens, i) {
  while (++i < tokens.length)
    if (tokens[i].type != "list_item_open") return tokens[i].hidden;
  return false;
}

let marks = schema.spec.marks;
const link = marks.get("link");
marks = marks.remove("link");
marks = marks.addToStart("link", {
  ...link,
  toDOM(node) {
    let { href, title } = node.attrs;
    return ["a", { href, title }, 0];
  },
});

const markdownSchema = new Schema({
  nodes: schema.spec.nodes,
  marks,
});

const markdownParser = new MarkdownParser(
  markdownSchema,
  MarkdownIt("commonmark", { html: false }),
  {
    blockquote: { block: "blockquote" },
    paragraph: { block: "paragraph" },
    list_item: { block: "list_item" },
    bullet_list: {
      block: "bullet_list",
      getAttrs: (_, tokens, i) => ({ tight: listIsTight(tokens, i) }),
    },
    ordered_list: {
      block: "ordered_list",
      getAttrs: (tok, tokens, i) => ({
        order: +tok.attrGet("start") || 1,
        tight: listIsTight(tokens, i),
      }),
    },
    heading: {
      block: "heading",
      getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
    },
    code_block: { block: "code_block", noCloseToken: true },
    fence: {
      block: "code_block",
      getAttrs: (tok) => ({ params: tok.info || "" }),
      noCloseToken: true,
    },
    hr: { node: "horizontal_rule" },
    image: {
      node: "image",
      getAttrs: (tok) => ({
        src: tok.attrGet("src"),
        title: tok.attrGet("title") || null,
        alt: (tok.children[0] && tok.children[0].content) || null,
      }),
    },
    hardbreak: { node: "hard_break" },

    em: { mark: "em" },
    strong: { mark: "strong" },
    link: {
      mark: "link",
      getAttrs: (tok) => ({
        href: tok.attrGet("href"),
        title: tok.attrGet("title") || null,
      }),
    },
    code_inline: { mark: "code", noCloseToken: true },
  },
);

/**
 * Parse a markdown string into a Prosemirror document
 *
 * Changes the default behavior of the markdown parser:
 * - instead of treating two newlines as a paragraph break, treat a single newline as a paragraph break
 * - insert a zero width space between consecutive newlines to preserve multiple empty lines
 */
function parse(content) {
  let finalContent = "";
  let prevIndex = 0;
  let index;
  while (true) {
    index = content.indexOf("\n", prevIndex);
    if (index === -1) {
      finalContent += content.slice(prevIndex);
      break;
    } else {
      finalContent +=
        content.slice(prevIndex, index) +
        (content[index + 1] === "\n" ? "\n\n\u200B" : "\n\n");
    }
    prevIndex = index + 1;
  }
  return markdownParser.parse(finalContent);
}

/**
 * Serialize a Prosemirror document to a markdown string
 *
 * Changes the default behavior of the markdown serializer:
 * - before serializing, insert a zero width space into empty paragraphs to preserve multiple empty lines
 * - after serializing, replace two newline paragraph breaks with a single newline and remove the zero width spaces
 */
function serialize(doc) {
  const emptyParagraphs = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph" && node.textContent === "") {
      emptyParagraphs.push(pos);
    }
  });
  const transform = new Transform(doc);
  for (const pos of emptyParagraphs) {
    transform.insert(transform.mapping.map(pos), schema.text("\u200B"));
  }
  const serialized = defaultMarkdownSerializer.serialize(transform.doc);
  return serialized.replace(/\n\n\u200B?/g, "\n");
}

export { parse, serialize };
