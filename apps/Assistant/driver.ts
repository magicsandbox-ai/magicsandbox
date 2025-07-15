import {
  driver,
  type DriveStep,
  type State as DriverState,
  type Driver,
} from "driver.js";
import { createWelcomeConversation } from "./welcomeMessage.ts";
import type { AssistantRef } from "./AssistantState.ts";

const welcomeConversation = createWelcomeConversation();

const popoverOffset = 10;
const popoverArrowOffset = 20;

class Step {
  driveStep: DriveStep;
  setup?: () => Promise<void>;
  cleanup?: () => Promise<void>;
  constructor({
    driveStep,
    setup,
    cleanup,
  }: {
    driveStep: DriveStep;
    setup?: () => Promise<void>;
    cleanup?: () => Promise<void>;
  }) {
    this.driveStep = driveStep;
    this.setup = setup;
    this.cleanup = cleanup;
  }
}

function createDriver(
  assistantRef: AssistantRef,
  onStateChange?: (state: DriverState) => void,
) {
  const steps: Step[] = [
    new Step({
      driveStep: {
        element: ".assistant-message",
        disableActiveInteraction: true,
        popover: {
          title: "Get Started",
          description: "Click Next to respond to your assistant.",
        },
      },
      setup: async () => {
        assistantRef.reload();
        assistantRef.handleSwitchConversation(
          welcomeConversation.conversationId,
        );
        assistantRef.handleUpdateConversation({
          conversationId: welcomeConversation.conversationId,
          messages: [...welcomeConversation.messages],
        });
      },
      cleanup: async () => {
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
        await assistantRef.handleInput({
          input,
          messages: welcomeConversation.messages,
          mockContent: "Hello from the assistant!",
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        assistantRef.reload();
        config.stagePadding = 10;
      },
    }),
    new Step({
      driveStep: {
        element: "#discover-button",
        disableActiveInteraction: true,
        popover: {
          title: "Discover Apps",
          description: `Anyone can create a Magic Sandbox app. Discover apps created by the community here.`,
        },
      },
      setup: async () => {
        await waitForElement("#discover-button"); //I think it takes a frame for this to appear when assistantRef.current.reload is called
      },
    }),
    new Step({
      driveStep: {
        element: "#app-list",
        disableActiveInteraction: true,
        popover: {
          title: "Your Favorited Apps",
          description: `Open or manage your favorited apps here. We've favorited a few apps for you to help you get started.

Your assistant can open your favorited apps during a chat, so you can say things like "add this to my recipes folder", "build me a retirement planner spreadsheet", or "build me a snake game", and your assistant will open the appropriate app and help you accomplish your task.`,
          align: "end",
        },
      },
    }),
    new Step({
      driveStep: {
        element: "#model-picker-container",
        popover: {
          title: "Select a Model",
          description: `Use the dropdown to select your favorite AI model, or leave it on Auto and we'll pick one for you based on your account balance.

Upgrade to Magic Sandbox Plus to unlock more usage of the smartest models.`,
        },
      },
      setup: async () => {
        await handleMenu(true, driverObj, assistantRef);
      },
      cleanup: async () => {
        await handleMenu(false, driverObj, assistantRef);
      },
    }),
    new Step({
      driveStep: {
        element: "#driver-help",
        popover: {
          title: "Learn More",
          description: `Learn more about how Magic Sandbox works and watch the demo video to get ideas on what to do next.

Write code? Check out the docs to learn how to create your own Magic Sandbox app—it's free, and you earn money when others use it!`,
          align: "center",
        },
      },
      setup: async () => {
        const config = driverObj.getConfig();
        config.stagePadding = 0;
        addInvisibleElement("driver-help", {
          top: 0,
          right: 56 - popoverOffset - popoverArrowOffset,
        });
      },
      cleanup: async () => {
        document.getElementById("driver-help")?.remove();
        const config = driverObj.getConfig();
        config.stagePadding = 10;
      },
    }),
    new Step({
      driveStep: {
        element: ".chat-button",
        popover: {
          title: "Chat History",
          description: `View your chat history here. To go through this tutorial again, open the "Welcome to Magic Sandbox!" chat.`,
        },
      },
      setup: async () => {
        await handleMenu(true, driverObj, assistantRef);
      },
      cleanup: async () => {
        await handleMenu(false, driverObj, assistantRef);
      },
    }),
  ];
  const driverObj = driver({
    overlayClickBehavior: "nextStep",
    showButtons: ["next", "previous", "close"],
    showProgress: true,
    popoverOffset,
    onNextClick: async (_element, _step, { state }) => {
      const currentStep = steps[state.activeIndex!];
      const nextStep = steps[state.activeIndex! + 1];
      await currentStep?.cleanup?.();
      await nextStep?.setup?.();
      driverObj.moveNext();
      onStateChange?.(driverObj.getState());
    },
    onPrevClick: async (_element, _step, { state }) => {
      const currentStep = steps[state.activeIndex!];
      const prevStep = steps[state.activeIndex! - 1];
      await currentStep?.cleanup?.();
      await prevStep?.setup?.();
      driverObj.movePrevious();
      onStateChange?.(driverObj.getState());
    },
    onCloseClick: async () => {
      driverObj.destroy();
      onStateChange?.({});
    },
    steps: steps.map((step) => step.driveStep),
  });
  const originalDrive = driverObj.drive.bind(driverObj);
  driverObj.drive = async (stepIndex?: number) => {
    const firstStep = steps[stepIndex ?? 0];
    await firstStep?.setup?.();
    originalDrive(stepIndex);
    onStateChange?.(driverObj.getState());
  };
  return driverObj;
}

async function addTextToTextArea(text: string, textArea: HTMLTextAreaElement) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (let i = 0; i < text.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    textArea.value += text[i];
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function waitForElement(selector: string, wait = 16, maxRetries = 6) {
  //could throw an error if maxRetries is reached, but better for the tour to go on
  //driver.js just puts the popover in the middle of the page if it can't find the element
  if (maxRetries === 0 || document.querySelector(selector)) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, wait));
  return waitForElement(selector, wait * 2, maxRetries - 1);
}

async function handleMenu(
  show: boolean,
  driverObj: Driver,
  assistantRef: AssistantRef,
) {
  if (window.innerWidth < 768) {
    driverObj.highlight({
      element: "#menu-button",
      disableActiveInteraction: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 750));
    assistantRef.setShowChatHistory(show);
  }
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

export { createDriver, mockLlm };
