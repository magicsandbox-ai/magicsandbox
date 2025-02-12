import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

function init() {
  createRoot(document.getElementById("root")).render(<App />);
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

function App() {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function init() {
      try {
        const notes = await requestGetData("notes");
        if (notes) {
          setNotes(notes);
        }
      } catch (error) {
        console.error(error);
      }
    }
    init();
  }, []);

  useEffect(() => {
    const saveTimeout = setTimeout(async () => {
      try {
        await requestPutData("notes", notes);
      } catch (error) {
        console.error(error);
      }
    }, 500); //debounce writes

    return () => clearTimeout(saveTimeout);
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
