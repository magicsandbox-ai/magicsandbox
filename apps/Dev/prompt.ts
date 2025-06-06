//@ts-ignore
import docs from "@magicsandbox.ai/docs/docs.md";
import { getHeadings } from "@magicsandbox.ai/docs";
import type { DevState } from "./DevState.ts";

const heading = "Making your App Magic";

/*
todos:
- instructions on calling findFunction
*/

type PromptArgs = {
  devState?: DevState;
  context?: string;
  summarizedContext?: boolean;
};

let buttonsPrompt: string;
if (window.innerWidth > 768) {
  buttonsPrompt = `- "Update Preview": updates the preview window and saves the files. The user can also use Ctrl+S to trigger this.
  - "Preview Mobile/Tablet/Desktop": resize the preview window to preview the App on different devices.
  - "Download Files": downloads the App's files.
  - "Publish App": publishes the App to the Magic Sandbox platform.
  - "Test App API": toggles API test mode. By default, when the user chats with you, you receive context from magicsandbox.Dev and help the user develop their App. In API test mode, you receive context from the app being developed and help the user test the App's API.`;
} else {
  buttonsPrompt = `- "Show Preview/Show Code": toggle between the preview window and the code editor. Clicking "Show Preview" updates the preview window and saves the files.
  - "Publish App": publishes the App to the Magic Sandbox platform.
  - "Test App API": toggles API test mode. By default, when the user chats with you, you receive context from magicsandbox.Dev and help the user develop their App. In API test mode, you receive context from the app being developed and help the user test the App's API.`;
}

function prompt({ devState, context, summarizedContext }: PromptArgs = {}) {
  const sections = [];
  sections.push(`# magicsandbox.Dev

magicsandbox.Dev enables developing, previewing, and publishing Magic Sandbox Apps in the browser.

The main user interface includes a code editor and a preview window. The user has the following buttons available at the top of the page, from left to right:

${buttonsPrompt}

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

  sections.push(getHeadings(docs, [heading]) as string); //todo
  sections.push(contextPrompt({ devState, context, summarizedContext }));
  sections.push(apiPrompt({ context, summarizedContext }));
  sections.push(instructionsPrompt({ context, summarizedContext }));
  return sections
    .filter((section) => section.trim() !== "")
    .map((section) => section.trim())
    .join("\n\n");
}

function contextPrompt({ devState, context, summarizedContext }: PromptArgs) {
  if (!context) return "";
  const contextSections = [];

  if (summarizedContext) {
    contextSections.push(
      `The user is editing the below files. For brevity, files may be excluded (indicated by "...") or summarized. When summarized, individual blocks of code may be truncated (indicated by "...").`,
    );
  } else {
    contextSections.push(`The user is editing the below files.`);
  }

  contextSections.push(context);

  if (devState?.debugContext?.buildError) {
    contextSections.push(
      "The most recent build failed with the following error:",
    );
    contextSections.push(devState.debugContext.buildError);
    if (devState.debugContext.codeChanged) {
      contextSections.push(
        "Note: The code has been modified since this build. The error may no longer be relevant.",
      );
    }
  } else if (devState?.debugContext?.previewLogs) {
    contextSections.push(
      "The most recent build produced the following logs in the preview window:",
    );
    contextSections.push(devState.debugContext.previewLogs);
    contextSections.push(
      "Note: These logs only capture output from the initial script execution. Any logs from subsequent code execution (like event handlers) are not captured. If the user is asking for your help debugging something like an event handler, you may need to ask them to share the logs with you.",
    );
    if (devState.debugContext.codeChanged) {
      contextSections.push(
        "Note: The code has been modified since these logs were captured. They may no longer reflect the current behavior.",
      );
    }
  }

  return `## Context

${contextSections.join("\n\n")}`;
}

function apiPrompt({ context, summarizedContext }: PromptArgs) {
  const api = [];

  api.push(`### app.api.createApp(name: string, description: string, createString: string): Promise<void>

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
await app.api.createApp("HelloWorld", "A simple hello world app", \`\`\`<index.js>
import React from "react";
// rest of index.js file...
</index.js>
\`\`\`);
~~~`);

  if (context) {
    api.push(`### app.api.updateFiles(updateString: string): Promise<void>

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
await app.api.updateFiles(\`\`\`<index.js>
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
    api.push(`### app.api.additionalContext({ files?: string[], code?: string[] }): Promise<void>

Logs additional context that you can reference in your next message.

Arguments:

- \`files\`: an array of file names to include in the context. For example: \`["utils.js"]\`
- \`code\`: an array of code snippets to search for and include in the context. For example, to see everywhere a config object is referenced: \`["config"]\``);
  }

  api.push(`### app.api.advancedDocs(): void

Logs advanced documentation that you can reference in your next message. The advanced documentation includes additional information on:

- The Magic Sandbox platform
- \`magic.json\` configuration
- magicsandbox.Dev FAQs`);

  return `## API

${api.join("\n\n")}`;
}

function instructionsPrompt({ context, summarizedContext }: PromptArgs) {
  let instructions;
  const createAppInstructions = [
    "  - Set relevant values for `name` and `description` based on the user's request.",
    "  - Use `createString` to create `index.js`, `index.html`, `index.css`, or additional files as needed. Make sure to use the triple backtick syntax and the top level file tags. Do not escape strings within the triple backticks - if you do, the backslashes will be interpreted as literal characters and likely break your code.",
    `  - Unless the user requested otherwise or you feel it's inappropriate for the user's request, use \`index.js\` to create a React app and use Tailwind for styling. Use the example from the ${heading} section as a template. If using React and Tailwind, you likely can use the default values and don't need to create \`index.html\` or \`index.css\`.`,
    "  - Don't implement the app's context or API yet. The user may be experimenting, or just want a one off tool. Once the app is more mature, you can implement the context and API.",
    "  - Apply styling to make the app responsive and take up the full screen. It should look modern and clean on all devices.",
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
      "  - Make sure to use the triple backtick syntax and the top level file tags. Do not escape strings within the triple backticks - if you do, the backslashes will be interpreted as literal characters and likely break your code.",
      "  - Use <find> and <replace> tags to make small changes to large files. Otherwise, update the entire file. Ensure you're using the correct `updateString` syntax either way.",
      "- If the user is asking you to create a new App, use `app.api.createApp`. When using `app.api.createApp`:",
      ...createAppInstructions,
    ];
    if (summarizedContext) {
      instructions.push(
        "- Use `app.api.additionalContext` if the relevant file or snippet required to handle the user request is not included in the context.",
      );
    }
    let asyncApi;
    if (summarizedContext) {
      asyncApi =
        "`app.api.createApp`, `app.api.updateFiles`, and `app.api.additionalContext` are";
    } else if (context) {
      asyncApi = "`app.api.createApp` and `app.api.updateFiles` are";
    } else {
      asyncApi = "`app.api.createApp` is";
    }
    instructions.push(
      `- ${asyncApi} async. Make sure you use \`await\` so that the relevant logs are captured and available to you in your next message.`,
    );
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
