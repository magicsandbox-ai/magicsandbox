import docs from "@magicsandbox.ai/docs/docs.md";
import { getHeadings } from "@magicsandbox.ai/docs";

const heading = "Making your App Magic";

/*
todos:
- instructions on calling findFunction
*/

function prompt({ context, summarizedContext } = {}) {
  const sections = [];
  sections.push(`# magicsandbox.Dev

magicsandbox.Dev enables developing, previewing, and publishing Magic Sandbox Apps in the browser. 

## Files

By default, an App is built using the following files:

### magic.json

The App is configured by \`magic.json\`, which can be a JSON or JSON5 file.

### index.js

JavaScript file that's used as the entrypoint for the App. You can do the following:

- Import npm packages: \`import React from "react";\`
- Create other files and import them: \`import { myFunction } from "./utils.js";\`
- Use Tailwind for styling
- Use the Sandbox functions \`requestFunction\`, \`requestPutData\`, etc.

### index.html

Defaults to \`<div id="root"></div>\` if not provided.

### index.css

Defaults to \`@tailwind base; @tailwind components; @tailwind utilities;\` if not provided.`);

  sections.push(getHeadings(docs, [heading]));
  sections.push(contextPrompt({ context, summarizedContext }));
  sections.push(apiPrompt({ context, summarizedContext }));
  sections.push(instructionsPrompt({ context, summarizedContext }));
  return sections.map((section) => section.trim()).join("\n\n");
}

function contextPrompt({ context, summarizedContext }) {
  if (context) {
    return `## Context

The user is editing the below files.${
      summarizedContext
        ? ` For brevity, files may be excluded (indicated by "...") or summarized. When summarized, individual blocks of code may be truncated (indicated by "...").`
        : ""
    }

${context}
`;
  } else {
    return "";
  }
}

function apiPrompt({ context, summarizedContext }) {
  const api = [];

  api.push(`### app.api.createApp(name: string, description: string, createString: string)

Create a new App.

Arguments:

- \`name\`: the name of the App.
- \`description\`: a description of the App.
- \`createString\`: a string used to create the App's files.

Follow these instructions when generating the \`createString\`:

- magicsandbox.Dev supports special triple backtick syntax. Wrap \`createString\` in triple backticks so you don't need to worry about escaping any backticks or quotes inside of it. You don't need to escape the triple backticks themselves.
- Use top level tags to identify which file to create. Anything outside of a top level tag is ignored. You can create multiple files in the same createString.
- Within the top level file tag, include the *entire* file content. Do not include comments like "... existing code ..." or "... rest of file ...".
- You don't need to create a \`magic.json\` file. It will be created for you.

Here's an example of creating an App with an \`index.js\` file. For brevity, the \`index.js\` file is truncated. When you create an App, include the entire file content:

~~~javascript
app.api.createApp("HelloWorld", "A simple hello world app", \`\`\`<index.js>
import React from "react";
// rest of index.js file...
</index.js>
\`\`\`);
~~~`);

  if (context) {
    api.push(`### app.api.updateFiles(updateString: string)

Update the App's files. Follow these instructions when generating the \`updateString\`:

- magicsandbox.Dev supports special triple backtick syntax. Wrap \`updateString\` in triple backticks so you don't need to worry about escaping any backticks or quotes inside of it. You don't need to escape the triple backticks themselves.
- Use top level tags to identify which file to update. Anything outside of a top level tag is ignored. If the file doesn't exist, it will be created. You can update multiple files in the same updateString.
- Within the top level file tag, you can use \`<find>\` and \`<replace>\` tags to update a portion of the file.
  - The content of the \`<find>\` tag must *exactly* match the existing file content, character for character, including whitespace and comments.
  - Only the first match in the file will be replaced. Include enough in the \`<find>\` tag to ensure it uniquely identifies the text you want to replace.
  - You can include multiple \`<find>\` and \`<replace>\` blocks within the same top level file tag.
  - You can't use \`<find>\` and \`<replace>\` tags when creating new files.
- If you don't use \`<find>\` and \`<replace>\` tags, the entire file will be replaced (or a new file will be created) with the content inside of the top level file tag.
  - Include the *entire* file content. Do not include comments like "... existing code ..." or "... rest of file ...".

Here's an example of updating \`index.js\` using \`<find>\` and \`<replace>\` tags:

~~~javascript
app.api.updateFiles(\`\`\`<index.js>
<find>
  return (
    <div className="flex h-screen items-center justify-center">
      Hello, world!
    </div>
  );
</find>
<replace>
  return (
    <div className="flex h-screen items-center justify-center font-bold">
      {\`Hello, \${name}!\`}
    </div>
  );
</replace>
</index.js>
\`\`\`);
~~~`);
  }

  if (summarizedContext) {
    api.push(`### app.api.additionalContext({ files: string[], code: string[] })

Logs additional context that you can reference in your next message.

Arguments:

- \`files\`: an array of file names to include in the context. For example: \`["utils.js"]\`
- \`code\`: an array of code snippets to search for and include in the context. For example, to see everywhere a config object is referenced: \`["config"]\``);
  }

  api.push(`### app.api.advancedDocs()

Logs advanced documentation that you can reference in your next message. The advanced documentation includes additional information on:

- The Magic Sandbox platform
- \`magic.json\` configuration
- magicsandbox.Dev FAQs`);

  return `## API

${api.join("\n\n")}`;
}

