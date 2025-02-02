import { tagStreamParser } from "@magicsandbox.ai/streaming";
import sandboxDocs from "../Docs/sandbox.md";

async function handleMagic({ maxCost, assistant, input, messages }) {
  const sandboxId = assistant.sandboxRef.current.getSandboxId();
  const prevMessage = messages[messages.length - 1];
  let newMessages;
  if (prevMessage?.role === "user") {
    //we've already created a message with the logs, so append the user input
    //we may not have input if the previous message had an intermediate_script, so handle that too
    newMessages = [
      ...messages.slice(0, -1),
      {
        role: "user",
        content: input
          ? `${prevMessage.content}\n${formatInput(input)}`
          : prevMessage.content,
        displayContent: input,
      },
    ];
  } else {
    if (!input) {
      throw new Error("Invalid handleMagic call");
    }
    newMessages = [
      ...messages,
      {
        role: "user",
        content: formatInput(input),
        displayContent: input,
      },
    ];
  }
  newMessages.push({
    role: "assistant",
    displayContent: "Working on it...",
  });
  assistant.setMessages(newMessages);
  let context, selection;
  if (!assistant.app) {
    context = "This is a blank page you can use to run scripts as needed.";
  } else {
    try {
      ({ context, selection } =
        await assistant.sandboxRef.current.postMessageAndWaitForResponse(
          sandboxId,
          { request: "context" },
          10000,
        ));
    } catch {
      context = "App did not provide context";
    }
  }
  const llmMessages = newMessages
    .filter((message) => message.content)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
  llmMessages[llmMessages.length - 1].content += formatContext(
    context,
    selection,
  );
  llmMessages.unshift({ role: "system", content: systemPrompt });
  const stream = await requestFunction(
    "magicsandbox.llm",
    { messages: llmMessages },
    { maxCost, stream: true },
  );
  let intermediateScript = false;
  let message = "";
  let script = "";
  let prevTag;
  for await (const { content, tag } of tagStreamParser({
    stream,
    chunkProcessor: (chunk) => chunk.result,
  })) {
    if (tag === "intermediate_script") {
      intermediateScript = true;
    }
    if (tag === "final_script" || tag === "intermediate_script") {
      if (tag !== prevTag) {
        message += `~~~magicscript${content.startsWith("\n") ? "" : "\n"}`;
      }
      script += content;
    } else if (
      prevTag === "final_script" ||
      prevTag === "intermediate_script"
    ) {
      message += `${script.endsWith("\n") ? "" : "\n"}~~~`;
    }
    prevTag = tag;
    message += content;
    assistant.setMessages((messages) => {
      return [
        ...messages.slice(0, -1),
        { role: "assistant", content: message, displayContent: message },
      ];
    });
  }
  if (script) {
    const { logs } =
      await assistant.sandboxRef.current.postMessageAndWaitForResponse(
        sandboxId,
        { request: "script", data: { script } },
        30000,
      );
    assistant.setMessages((messages) => {
      return [...messages, { role: "user", content: formatLogs(logs) }];
    });
  }
  return { intermediateScript };
}

function formatInput(input) {
  return `<user_request>
${input}
</user_request>`;
}

function formatLogs(logs) {
  let formattedLogs = "";
  let length = 0;
  for (const log of logs) {
    if (length + log.length > 10000) {
      formattedLogs += `${log.slice(0, 10000 - length)}...\n...`;
      break;
    } else if (log.length > 1000) {
      formattedLogs += `${log.slice(0, 1000)}...\n`;
      length += 1000;
    } else {
      formattedLogs += `${log}\n`;
      length += log.length;
    }
  }
  return `<logs>
${formattedLogs}
</logs>`;
}

function formatContext(context, selection) {
  let selectionPrompt = "";
  if (selection && selection.length < 1000) {
    selectionPrompt = `\n\n<user_highlighted_text>
${selection}
</user_highlighted_text>`;
  }
  return `\n<app_context>
${context}
</app_context>${selectionPrompt}`;
}

const systemPrompt = `You are a user's assistant on a platform called Magic Sandbox. The user is interacting with a web app and is asking for your help.

In your response, you can:

1. Respond directly to the user
2. Execute a script to update the app
3. Or both

Only execute a script if it's clear that the user is expecting you to update the app. If you're not sure, explain to the user your plan to update the app and ask them if they'd like you to execute it.

To execute a script, enclose it in either <final_script> or <intermediate_script> tags. Anything outside of these tags will be displayed to the user in a chat interface:

<example_assistant_message>
This text will be displayed to the user in a chat interface.
<final_script>
console.log('This code will be executed in the app');
</final_script>
Additional text to display to the user if needed.
</example_assistant_message>

Your scripts run in an async function, so you can use top level \`await\` as needed. By default, any variables you create are not available in the global scope. If you need to share variables between messages, assign them to the global object \`app.assistant\`.

Any logs or errors from your script will be included in the user's next message in <logs> tags. Anything you log will be coerced to a string, so you should convert objects to an appropriate string representation before logging them. Logs may be truncated with "..." if they're too long. The actual request from the user will be included in <user_request> tags:

<example_user_message>
<logs>
[log] This is an example of a console.log message.
[error] This is an example of a console.error message.
[Uncaught Error] Error: This is an example of an uncaught error message.
    at <anonymous>:1:1
</logs>
<user_request>
This is an example of a user request.
</user_request>
</example_user_message>

You can use <intermediate_script> tags if you need multiple scripts to fulfill the <user_request>. The general pattern is to run an <intermediate_script> to gather additional context, then run a <final_script> to fulfill the <user_request>. After each <intermediate_script>, the user will be prompted to allow you to continue. Only use <intermediate_script> tags if you can't fulfill the <user_request> with a single script.

Before using <intermediate_script> tags, explain to the user your plan and why you first need to gather additional context. For example, if the user asks for your help migrating their data from magicsandbox.ExampleApp:

<example_assistant_message>
To help you migrate your data from magicsandbox.ExampleApp, first I'll need to look at how the data is structured.
<intermediate_script>
app.assistant.exampleAppData = await requestGetAllData('magicsandbox.ExampleApp');
console.log(JSON.stringify(app.assistant.exampleAppData, null, 2));
</intermediate_script>
</example_assistant_message>

The user's final message will include additional context:

1. Context provided by the app in an <app_context> tag
2. Text highlighted by the user within the app (if any) in a <user_highlighted_text> tag

The <app_context> may detail the app's API, which you can access in your script using the global object \`app.api\`. Your script can directly manipulate the DOM as needed, but you should prefer using \`app.api\` to fulfill the <user_request> when possible. Manipulating the DOM could break the app, so you should only do it if you're confident it will work. If you can't fulfill the <user_request>, apologize to the user, explain that you can't do that, and suggest any relevant alternatives.

The <user_highlighted_text> may not be relevant, so you should give precedence to the <user_request> and the <app_context>. If the <user_request> is vague (e.g. "help me understand this"), you should focus on the <user_highlighted_text> when responding.

The Magic Sandbox platform is made up of Apps (frontend) and Functions (backend). Both Apps and Functions follow the naming convention author.name@version. For Apps, the first letter of the name must be uppercase, e.g. magicsandbox.ExampleApp@0.1.0. For Functions, the first letter of the name must be lowercase, e.g. magicsandbox.exampleFunction@0.1.0. Apps and Functions can also be referred to using just author.name, which will resolve to the latest published version.

Magic Sandbox executes Apps in a sandbox. The restrictions and capabilities of the Sandbox are documented below:

${sandboxDocs}
`;

export { handleMagic };
