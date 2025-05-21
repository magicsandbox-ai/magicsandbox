import {
  schema,
  defaultMarkdownParser,
  defaultMarkdownSerializer,
} from "prosemirror-markdown";
import { Transform } from "prosemirror-transform";
import type { Node } from "prosemirror-model";

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
      finalContent +=
        content.slice(prevIndex, index) +
        (content[index + 1] === "\n" ? "\n\n\u200B" : "\n\n");
    }
    prevIndex = index + 1;
  }
  return defaultMarkdownParser.parse(finalContent);
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
    .replace(/\u200B\n\n/g, "\n") // Replace zero width space followed by two newlines with single newline
    .replace(/\u200B/g, ""); // Remove all other zero width spaces
}

export { parse, serialize, schema };
