import {
  driver,
  type DriveStep,
  type State as DriverState,
  type Driver,
} from "driver.js";
import { createWelcomeConversation } from "./welcomeMessage.ts";
import type { AssistantRef } from "./AssistantState.ts";

// window._TESTING = { testTutorial: true };

const welcomeConversation = createWelcomeConversation();

const popoverOffset = 10;
const popoverArrowOffset = 20;
const defaultStagePadding = 10; //steps can override this, but should set it back in cleanup

class Step {
  driveStep: DriveStep;
  setup?: () => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
  constructor({
    driveStep,
    setup,
    cleanup,
  }: {
    driveStep: DriveStep;
    setup?: () => Promise<void> | void;
    cleanup?: () => Promise<void> | void;
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
        popover: {
          title: "Get Started",
          description: "Click Next to respond to your assistant.",
          showButtons: ["next"],
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
        await handleInput({
          input: "Can you give me a recipe for chocolate chip cookies?",
          mockContent: [
            `Here's a classic chocolate chip cookie recipe that's perfect for any occasion:

## Classic Chocolate Chip Cookies

### Ingredients:
- 2¼ cups all-purpose flour
- 1 tsp baking soda
- 1 tsp salt
- 1 cup butter, softened
- ¾ cup granulated sugar
- ¾ cup packed brown sugar
- 2 large eggs
- 2 tsp vanilla extract
- 2 cups chocolate chips

### Instructions:
1. Preheat oven to 375°F (190°C)
2. Mix flour, baking soda, and salt in a bowl
3. In a separate large bowl, beat butter and both sugars until creamy
4. Beat in eggs and vanilla extract
5. Gradually blend in flour mixture
6. Stir in chocolate chips
7. Drop rounded tablespoons of dough onto ungreased cookie sheets
8. Bake 9-11 minutes or until golden brown
9. Cool on baking sheet for 2 minutes, then transfer to wire rack

Makes about 48 cookies. Enjoy!`,
          ],
          driverObj,
          assistantRef,
        });
      },
    }),
    new Step({
      driveStep: {
        element: "#chat-display",
        popover: {
          description:
            "You already know how AI chat works - ask questions, get answers. But Magic Sandbox goes beyond conversation. Your assistant can actually open and use Magic Sandbox apps on your behalf. Let's see how!",
          showButtons: ["next"],
        },
      },
      setup: () => {
        const config = driverObj.getConfig();
        config.stagePadding = 0;
      },
      cleanup: async () => {
        await handleInput({
          input: "Sounds delicious! Can you add it to my notes?",
          mockContent: [
            `Sure! Let me open your Notes app.

<open_app>magicsandbox.Notes</open_app>`,
            `Now let me add the recipe. I see you don't have any notes yet, so I'll create a Recipes folder to keep things organized.

<final_script>
app.api.addNote(0, 
  "Classic Chocolate Chip Cookies", 
  \`### Ingredients:
- 2¼ cups all-purpose flour
- 1 tsp baking soda
- 1 tsp salt
- 1 cup butter, softened
- ¾ cup granulated sugar
- ¾ cup packed brown sugar
- 2 large eggs
- 2 tsp vanilla extract
- 2 cups chocolate chips

### Instructions:
1. Preheat oven to 375°F (190°C)
2. Mix flour, baking soda, and salt in a bowl
3. In a separate large bowl, beat butter and both sugars until creamy
4. Beat in eggs and vanilla extract
5. Gradually blend in flour mixture
6. Stir in chocolate chips
7. Drop rounded tablespoons of dough onto ungreased cookie sheets
8. Bake 9-11 minutes or until golden brown
9. Cool on baking sheet for 2 minutes, then transfer to wire rack

Makes about 48 cookies. Enjoy!\`,
  ["Recipes"],
);
</final_script>`,
          ],
          driverObj,
          assistantRef,
        });
      },
    }),
    new Step({
      driveStep: {
        element: "#chat-display",
        disableActiveInteraction: true,
        popover: {
          description: `Your assistant just opened the Notes app and saved your recipe! Magic Sandbox is more than just AI chat - your assistant can use apps to handle tasks for you.
      
When you chat with your assistant with an app open, it automatically understands what you're working on - no need to copy/paste. Let's see it in action!`,
          showButtons: ["next"],
        },
      },
      setup: () => {
        const config = driverObj.getConfig();
        config.stagePadding = 0;
      },
      cleanup: async () => {
        await handleInput({
          input:
            "Can you turn this into a birthday cake cookie recipe instead?",
          //the note we just added is the last node - can't hardcode the id because the user may create notes then replay the tutorial
          mockContent: [
            `Great idea! I'll transform this recipe into fun birthday cake cookies with colorful sprinkles and cake mix!
            
<final_script>
const nodes = app.api.getAllNodes();
app.api.renameNode(nodes.length - 1, "Birthday Cake Cookies");
app.api.replaceNote(nodes.length - 1,
  \`### Ingredients:
- 1 box vanilla cake mix (about 15.25 oz)
- 1 cup all-purpose flour
- ½ tsp baking soda
- 1 tsp salt
- 1 cup butter, softened
- ¾ cup granulated sugar
- ¾ cup packed brown sugar
- 2 large eggs
- 2 tsp vanilla extract
- 1 cup rainbow sprinkles
- ½ cup mini chocolate chips (optional)

### Instructions:
1. Preheat oven to 350°F (175°C)
2. Mix cake mix, flour, baking soda, and salt in a bowl
3. In a separate large bowl, beat butter and both sugars until creamy
4. Beat in eggs and vanilla extract
5. Gradually blend in flour mixture
6. Stir in rainbow sprinkles and mini chocolate chips (if using)
7. Drop rounded tablespoons of dough onto ungreased cookie sheets
8. Bake 8-10 minutes or until edges are set (don't overbake - they should stay soft!)
9. Cool on baking sheet for 2 minutes, then transfer to wire rack

Makes about 36 soft, colorful birthday cake cookies perfect for celebrations! 🎉\`
)
</final_script>`,
          ],
          driverObj,
          assistantRef,
        });
      },
    }),
    new Step({
      driveStep: {
        element: "#driver-home", //careful with changing this - it's hackily used in reload to move to the next step when the user clicks home
        popover: {
          description: `Now you've seen how your assistant can work with Magic Sandbox apps! 
          
Click the Magic Sandbox logo to close the Notes app and return to your home screen.`,
          align: "center",
          showButtons: [],
        },
      },
      setup: () => {
        //skip this step when testing
        if (window._TESTING?.testTutorial) {
          assistantRef.reload();
          driverObj.moveNext();
          return;
        }
        const config = driverObj.getConfig();
        config.stagePadding = 0;
        addInvisibleElement("driver-home", {
          top: 0,
          left: 100 - popoverOffset - popoverArrowOffset,
        });
      },
      cleanup: () => {
        document.getElementById("driver-home")?.remove();
        const config = driverObj.getConfig();
        config.stagePadding = defaultStagePadding;
      },
    }),
    new Step({
      driveStep: {
        element: "#discover-button",
        disableActiveInteraction: true,
        popover: {
          title: "Discover Apps",
          description: `Anyone can create a Magic Sandbox app. Discover apps created by the community here.`,
          showButtons: ["next"],
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

Write code? Check out the docs to learn how to create your own Magic Sandbox app - it's free, and you earn money when others use it!`,
          align: "center",
        },
      },
      setup: () => {
        const config = driverObj.getConfig();
        config.stagePadding = 0;
        addInvisibleElement("driver-help", {
          top: 0,
          right: 56 - popoverOffset - popoverArrowOffset,
        });
      },
      cleanup: () => {
        document.getElementById("driver-help")?.remove();
        const config = driverObj.getConfig();
        config.stagePadding = defaultStagePadding;
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
  const handleNextClick = async () => {
    const state = driverObj.getState();
    const currentStep = steps[state.activeIndex!];
    const nextStep = steps[state.activeIndex! + 1];
    await currentStep?.cleanup?.();
    await nextStep?.setup?.();
    driverObj.moveNext();
    onStateChange?.(driverObj.getState());
  };
  const driverObj = driver({
    overlayClickBehavior: undefined,
    showButtons: ["next", "previous", "close"],
    showProgress: true,
    popoverOffset,
    onNextClick: async () => {
      await handleNextClick();
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
  //this is a little hacky but we want to call this in reload - todo make more type safe?
  (driverObj as any).handleNextClick = handleNextClick;
  const originalDrive = driverObj.drive.bind(driverObj);
  driverObj.drive = async (stepIndex?: number) => {
    assistantRef.setSeenTutorial(true);
    const firstStep = steps[stepIndex ?? 0];
    await firstStep?.setup?.();
    originalDrive(stepIndex);
    onStateChange?.(driverObj.getState());
  };
  return driverObj;
}

async function handleInput({
  input,
  mockContent,
  driverObj,
  assistantRef,
}: {
  input: string;
  mockContent: string[];
  driverObj: Driver;
  assistantRef: AssistantRef;
}) {
  driverObj.highlight({
    element: "#chat-input",
    disableActiveInteraction: true,
  });
  await addTextToTextArea(
    input,
    document.getElementById("chat-input") as HTMLTextAreaElement,
  );
  //this isn't really documented so it's probably a bad idea
  //but it's the only way to change stagePadding during the tour - ideally it would be configurable at the step level
  const config = driverObj.getConfig();
  config.stagePadding = 0;
  driverObj.highlight({
    element: "#chat-display",
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  await assistantRef.handleInput({
    input,
    mockContent,
  });
  config.stagePadding = defaultStagePadding;
}

async function addTextToTextArea(text: string, textArea: HTMLTextAreaElement) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (let i = 0; i < text.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 30));
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
