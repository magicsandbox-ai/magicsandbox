import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

async function init({ urlParams }) {
  // get the notes here so they're available in the initial context call
  // if we used a useEffect inside App, they wouldn't be available
  const initNotes = await requestGetData("notes");
  api.notes = initNotes;
  createRoot(document.getElementById("root")).render(
    <App urlParams={urlParams} initNotes={initNotes} />,
  );
  return context();
}

function context() {
  return `# magicsandbox.Notes

This is a simple notes app.

## Context

The current notes are:

<notes>
${api.notes}
</notes>

## API

### app.api.addNote(note: string)

Add a note to the notes.
`;
}

const api = {
  notes: null,
  addNote: null,
};

function App({ urlParams, initNotes }) {
  // note: in this simple example, we're not using urlParams
  const [notes, setNotes] = useState(initNotes || "");

  useEffect(() => {
    requestPutData("notes", notes).catch(console.error);
  }, [notes]);

  api.notes = notes;
  api.addNote = (note) => {
    setNotes(`${notes}\n${note}`);
  };

  return (
    <div className="flex h-screen w-screen flex-col">
      <textarea
        className="grow resize-none border-none p-4"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add a note..."
      />
    </div>
  );
}

export { init, context, api };
