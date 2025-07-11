import { driver } from "driver.js";
import type { AssistantRefObject } from "./AssistantState.ts";

function startDriver(assistantRef: AssistantRefObject) {
  const popoverOffset = 10;
  const popoverArrowOffset = 20;
  const driverObj = driver({
    allowClose: false,
    showProgress: true,
    showButtons: ["next"],
    popoverOffset,
    steps: [
      {
        element: ".assistant-message",
        disableActiveInteraction: true,
        popover: {
          description: "Click Next to respond to your assistant",
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
            //this isn't really documented so it's probably a bad idea
            //but it's the only way to change stagePadding during the tour - ideally it would be configurable at the step level
            const config = driverObj.getConfig();
            config.stagePadding = 0;
            driverObj.highlight({
              element: "#main-container",
              disableActiveInteraction: true,
            });
            await new Promise((resolve) => setTimeout(resolve, 500));
            await assistantRef.current.handleInput({
              input,
              mockContent: "Hello from the assistant!",
            });
            await new Promise((resolve) => setTimeout(resolve, 500));
            assistantRef.current.reload();
            config.stagePadding = 10;
            driverObj.moveNext();
          },
        },
      },
      {
        element: "#model-picker-container",
        popover: {
          title: "Select a Model",
          description: `Use the dropdown to select your favorite AI model, or leave it on Auto and we'll pick one for you based on your account balance
          
Upgrade to Magic Sandbox Plus for more usage of the smartest models`,
          onNextClick: async () => {
            const config = driverObj.getConfig();
            config.stagePadding = 0;
            addInvisibleElement("driver-help", {
              top: 0,
              right: 56 - popoverOffset - popoverArrowOffset,
            });
            driverObj.moveNext();
          },
        },
      },
      {
        element: "#driver-help",
        popover: {
          title: "Learn More",
          description: `Learn more about how Magic Sandbox works and watch the demo video to get ideas on what to do next
          
Write code? Check out the docs to learn how to create your own Magic Sandbox app (it's free, and you earn money when others use it!)`,
          align: "center",
          onNextClick: async () => {
            document.getElementById("driver-help")?.remove();
            driverObj.moveNext();
          },
        },
      },
    ],
  });
  driverObj.drive();
}

async function addTextToTextArea(text: string, textArea: HTMLTextAreaElement) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (let i = 0; i < text.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    textArea.value += text[i];
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

function addInvisibleElement(
  id: string,
  style: { top?: number; bottom?: number; left?: number; right?: number },
) {
  if (document.getElementById(id)) {
    console.error("Invisible element already exists", id);
    return;
  }
  const element = document.createElement("div");
  element.id = id;
  element.style.position = "fixed";
  if ("top" in style) {
    element.style.top = `${style.top}px`;
  }
  if ("bottom" in style) {
    element.style.bottom = `${style.bottom}px`;
  }
  if ("left" in style) {
    element.style.left = `${style.left}px`;
  }
  if ("right" in style) {
    element.style.right = `${style.right}px`;
  }
  document.body.appendChild(element);
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
