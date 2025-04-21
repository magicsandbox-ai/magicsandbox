import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { IronCalc, Model, init as _initWasm } from "@ironcalc/workbook";
import { Loader } from "lucide-react";

async function initWasm() {
  const response = await requestFetch(
    "https://esm.sh/@ironcalc/wasm@0.3.2/wasm_bg.wasm",
    { responseType: "bytes" },
  );
  const module = await WebAssembly.compile(response.body);
  return await _initWasm(module);
}

const initWasmPromise = initWasm();

const state = {
  model: null as Model | null,
};

function init() {
  createRoot(document.getElementById("root")!).render(<App />);
}

function App() {
  const [model, setModel] = useState<Model | null>(null);

  useEffect(() => {
    async function init() {
      await initWasmPromise;
      setModel(new Model("New Workbook", "en", "UTC"));
    }
    init();
  }, []);

  useEffect(() => {
    state.model = model;
  }, [model]);

  if (model === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen">
      <IronCalc model={model} />
    </div>
  );
}

function context() {
  if (state.model === null) {
    return;
  }
  const cellA1 = state.model.getCellContent(0, 1, 1);
  return `# magicsandbox.Sheets

magicsandbox.Sheets is a work in progress spreadsheet app with limited functionality at the moment.

## Context

The value of cell A1 is ${cellA1}.`;
}

export { init, context };
