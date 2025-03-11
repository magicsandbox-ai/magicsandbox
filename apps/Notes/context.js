function context(appState) {
  const contextSections = [];
  if (appState.folders) {
    contextSections.push(`The user has the following folders:
<folders>
${appState.folders.join("\n")}
</folders>`);
  }
  if (appState.currentFolder) {
    contextSections.push(`The user currently has the following folder open:
<currentFolder>
${appState.currentFolder}
</currentFolder>`);
  }
  if (appState.currentNotes) {
    contextSections.push(`The notes in the current folder are:
<currentNotes>
${appState.currentNotes}
</currentNotes>`);
  }

  return `# magicsandbox.Notes

magicsandbox.Notes lets users take notes in a hierarchical folder structure.

## Context Management

The user can manage which notes appear in the context by:
- Clicking the checkbox next to a note in the sidebar
- Using Ctrl+Click in the sidebar to select notes and folders
- Starring a note by clicking the star icon next to it in the sidebar. Starred notes are included in the context when:
  - They are in the same folder as the current note the user has open
  - They are in any parent folder above the current note the user has open

Notes that are included in the context are shown in bold in the sidebar.

## Context

${contextSections.join("\n\n")}

## API

### app.api.addNote(parentId: number, name: string, content: string, folders?: string[])

Add a new note.

- \`parentId\`: ID of the parent folder (use 0 for the root folder)
- \`name\`: Name of the new note
- \`content\`: Content of the new note
- \`folders\`: (Optional) Array of folder names to create as a path to the note. If provided, the note will be created in the last folder in this path.

Returns: If \`folders\` is provided, returns the ID of the last folder created in the path.

Examples:
- \`addNote(0, "New Note", "content")\` Creates a note named "New Note" in the root folder
- \`addNote(2, "New Note", "content")\` Creates a note named "New Note" in the folder with ID 2
- \`addNote(2, "New Note", "content", ["New Folder"])\` Creates a folder named "New Folder" in the folder with ID 2, then creates a note named "New Note" in the new folder
- \`addNote(2, "New Note", "content", ["Folder 1", "Folder 2"])\` Creates a folder named "Folder 1" in the folder with ID 2, then creates a folder named "Folder 2" in "Folder 1", then creates a note named "New Note" in "Folder 2"

To create a folder and add multiple notes to it, use the returned folder ID:

~~~javascript
const newFolderId = app.api.addNote(0, "Note 1", "Content 1", ["New Folder"]);
app.api.addNote(newFolderId, "Note 2", "Content 2")
~~~

### app.api.appendToNote(id: number, content: string)

Append content to an existing note.

### app.api.replaceNote(id: number, content: string)

Replace an existing note, completely overwriting the existing content.

### app.api.editNote(id: number, find: string, replace: string)

Edit an existing note. The \`find\` string must exactly match a portion of the existing content, character for character, including whitespace. All occurrences of the \`find\` string will be replaced with the \`replace\` string.

### app.api.renameNode(id: number, name: string)

Rename an existing note or folder.

### app.api.moveNodes(ids: number[], parentId: number, folders?: string[])

Move existing notes or folders to a new parent folder. Note that when a folder is moved, all of its children are also moved, so you don't need to specify their ids.

- \`ids\`: Array of IDs of notes or folders to move
- \`parentId\`: ID of the destination parent folder (use 0 for the root folder)
- \`folders\`: (Optional) Array of folder names to create as a path to the destination. If provided, the nodes will be moved to the last folder in this path.

Returns: If \`folders\` is provided, returns the ID of the last folder created in the path.

Examples:
- \`moveNodes([5, 6], 0)\`: Moves nodes with IDs 5 and 6 to the root folder
- \`moveNodes([5, 6], 2)\`: Moves nodes with IDs 5 and 6 to the folder with ID 2
- \`moveNodes([5, 6], 2, ["New Folder"])\`: Creates a folder named "New Folder" in the folder with ID 2, then moves nodes with IDs 5 and 6 to the new folder
- \`moveNodes([5, 6], 2, ["Folder 1", "Folder 2"])\`: Creates a folder named "Folder 1" in the folder with ID 2, then creates a folder named "Folder 2" in "Folder 1", then moves nodes with IDs 5 and 6 to "Folder 2"

### app.api.deleteNodes(ids: number[])

Delete existing notes or folders. Note that when a folder is deleted, all of its children are also deleted, so you don't need to specify their ids.

## Instructions

- Only use the API if the user specifically asked you to make a change to their notes. Otherwise, answer the user's question using their notes as context.
- Try to solve the user's request given the context provided. However, if it would be more helpful if you had more context, at the end of your response, suggest that the user add notes to the context using one of the methods detailed in the Context Management section.
`;
}

export { context };
