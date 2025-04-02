import { getMinCost } from "./utils.js";

async function welcomeMessage(app) {
  let minCost;
  let suggestion = "";
  if (app) {
    try {
      minCost = await getMinCost(app);
      if (minCost <= 0.01) {
        suggestion = `- [**Open the app ${app}**](?action=open-${app}) - the link you opened includes a request to open this app.\n`;
      } else {
        console.log(
          `Not suggesting ${app} because minCost ${minCost} is greater than $0.01`,
        );
      }
    } catch (error) {
      console.error(error);
    }
  }
  const content = `## Welcome to Magic Sandbox!

**I'm your AI assistant.** Magic Sandbox gives me some **unique abilities** - here's what I can help you with:

- **I can chat** - ask me anything! With Magic Sandbox, you can chat with all the latest AI models, including **ChatGPT**, **Claude**, and **Gemini**.
- **I can open and interact with apps** - that means I can handle tasks for you!
- **I can answer questions related to the app you have open** - I automatically understand what you're working on. No more copy/pasting!

**Let's get started!** Here's what you can do next:

${suggestion}- **Give it a try! Enter _"add a joke to my notes"_ below** and I'll show you how I can work with apps!
- [**Watch the 1 minute demo video**](https://www.youtube.com/watch?v=dQw4w9WgXcQ) to see what's possible.
- [**Discover apps**](?action=discover) you can use.
- [**Learn the details**](https://magicsandbox.ai/?_app=magicsandbox.About) of how Magic Sandbox works.
- [**Write code? Check out the docs**](https://magicsandbox.ai/?_app=magicsandbox.Docs) to learn how to create your own Magic Sandbox app (it's free, and you earn money when others use it!)
- [**Create a free account**](https://magicsandbox.ai/upgrade) to unlock a higher account balance and more features.

_By continuing, you acknowledge that you have read and agree to our [Terms of Use](https://magicsandbox.ai/terms) and [Privacy Policy](https://magicsandbox.ai/privacy)._`;
  return {
    role: "assistant",
    tags: [{ content }],
    welcome: true,
    welcomeMinCost: minCost,
  };
}

export { welcomeMessage };
