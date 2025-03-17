import { test, expect } from "@magicsandbox.ai/test";

/*
npm run test assistant
*/

test("Assistant", async ({ app }) => {
  //welcome and discover
  await app.getByRole("link", { name: "Discover apps" }).click();
  await expect(app.getByRole("dialog")).toBeVisible();
  await app.getByRole("dialog").press("Escape");
  await expect(app.getByRole("dialog")).not.toBeVisible();

  //search
  await app.getByRole("button", { name: "Search" }).click();
  const searchInput = app.getByLabel("Search chats...");
  await searchInput.fill("Welcome");
  await searchInput.press("Enter");
  await app
    .getByRole("dialog")
    .getByRole("button", { name: "Welcome to Magic Sandbox!" })
    .click();
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
    app.getByRole("button", { name: "magicsandbox.Notes" }),
  ).toBeVisible(); //should be favorited app on init
});
