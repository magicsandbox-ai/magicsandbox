import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <div className="flex h-screen items-center justify-center">
      Hello, world!
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
  