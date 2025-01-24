import { babelParse } from "./parser.js";

//10000 token context limit - 25000 characters
//use search/replace if files are large
//later - some kind of graph approach to pick out most relevant files? only include functions that are imported/exported?
//show all of current file? focus on what's higlighted? what's the UX?
//loop through specifiers in highlighted to see what's defined?
//later - how to get docs for dependencies and Functions

/*
- highlighted node
- definition of references in highlighted node plus their imports
- current file (if js) summary
- current file (if js)
- current file references
- scriptfile summary
- scriptfile
- scriptfile references
- all file summaries ranked by depth
- all files ranked by depth
*/

/*
file:
  - 
node:
  - summary: string
  - content: string
  - filename: string //where it's defined
  - references: node[]
*/

class Context {
  constructor(rawFiles, selectedFilename, selection, scriptFile) {
    this.rawFiles = rawFiles;
    if (
      this.selectedFilename.endsWith(".js") ||
      this.selectedFilename.endsWith(".jsx")
    ) {
      this.selectedFilename = selectedFilename;
      this.selection = selection;
    } else {
      this.selectedFilename = scriptFile;
      this.selection = null;
    }
    this.maxLength = 25000; //todo make configurable
    this.length = 0;
    this.files = {};
    this.nodes = [];
  }

  get() {
    Object.entries(this.rawFiles).forEach(([filename, content]) => {
      this.length += content.length;
      if (this.selectedFilename === filename) {
        this.files[filename] = new File(
          this,
          filename,
          content,
          true,
          this.selection,
        );
      } else {
        this.files[filename] = new File(this, filename, content, false, null);
      }
    });
    if (this.length <= this.maxLength) {
      return this.format((file) => file.content);
    }
    Object.values(this.files).forEach((file) => file.parse());
    while (this.nodes.length > 0) {
      const node = this.nodes.shift();
      //todo
    }
    return this.format((file) => file.get());
  }

  format(method) {
    //todo sort
    const files = [this.files["magic.json"]];
    const jsFiles = Object.values(this.files)
      .filter((file) => file.include)
      .sort((a, b) => a.priority - b.priority);
    files.push(...jsFiles);
    files.push(
      ...Object.values(this.files).filter(
        (file) => !file.js && file.filename !== "magic.json",
      ),
    );
    return `<files>
  ${files
    .map(
      (file) => `<${file.filename}>
${method(file)}
</${file.filename}>`,
    )
    .join("\n")}
</files>`;
  }
}

class File {
  constructor(context, filename, content, selected, selection) {
    this.context = context;
    this.filename = filename;
    this.js = this.filename.endsWith(".js") || this.filename.endsWith(".jsx");
    this.content = content;
    this.selected = selected;
    this.selection = selection;
    this.nodes = [];
  }

  parse() {
    if (!this.js) return;
    let selectionStart, selectionEnd;
    if (this.selection && this.selection.length < this.content.length) {
      selectionStart = this.content.indexOf(this.selection);
      selectionEnd = selectionStart + this.selection.length;
    } else if (this.selection) {
      selectionStart = 0;
      selectionEnd = this.content.length;
    }
    try {
      babelParse(this.content, (node) => {
        let selected = false;
        if (selectionStart && selectionEnd) {
          selected = node.start < selectionEnd && node.end > selectionStart;
        }
        const node = new Node(this, node, selected);
        this.nodes.push(node);
        if (selected) {
          this.context.nodes.push(node);
        }
      });
    } catch (e) {
      console.error(e); //todo
    }
  }

  get() {
    if (!this.js) return this.content;
    //todo
  }
}

class Node {
  constructor(file, node, selected) {
    this.file = file;
    this.node = node;
    this.selected = selected;
  }
}

function context(rawFiles, selectedFilename, selection, scriptFile) {
  return new Context(rawFiles, selectedFilename, selection, scriptFile).get();
}

export { context };
