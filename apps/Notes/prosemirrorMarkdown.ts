import {
  schema,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import { Transform } from "prosemirror-transform";
import { type Node } from "prosemirror-model";

/**
 * Parse a markdown string into a Prosemirror document
 *
 * Changes the default behavior of the markdown parser:
 * - instead of treating two newlines as a paragraph break, treat a single newline as a paragraph break
 * - insert a zero width space between consecutive newlines to preserve multiple empty lines
 */
function parse(content: string) {
  let finalContent = "";
  let prevIndex = 0;
  let index;
  while (true) {
    index = content.indexOf("\n", prevIndex);
    if (index === -1) {
      finalContent += content.slice(prevIndex);
      break;
    } else {
      let separator: string;
      let prevIndexIncrement: number;
      if (content[index + 1] === ">") {
        //blockquote case
        if (
          content[index + 2] === "\n" ||
          content.slice(index + 2, index + 4) === " \n"
        ) {
          //consecutive newlines, use a zero width space to preserve empty paragraph
          //both >\n and > \n are treated as empty newlines
          separator = "\n>\n>\u200B";
        } else {
          //single newline, but we need two newlines in markdown to separate paragraphs
          separator = "\n>\n>";
        }
        prevIndexIncrement = 2; //handled "\n>"
      } else {
        if (content[index + 1] === "\n") {
          //consecutive newlines, use a zero width space to preserve empty paragraph
          separator = "\n\n\u200B";
        } else {
          //single newline, but we need two newlines in markdown to separate paragraphs
          separator = "\n\n";
        }
        prevIndexIncrement = 1; //handled "\n"
      }
      finalContent += content.slice(prevIndex, index) + separator;
      prevIndex = index + prevIndexIncrement;
    }
  }
  const doc = defaultMarkdownParser.parse(finalContent);
  //newlines in paragraphs were already fine, so undo the change we just made
  const codeBlocks: { from: number; to: number; text: string }[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      if (node.type.name === "code_block") {
        codeBlocks.push({
          from: pos + 1, //the start of the code block counts as one token
          to: pos + node.nodeSize,
          text: node.textContent,
        });
      }
      return false; //don't iterate over children
    }
  });
  const transform = new Transform(doc);
  for (const codeBlock of codeBlocks) {
    transform.replaceWith(
      codeBlock.from,
      codeBlock.to,
      schema.text(
        codeBlock.text
          .slice(1, codeBlock.text.length - 1) //remove extra newline at the start and end of the code block
          .replace(/\n\n\u200B?/g, "\n"),
      ),
    );
  }
  return transform.doc;
}

/**
 * Serialize a Prosemirror document to a markdown string.
 * For better compatibility with other tools, we want (1) to use single newlines for paragraph breaks, and (2) to preserve multiple empty lines.
 *
 * Changes the default behavior of the markdown serializer:
 * - before serializing, insert a zero width space into empty paragraphs to preserve multiple empty lines
 * - after serializing, replace two newline paragraph breaks with a single newline and remove the zero width spaces
 */
function serialize(doc: Node) {
  const paragraphs: number[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph") {
      paragraphs.push(pos + node.nodeSize - 1);
    }
  });
  const transform = new Transform(doc);
  for (const pos of paragraphs) {
    transform.insert(transform.mapping.map(pos), schema.text("\u200B"));
  }
  const serialized = defaultMarkdownSerializer.serialize(transform.doc);
  return serialized
    .replace(/\u200B\n>?\n/g, "\n") // Replace zero width space followed by two newlines with single newline. the ">?" handles blockquotes
    .replace(/\u200B/g, ""); // Remove all other zero width spaces (handle final paragraph - other edge cases?)
}

export { parse, serialize, schema };
