import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import SideBar from "./SideBar.js";

async function init() {
  // get the notes here so they're available in the initial context call
  // if we used a useEffect inside App, they wouldn't be available
  const initNotes = (await requestGetData("notes")) || { "New Folder": "" };
  const initCurrentFolder =
    (await requestGetData("currentFolder")) || "New Folder";
  api.folders = Object.keys(initNotes);
  createRoot(document.getElementById("root")).render(
    <App initNotes={initNotes} initCurrentFolder={initCurrentFolder} />,
  );
  return context();
}

function context() {
  const contextSections = [];
  if (api.folders) {
    contextSections.push(`The user has the following folders:
<folders>
${api.folders.join("\n")}
</folders>`);
  }
  if (api.currentFolder) {
    contextSections.push(`The user currently has the following folder open:
<currentFolder>
${api.currentFolder}
</currentFolder>`);
  }
  if (api.currentNotes) {
    contextSections.push(`The notes in the current folder are:
<currentNotes>
${api.currentNotes}
</currentNotes>`);
  }

  return `# magicsandbox.Notes

This is a simple notes app where users can create and edit notes in folders.

## Context

${contextSections.join("\n\n")}

## API

### app.api.addNote(folder: string, note: string)

Add a note to the specified folder. If the folder doesn't exist, it will be created.

## Instructions

- Only use \`app.api.addNote\` to add a note if the user specifically asked you to. Pick the most appropriate folder for the note. If none of the existing folders are appropriate, create a new folder.
- Otherwise, answer the user's question using the current notes as context.
`;
}

const api = {};

function App({ initNotes, initCurrentFolder }) {
  const [notes, setNotes] = useState(initNotes || { "New Folder": "" });
  const [currentFolder, setCurrentFolder] = useState(
    initCurrentFolder || "New Folder",
  );

  useEffect(() => {
    requestPutData("notes", notes).catch(console.error);
  }, [notes]);

  useEffect(() => {
    requestPutData("currentFolder", currentFolder).catch(console.error);
  }, [currentFolder]);

  function handleChange(e) {
    setNotes((notes) => ({ ...notes, [currentFolder]: e.target.value }));
  }

  function addNote(folder, note) {
    const newNotes = { ...notes };
    if (newNotes[folder]) {
      newNotes[folder] = `${newNotes[folder]}\n${note}`;
    } else {
      newNotes[folder] = note;
    }
    setNotes(newNotes);
    setCurrentFolder(folder);
  }

  const currentNotes = notes[currentFolder];
  api.currentNotes = currentNotes;
  api.currentFolder = currentFolder;
  api.folders = Object.keys(notes);
  api.addNote = addNote;

  return (
    <div className="flex h-screen w-screen">
      <SideBar
        folders={Object.keys(notes)}
        currentFolder={currentFolder}
        setCurrentFolder={setCurrentFolder}
        setNotes={setNotes}
      />
      <textarea
        className="grow resize-none border-none p-4"
        value={currentNotes}
        onChange={handleChange}
        placeholder="Add a note..."
      />
    </div>
  );
}

export { init, context, api };
