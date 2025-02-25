import React from "react";
import { createRoot } from "react-dom/client";
import Note2 from "./Note2.js";

function App() {
  return (
    <div className="flex h-screen w-screen">
      <Note2 />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
