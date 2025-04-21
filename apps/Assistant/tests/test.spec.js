import { test, expect } from "@magicsandbox.ai/test";

/*
npm run test assistant

favorite/block/drag and drop?
chat, maximize bottom chat, pause
model picker
confirm/risks?
rename/delete
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
});
