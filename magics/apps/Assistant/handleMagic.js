/* global requestFunction */

async function handleMagic({
  input,
  maxCost,
  assistant,
  messages, //this does not include the latest user message, which is `input`
}) {
  const sandboxId = assistant.sandboxRef.current.getSandboxId();
  let context, selection;
  if (!assistant.context.app) {
    context = 'This is a blank page you can use to run scripts as needed.';
  } else {
    try {
      ({ context, selection } =
        await assistant.sandboxRef.current.postMessageAndWaitForResponse({
          request: 'context',
        }));
    } catch (error) {
      context = 'App did not provide context';
    }
  }
  const llmMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((message, i) => {
      if (i % 2 === 0) {
        return {
          role: 'user',
          content: `<user_request>
${message}
</user_request>`,
        };
      } else {
        return { role: 'assistant', content: message };
      }
    }),
    { role: 'user', content: createFinalMessage(input, context, selection) },
  ];
  console.log(llmMessages);
  const stream = await requestFunction(
    'magicsandbox.llm',
    {
      messages: llmMessages,
    },
    {
      maxCost,
      stream: true,
    }
  );
  const { response, script } = await parseStream(stream, assistant.setMessage);
  console.log(response);
  if (script) {
    assistant.sandboxRef.current.postMessage(sandboxId, {
      script: `${script};

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

async function parseStream(stream, setMessage) {
  let response = ''; //todo delete only for debugging
  let buffer = ''; //tags may be split across chunks
  const startTag = '<magic_script>';
  const endTag = '</magic_script>';
  let message = '';
  let inScript = false;
  let script = '';
  for await (const chunk of stream) {
    if (chunk.result) {
      response += chunk.result;
      buffer += chunk.result;
      ({ buffer, message, script, inScript } = processBuffer({
        buffer,
        message,
        script,
        startTag,
        endTag,
        bufferLength: endTag.length - 1, //maintain this much buffer to handle tags split across chunks
        inScript,
        setMessage,
      }));
    }
  }
  ({ script } = processBuffer({
    buffer,
    message,
    script,
    startTag,
    endTag,
    bufferLength: 0, //now we're done, so process any remaining buffer
    inScript,
    setMessage,
  }));
  return { response, script };
}

function processBuffer({
  buffer,
  message,
  script,
  startTag,
  endTag,
  bufferLength,
  inScript,
  setMessage,
}) {
  let i = 0;
  while (buffer.length > bufferLength) {
    const startIndex = buffer.indexOf(startTag, i);
    const endIndex = buffer.indexOf(endTag, i);
    i = Math.min(
      startIndex === -1 ? Infinity : startIndex,
      endIndex === -1 ? Infinity : endIndex
    );
    let result;
    if (i === Infinity) {
      result = bufferLength > 0 ? buffer.slice(0, -bufferLength) : buffer;
      buffer = bufferLength > 0 ? buffer.slice(-bufferLength) : '';
    } else {
      result = buffer.slice(0, i);
      buffer = buffer.slice(
        i + (startIndex === i ? startTag.length : endTag.length)
      );
    }
    if (inScript) {
      script += result;
    }
    message += result;
    if (startIndex === i) {
      inScript = true;
      message += '~~~magicscript\n';
    } else if (endIndex === i) {
      inScript = false;
      message += '\n~~~';
    }
  }
  setMessage(message);
  return { buffer, message, script, inScript };
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

Each message from the user will include the user's request in a <user_request> tag.

The user's final message will include additional context:

1. Context provided by the app in an <app_context> tag
2. Text highlighted by the user within the app (if any) in a <user_highlighted_text> tag

The <app_context> may detail the app's API, which you can access in your script using the global object \`app.api\`. Your script can directly manipulate the DOM as needed, but you should prefer using \`app.api\` to fulfill the <user_request> when possible.

The <user_highlighted_text> may not be relevant, so you should give precedence to the <user_request> and the <app_context>. If the <user_request> is vague (e.g. "help me understand this"), you can primarily focus on the <user_highlighted_text> when responding.

Magic Sandbox executes apps in a sandboxed iframe, so your script does not have network access, access to storage APIs, or permission to use browser features like creating popups or downloading files.`;

function createFinalMessage(input, context, selection) {
  let selectionPrompt = '';

  if (selection && selection.length < 1000) {
    selectionPrompt = `\n\n<user_highlighted_text>
${selection}
</user_highlighted_text>`;
  }

  return `<user_request>
${input}
</user_request>
<app_context>
${context}
</app_context>${selectionPrompt}`;
}

export { handleMagic };

//todo sandbox functions. how to avoid duplicating docs?
//esbuild? structured output? tailwind?
//encourage chain of thought?
//multiple steps?
