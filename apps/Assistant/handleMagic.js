/* global requestFunction */

import { xmlParser } from "@magicsandbox.ai/streaming";

async function handleMagic({
  input,
  maxCost,
  assistant,
  messages, //this does not include the latest user message, which is `input`
}) {
  const sandboxId = assistant.sandboxRef.current.getSandboxId();
  let context, selection;
  if (!assistant.app) {
    context = "This is a blank page you can use to run scripts as needed.";
  } else {
    try {
      ({ context, selection } =
        await assistant.sandboxRef.current.postMessageAndWaitForResponse({
          request: "context",
        }));
    } catch {
      context = "App did not provide context";
    }
  }
  const llmMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((message, i) => {
      if (i % 2 === 0) {
        return {
          role: "user",
          content: `<user_request>
${message}
</user_request>`,
        };
      } else {
        return { role: "assistant", content: message };
      }
    }),
    { role: "user", content: createFinalMessage(input, context, selection) },
  ];
  console.log(llmMessages);
  const stream = await requestFunction(
    "magicsandbox.llm",
    {
      messages: llmMessages,
    },
    {
      maxCost,
      stream: true,
    },
  );
  let message = "";
  let script = "";
  let prevTag;
  for await (const { content, tag } of xmlParser({
    stream,
    chunkProcessor: (chunk) => chunk.result,
  })) {
    if (tag === "magic_script") {
      if (tag !== prevTag) {
        message += "~~~magicscript\n";
      }
      script += content;
    } else if (prevTag === "magic_script") {
      message += "\n~~~";
    }
    prevTag = tag;
    message += content;
    assistant.setMessage(message);
  }
  if (script) {
    assistant.sandboxRef.current.postMessage(sandboxId, {
      script: `(async () => {
${script}
})();

if (typeof app !== 'undefined' && app?.render) {
  try {
    app.render();
  } catch (error) {
    console.error(error);
  }
}`,
    });
  }
}

const systemPrompt = `You are a user's assistant on a platform called Magic Sandbox. The user is interacting with a web app and is asking for your help.

In your response, you can:

1. Respond directly to the user
2. Execute a script to update the app
3. Or both

To execute a script, enclose it in <magic_script> tags. Anything outside of <magic_script> tags will be displayed to the user in a chat interface:

<example_assistant_response>
This text will be displayed to the user in a chat interface.
<magic_script>
console.log('this code will be executed in the app');
</magic_script>
Additional text to display to the user if needed.
</example_assistant_response>

You should execute a script only if it's clear that the user is expecting you to update the app. Otherwise, if you think providing a code sample in your response would be helpful, include it in your response without a <magic_script> tag and ask the user if they'd like you to execute it.

Your script runs in an async IIFE, so you can use \`await\` as needed. Any variables you create are not available in the global scope, so you don't have access to any variables you might have created in a previous message's script.

Magic Sandbox executes apps in a sandboxed iframe, so your script does not have network access, access to storage APIs, or permission to use browser features like creating popups or downloading files.

Each message from the user will include the user's request in a <user_request> tag.

The user's final message will include additional context:

1. Context provided by the app in an <app_context> tag
2. Text highlighted by the user within the app (if any) in a <user_highlighted_text> tag

The <app_context> may detail the app's API, which you can access in your script using the global object \`app.api\`. Your script can directly manipulate the DOM as needed, but you should prefer using \`app.api\` to fulfill the <user_request> when possible. If an app instructs you to only use the API, you should follow that instruction. If you can't solve the user's request using the API, apologize to the user, explain that you can't do that, and suggest any relevant alternatives.

The <user_highlighted_text> may not be relevant, so you should give precedence to the <user_request> and the <app_context>. If the <user_request> is vague (e.g. "help me understand this"), you should focus on the <user_highlighted_text> when responding.`;

function createFinalMessage(input, context, selection) {
  let selectionPrompt = "";

  if (selection && selection.length < 1000) {
    selectionPrompt = `\n\n<user_highlighted_text>
${selection}
</user_highlighted_text>`;
  }

  return `<user_request>
${input}
</user_request>
<app_context>
${context.slice(0, 50000)}
</app_context>${selectionPrompt}`;
}

export { handleMagic };

//todo sandbox functions. how to avoid duplicating docs?
//esbuild? structured output? tailwind?
//encourage chain of thought?
//multiple steps?
