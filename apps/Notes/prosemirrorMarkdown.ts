import {
  schema,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownSerializerState,
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
        separator = "";
        if (index === 0) {
          //special case for the first line
          separator += "\u200B";
        }
        if (content[index + 1] === "\n" || index === content.length - 1) {
          //consecutive newlines, use a zero width space to preserve empty paragraph
          //special case for the last line
          separator += "\n\n\u200B";
        } else {
          //single newline, but we need two newlines in markdown to separate paragraphs
          separator += "\n\n";
        }
        prevIndexIncrement = 1; //handled "\n"
      }
      finalContent += content.slice(prevIndex, index) + separator;
      prevIndex = index + prevIndexIncrement;
    }
  }
  const doc = defaultMarkdownParser.parse(finalContent);
  /*
  now let's clean up what we just did
  - remove the zero width spaces in empty paragraphs, as they can cause issues when copy/pasting into other tools
  - the newlines in code blocks didn't need to be doubled, so we'll undo that
  */
  const emptyParagraphs: number[] = [];
  const codeBlocks: { from: number; to: number; text: string }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph" && node.textContent === "\u200B") {
      emptyParagraphs.push(pos);
    } else if (node.type.name === "code_block") {
      codeBlocks.push({
        from: pos + 1, //the start of the code block counts as one token
        to: pos + node.nodeSize,
        text: node.textContent,
      });
    }
  });
  const transform = new Transform(doc);
  for (const pos of emptyParagraphs) {
    transform.delete(
      transform.mapping.map(pos + 1), //the start of the paragraph counts as one token
      transform.mapping.map(pos + 2),
    );
  }
  for (const codeBlock of codeBlocks) {
    transform.replaceWith(
      transform.mapping.map(codeBlock.from),
      transform.mapping.map(codeBlock.to),
      schema.text(
        codeBlock.text
          .slice(1, codeBlock.text.length - 1) //remove extra newline at the start and end of the code block
          .replace(/\n\n\u200B?/g, "\n"),
      ),
    );
  }
  return transform.doc;
}

//@ts-ignore - this isn't ideal but alternative is forking the package
const originalFlushClose = MarkdownSerializerState.prototype.flushClose;
//@ts-ignore
MarkdownSerializerState.prototype.flushClose = function (size = 1) {
  return originalFlushClose.call(this, size);
};

/**
 * Serialize a Prosemirror document to a markdown string.
 * For better compatibility with other tools, we want (1) to use single newlines for paragraph breaks, and (2) to preserve multiple empty lines.
 *
 * Changes the default behavior of the markdown serializer:
 * - monkey patches the internal flushClose method to use a single newline between block elements by default
 * - insert a zero width space into empty paragraphs to preserve multiple empty lines
 */
function serialize(doc: Node) {
  const emptyParagraphs: number[] = [];
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
  return serialized.replace(/\u200B/g, "");
}

export { parse, serialize, schema };
