import { getMinCost } from "./utils.js";

async function createWelcomeConversation(app) {
  const welcome = {};
  if (app) {
    try {
      welcome.minCost = await getMinCost(app);
      welcome.app = app;
    } catch (error) {
      console.error(error);
    }
  }
  return {
    conversationId: "0",
    messages: [
      {
        role: "assistant",
        tags: [],
        welcome,
      },
    ],
    summary: "Welcome to Magic Sandbox!",
    lastUpdated: Date.now(),
  };
}

function getWelcomeMessage(message) {
  const { app, minCost } = message.welcome;
  let suggestion = "";
  if (minCost <= 0.01) {
    suggestion = `- [**Open the app ${app}**](?action=open-${app}) - the link you opened includes a request to open this app.\n`;
  } else if (app) {
    console.log(
      `Not suggesting ${app} because minCost ${minCost} is greater than $0.01, or it's invalid`,
    );
  }
  const content = `## Welcome to Magic Sandbox!

**I'm your AI assistant.** Magic Sandbox gives me some **unique abilities** - here's what I can help you with:

- **I can open and interact with apps** - that means I can handle tasks for you!
- **I can answer questions related to the app you have open** - I automatically understand what you're working on. No more copy/pasting!
- **And, of course, I can chat** - with Magic Sandbox, you can chat with all the latest AI models, including **ChatGPT**, **Claude**, and **Gemini**.

**Let's get started!** Here's what you can do next:

${suggestion}- **Give it a try! Enter _"add a chocolate chip cookie recipe to my notes"_ below** and I'll show you how I can work with apps!
- [**Watch the 1 minute demo video**](https://www.youtube.com/watch?v=dQw4w9WgXcQ) to see what's possible.
- [**Discover apps**](?action=discover) you can use.
- [**Learn the details**](https://magicsandbox.ai/?_app=magicsandbox.About) of how Magic Sandbox works.
- [**Write code? Check out the docs**](https://magicsandbox.ai/?_app=magicsandbox.Docs) to learn how to create your own Magic Sandbox app (it's free, and you earn money when others use it!)
- [**Create a free account**](https://magicsandbox.ai/account/upgrade) to unlock a higher account balance and more features.

_By continuing, you acknowledge that you have read and agree to our [Terms of Use](https://magicsandbox.ai/terms) and [Privacy Policy](https://magicsandbox.ai/privacy)._`;
  message.tags = [{ content }];
  return message;
}

export { createWelcomeConversation, getWelcomeMessage };
