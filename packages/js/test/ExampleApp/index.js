import React, { useState } from "react";
import { createRoot } from "react-dom/client";

const api = {};

function App() {
  const [text, setText] = useState("");
  api.setText = setText;
  return (
    <div className="flex h-screen items-center justify-center">{text}</div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

export { api };
