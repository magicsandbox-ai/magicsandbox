import { test, expect } from "@magicsandbox.ai/test";

/*
npm run test notes

todos:
- test input rules
- test editing menu (bold/italic/etc.)
- drag and drop
*/

test("Notes", async ({ app }) => {
  //info
  await app.getByRole("button", { name: "Info" }).click();
  await expect(app.getByRole("dialog")).toBeVisible();
  await app.getByText("magicsandbox.Notes").press("Escape");

  //delete
  await expect(app.getByRole("button", { name: "New Note" })).toBeVisible();
  await app.getByRole("button", { name: "Delete" }).click();
  await app.getByRole("dialog").getByRole("button", { name: "Delete" }).click(); //confirm
  await expect(app.getByRole("button", { name: "New Note" })).not.toBeVisible();

  //add folder
  await app.getByRole("button", { name: "Add folder" }).first().click();
  await expect(app.getByRole("button", { name: "New Folder" })).toBeVisible();

  //add note
  await app.getByRole("button", { name: "Add note" }).first().click();
  await expect(app.getByRole("button", { name: "New Note" })).toBeVisible();

  //rename note
  await app.getByRole("button", { name: "New Note" }).dblclick();
  const renameInput = app.getByLabel("Rename").nth(0); //todo test renaming by clicking title?
  await renameInput.fill("Renamed Note");
  await renameInput.press("Enter");
  await expect(app.getByRole("button", { name: "Renamed Note" })).toBeVisible();

  //edit note
  await app.locator(".ProseMirror").fill("Hello world!");
  await expect(app.getByText("Hello world!")).toBeVisible();

  //close menu
  await app.getByRole("button", { name: "Close menu" }).click();
  await expect(
    app.getByRole("button", { name: "Close menu" }),
  ).not.toBeVisible();

  //open menu
  await app.getByRole("button", { name: "Open menu" }).click();
  await expect(app.getByRole("button", { name: "Close menu" })).toBeVisible();

  //api add
  await app.evaluate(() => {
    app.api.addNote(
      0,
      "API Note",
      `API Content

alpha
bravo
charlie

# delta
## echo
### foxtrot

> golf
> hotel
> india

\`\`\`
juliet
kilo
lima
\`\`\`

- mike
- november
- oscar

1. papa
2. quebec
3. romeo
`,
      ["API Folder"],
    );
  });
  await expect(app.getByRole("button", { name: "API Folder" })).toBeVisible();
  const folderId = 3; //todo avoid hardcoding this somehow
  let apiNote = app.getByRole("button", { name: "API Note" });
  await expect(apiNote).toBeVisible();
  const noteId = 4; //todo avoid hardcoding this somehow
  await expect(app.getByText("API Content")).toBeVisible(); //should be set to current after adding
  async function checkDiff() {
    //make sure %%added%% and %%removed%% markers are not visible
    await expect(app.getByText("%%added%%")).not.toBeVisible();
    await expect(app.getByText("%%removed%%")).not.toBeVisible();
  }
  await checkDiff();

  //api append
  await app.evaluate((noteId) => {
    app.api.appendToNote(
      noteId,
      `API Append
\`\`\`
I'm a new code block!
\`\`\``,
    );
  }, noteId);
  await expect(app.getByText("API Content")).toBeVisible();
  await expect(app.getByText("API Append")).toBeVisible();
  await checkDiff();

  //api replace
  await app.evaluate((noteId) => {
    app.api.replaceNote(
      noteId,
      `API Replace
alpha
beta
charlie

# delta
## elephant
### foxtrot

> golf
> hydrogen
> india

\`\`\`
juliet
kevin
lima
\`\`\`

\`\`\`
I'm a new code block!
\`\`\`

- mike
- **I'm bold:** nancy
  - I'm a new sub bullet!
- oscar

1. papa
2. quail
3. romeo`,
    );
  }, noteId);
  await expect(app.getByText("API Replace")).toBeVisible();
  await checkDiff();

  //api edit
  await app.evaluate((noteId) => {
    app.api.editNote(noteId, "Replace", "Edit");
  }, noteId);
  await expect(app.getByText("API Edit")).toBeVisible();
  await checkDiff();

  //api log
  const logPromise = app.page().waitForEvent("console");
  await app.evaluate((noteId) => {
    app.api.logNotes([noteId]);
  }, noteId);
  const log = await logPromise;
  const logText = await log.text();
  await expect(logText).toContain("API Edit");

  //api rename
  await app.evaluate((noteId) => {
    app.api.renameNode(noteId, "API Rename");
  }, noteId);
  apiNote = app.getByRole("button", { name: "API Rename" });
  await expect(apiNote).toBeVisible();

  //api move
  await app.evaluate(
    ({ noteId, folderId }) => {
      app.api.moveNodes([noteId], folderId, ["API Subfolder"]);
    },
    { noteId, folderId },
  );
  const apiSubfolder = app.getByRole("button", { name: "API Subfolder" });
  await expect(apiSubfolder).toBeVisible();
  const subfolderId = 4; //todo avoid hardcoding this somehow

  //api delete
  await app.evaluate((subfolderId) => {
    app.api.deleteNodes([subfolderId]);
  }, subfolderId);
  //this doesn't do anything until changes are approved
  //todo could test that delete icon indicator is visible

  //search
  await app.getByRole("button", { name: "Search" }).click();
  const searchInput = app.getByLabel("Search notes...");
  await searchInput.fill("Hello");
  await searchInput.press("Enter");
  await app
    .getByRole("dialog")
    .getByRole("button", { name: "Renamed Note" })
    .click();
  await expect(app.getByText("Hello world!")).toBeVisible();

  //todo context?

  //reject changes
  await apiNote.click();
  await expect(app.getByText("API Content")).toBeVisible(); //prevContent
  await expect(app.getByText("API Edit")).toBeVisible(); //content
  const rejectButton = app.getByRole("button", {
    name: "Reject changes to this note",
  });
  await rejectButton.click(); //this rejects the delete, edit, rename, and move
  await expect(app.getByText("API Edit")).not.toBeVisible(); //content should be gone
  await expect(app.getByText("API Content")).toBeVisible(); //prevContent should still be visible
  await expect(apiNote).not.toBeVisible(); //rejected rename so has name "API Note" now
  apiNote = app.getByRole("button", { name: "API Note" });
  await expect(apiNote).toBeVisible();
  await expect(rejectButton).not.toBeVisible();
  //todo how to test rejecting move?
  //todo test ctrl+z for diff to reappear?

  //approve changes
  const approveAllButton = app.getByRole("button", {
    name: "Approve all changes",
  });
  await expect(apiSubfolder).toBeVisible();
  await approveAllButton.click(); //approves the deletion of subfolder and creation of folder
  await expect(apiSubfolder).not.toBeVisible(); //deleted
  await expect(apiNote).toBeVisible(); //rejected the delete
  await expect(approveAllButton).not.toBeVisible();
  //todo test that folder no longer has new icon?
});
