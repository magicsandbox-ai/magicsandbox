const exampleAppFiles = {
  "magic.json5": `{
  name: 'Example',
  version: '0.1.0',
  description: '',
  private: true,
  dependencies: {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}`,
  "index.js": `import React, { useState } from "react";
import { createRoot } from "react-dom/client";

function init() {
  createRoot(document.getElementById("root")).render(
    <App />,
  );
  return context(); // optional
}

function context() {
  return \`# magicsandbox.HelloWorld

This is a simple hello world app that displays text.

## Context

The current text is: \${api.text}

## API

### app.api.setText(text: string)

Updates the displayed text.\`;
}

const api = {
  text: null,
  setText: null,
};

function App() {
  const [text, setText] = useState("Hello, world!");
  api.text = text;
  api.setText = setText;
  return <div>{text}</div>;
}

export { init, context, api };`,
};

const exampleFunctionFiles = {
  "magic.json5": `{
  name: '',
  version: '0.1.0',
  description: '',
  documentation: '',
  endpoint: 'https://example.com'
}`,
};

export { exampleAppFiles, exampleFunctionFiles };
