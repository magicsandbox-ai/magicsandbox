import React, { useState } from "react";
import { createRoot } from "react-dom/client";

const api = {};

function App() {
  const [text, setText] = useState("Hello, world!");
  api.text = text;
  api.setText = setText;
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <p>{text}</p>
      <button onClick={() => setText("Button clicked!")}>Click me</button>
    </div>
  );
}

function init() {
  createRoot(document.getElementById("root")).render(<App />);
  return "This is the init";
}

function context() {
  return "This is the context";
}

export { init, context, api };
