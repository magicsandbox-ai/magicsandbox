import { driver } from "driver.js";
import type { AssistantRefObject } from "./AssistantState.ts";

function startDriver(assistantRef: AssistantRefObject) {
  const driverObj = driver({
    allowClose: false,
    showProgress: true,
    showButtons: ["next"],
    steps: [
      {
        element: ".assistant-message",
        disableActiveInteraction: true,
        popover: {
          description: "Click Next to respond to your assistant",
          side: "bottom",
          onNextClick: async () => {
            driverObj.highlight({
              element: "#chat-input",
              disableActiveInteraction: true,
            });
            const input = "Hello, world!";
            await addTextToTextArea(
              input,
              document.getElementById("chat-input") as HTMLTextAreaElement,
            );
            driverObj.highlight({
              element: "#main-container",
              disableActiveInteraction: true,
            });
            assistantRef.current.handleInput({
              input,
              mockContent: "Hello from the assistant!",
            });
          },
        },
      },
    ],
  });
  driverObj.drive();
}

async function addTextToTextArea(text: string, textArea: HTMLTextAreaElement) {
  for (let i = 0; i < text.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    textArea.value += text[i];
  }
}

async function* mockLlm(model: string, content: string) {
  await new Promise((resolve) => setTimeout(resolve, 200)); //simulate network latency
  const tokens = getTokens(content);
  for (let i = 0; i < tokens.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10)); //simulate token speed
    if (i === 0) {
      yield {
        result: {
          model,
          content: tokens[i],
          index: 0,
        },
      };
    } else if (i === tokens.length - 1) {
      yield {
        result: {
          content: tokens[i],
          finish_reason: "stop",
          // tokens are not used - better to not include them
          // usage: {
          //   prompt_tokens: 10,
          //   completion_tokens: 10,
          // },
          index: 0,
        },
      };
    } else {
      yield {
        result: {
          content: tokens[i],
          index: 0,
        },
      };
    }
  }
}

function getTokens(content: string) {
  const tokens = [];
  let buffer = "";
  for (let i = 0; i < content.length; i++) {
    buffer += content[i];
    if (content[i] === " " && buffer.length >= 5) {
      tokens.push(buffer);
      buffer = "";
    }
  }
  if (buffer) {
    tokens.push(buffer);
  }
  return tokens;
}

export { startDriver, mockLlm };
