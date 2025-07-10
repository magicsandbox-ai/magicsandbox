import { test, expect } from "@magicsandbox.ai/test";

/*
npm run test assistant

favorite/unfavorite: Home, Discover, in app
stop chat
rename chat
delete chat
switch chat from chat history
confirm chat cost
risk: maybe test download?
model picker
drag and drop
feedback
reload
welcome tooltip? driver tour
*/

test.use({ appOptions: { autoConfirm: true } });

test("Assistant", async ({ app }) => {
  //search
  await app.getByRole("button", { name: "Search" }).click();
  const searchInput = app.getByLabel("Search chats...");
  await searchInput.fill("Welcome");
  await searchInput.press("Enter");
  await app
    .getByRole("dialog")
    .getByRole("button", { name: "Welcome to Magic Sandbox!" })
    .nth(0)
    .click();
  await expect(app.getByRole("dialog")).not.toBeVisible();

  //welcome message - app fixture tests opening apps so no need to test here
  await app.getByRole("button", { name: "Discover apps" }).nth(0).click();
  await expect(app.getByRole("dialog")).toBeVisible();
  const discoverInput = app.getByLabel("Search for apps...");
  await discoverInput.fill("Notes");
  await discoverInput.press("Enter");
  //should be multiple buttons (first button is the search button)
  //performance of magicsandbox.discover locally is variable (I think due to the embedding model being swapped to disk)
  //so increase the timeout
  await expect(app.getByRole("dialog").getByRole("button").nth(1)).toBeVisible({
    timeout: 15000,
  });
  await app.getByRole("dialog").press("Escape");
  await expect(app.getByRole("dialog")).not.toBeVisible();

  //close menu
  await app.getByRole("button", { name: "Close menu" }).click();
  await expect(
    app.getByRole("button", { name: "Close menu" }),
  ).not.toBeVisible();

  //open menu
  await app.getByRole("button", { name: "Open menu" }).click();
  await expect(app.getByRole("button", { name: "Close menu" })).toBeVisible();

  //new chat
  await app.getByRole("button", { name: "New chat" }).click();
  await expect(
    app.getByRole("button", { name: "Discover Apps" }),
  ).toBeVisible();

  //chat
  app.evaluate(() => {
    window._requestFunction = window.requestFunction;
    window.requestFunction = async (fn, args, options) => {
      if (fn.startsWith("magicsandbox.llm")) {
        async function* createLlmResult(content) {
          const chunks = [
            {
              result: {
                model: "claude-3-7-sonnet-20250219",
                content,
                finish_reason: "stop",
                usage: {
                  prompt_tokens: 10,
                  completion_tokens: 10,
                },
              },
            },
          ];
          for (const chunk of chunks) {
            yield chunk;
          }
        }
        const messages = args[0].messages;
        const lastMessageContent = messages[messages.length - 1].content;
        if (lastMessageContent.includes("Hello1")) {
          return createLlmResult(
            "Let me open Notes\n\n<open_app>magicsandbox.Notes</open_app>",
          );
        } else if (
          lastMessageContent.includes("<app_context>") &&
          !lastMessageContent.includes("<logs>")
        ) {
          return createLlmResult(
            "Let me log your note.\n\n<intermediate_script>app.api.logNotes([1]);</intermediate_script>",
          );
        } else if (lastMessageContent.includes("<logs>")) {
          if (/<logs>\s*\S[\s\S]*<\/logs>/.test(lastMessageContent) === false) {
            throw new Error("logs should not be empty");
          }
          return createLlmResult(`I can see your note - let me add to it.
            
<final_script>
app.api.appendToNote(1, \`hello world\`);
</final_script>

<final_script>
//test multiple scripts
app.api.appendToNote(1, \`goodbye!\`);
</final_script>

I've added to your note.`);
        } else {
          throw new Error("Unexpected message");
        }
      } else {
        return window._requestFunction(fn, args, options);
      }
    };
  });
  const chatInput = app.getByRole("textbox", {
    name: "Chat with your Assistant",
  });
  await chatInput.fill("Hello1");
  await chatInput.press("Enter");
  await expect(app.getByText("Hello1")).toBeVisible();
  await expect(app.getByText("Let me open Notes")).toBeVisible();
  await expect(app.getByText("Let me log your note.")).toBeVisible();
  await expect(app.getByText("I've added to your note.")).toBeVisible();
  await app.getByRole("button", { name: "Collapse" }).click();
  await expect(app.getByText("I've added to your note.")).not.toBeVisible();
  const notes = app.childFrames()[0];
  await expect(notes.getByText("hello world")).toBeVisible();
  await expect(notes.getByText("goodbye!")).toBeVisible();
});
