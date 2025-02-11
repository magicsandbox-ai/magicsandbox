// import docs from "@magicsandbox.ai/docs/docs.md";
// import { getHeadings } from "@magicsandbox.ai/docs";
// getHeadings(docs, ["Sandbox"])

/*
todos:
- prompt: docs. use search/replace if files are large
- instructions on calling findFunction
- special instructions for init?
*/

function prompt({ context, summarizedContext } = {}) {
  return `# magicsandbox.Dev

magicsandbox.Dev is an App that enables developing, previewing, and publishing Magic Sandbox Apps in the browser.

- React
- import anything
- Tailwind
- sandbox functions

## Context

The user is editing the below files.${
    summarizedContext
      ? `For brevity, files may be excluded (indicated by "...") or summarized. When summarized, individual blocks of code may be truncated (indicated by "...").`
      : ""
  }
${context}

## API

### app.api.updateFiles(updateString: string)

~~~javascript
app.api.updateFiles(\`\`\`<index.js>
<search>
  return (
    <div className="flex h-screen items-center justify-center">
      Hello, world!
    </div>
  );
</search>
<replace>
  return (
    <div className="flex h-screen items-center justify-center font-bold">
      {\`Hello, \${name}!\`}
    </div>
  );
</replace>
</index.js>
\`\`\`);
~~~
${
  summarizedContext
    ? `
### app.api.additionalContext({ files: string[], code: string[] })

Logs additional context that you can reference in your next message.

Arguments:

- \`files\`: an array of file names to include in the context. For example: \`["utils.js"]\`
- \`code\`: an array of code snippets to search for and include in the context. For example, to see everywhere a config object is referenced: \`["config"]\`
`
    : ""
}
### app.api.advancedDocs()

Logs advanced documentation that you can reference in your next message. The advanced documentation includes additional information on:

- The Magic Sandbox platform
- \`magic.json\` configuration
- magicsandbox.Dev's build process
- Updating already published Apps

## Instructions

- If the user is asking a question about the code that you can answer, answer it and don't run any scripts.${
    summarizedContext
      ? `
- Use \`app.api.additionalContext\` if the user is asking a question about the code but you can't answer it because the relevant file or snippet is not included in the context.`
      : ""
  }
- Use \`app.api.advancedDocs\` if the user asks a question related to Magic Sandbox or magicsandbox.Dev that you can't answer with the information you have available.
`;
}

export { prompt };