function instructionsPrompt({ context, summarizedContext }) {
  let instructions;
  const createAppInstructions = [
    "  - Set relevant values for `name` and `description` based on the user's request.",
    "  - Use `createString` to create `index.js`, `index.html`, `index.css`, or additional files as needed. Make sure to use the triple backtick syntax and the top level file tags.",
    `  - Unless the user requested otherwise or you feel it's inappropriate for the user's request, use \`index.js\` to create a React app and use Tailwind for styling. Use the example from the ${heading} section as a template. If using React and Tailwind, you likely can use the default values and don't need to create \`index.html\` or \`index.css\`.`,
    "  - Apply styling to make the app take up the full screen and look modern and clean.",
    "  - Use the data sandbox functions `requestPutData`, `requestGetData`, etc. to persist user data when appropriate.",
    "  - If the user requests a complex app, implement enough basic functionality to make the app useful. Then, after running your script, suggest some additional features the user may want to add.",
  ];
  if (!context) {
    //called from init
    instructions = [
      "- Use `app.api.createApp` to create a new App. When using `app.api.CreateApp`:",
      ...createAppInstructions,
    ];
  } else {
    instructions = [
      "- If the user is asking a question about how the code works, just answer it.",
      "- If the user is asking you to make a change, use `app.api.updateFiles`. When using `app.api.updateFiles`:",
      "  - Respect the user's existing libraries and code conventions.",
      "  - Make sure to use the triple backtick syntax and the top level file tags.",
      "  - Use <find> and <replace> tags to make small changes to large files. Otherwise, update the entire file. Ensure you're using the correct `updateString` syntax either way.",
      "- If the user is asking you to create a new App, use `app.api.createApp`. When using `app.api.createApp`:",
      ...createAppInstructions,
    ];
    if (summarizedContext) {
      instructions.push(
        "- Use `app.api.additionalContext` if the relevant file or snippet required to handle the user request is not included in the context.",
      );
    }
    instructions.push(
      "- Use `app.api.advancedDocs` if the user request requires more information about Magic Sandbox, `magic.json`, or magicsandbox.Dev than you have available.",
    );
    instructions.push(
      "- For the most part, the default values in `magic.json` are appropriate. If the user is asking about `magic.json` specifically or if you suspect the user's request could be solved by updating `magic.json`, first use `app.api.advancedDocs()` to review the complete documentation.",
    );
    instructions.push(
      "- The build process will resolve versions and update `dependencies` in `magic.json` for you. You don't need to set `dependencies` yourself unless you need a specific version.",
    );
  }
  return `## Instructions

${instructions.join("\n")}`;
}

export { prompt };
