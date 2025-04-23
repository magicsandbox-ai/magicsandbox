import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { IronCalc, Model, init as _initWasm } from "@ironcalc/workbook";
import { Loader, Upload, Download } from "lucide-react";
import wasm from "@ironcalc/wasm/wasm_bg.wasm";
import { context as _context } from "./context.ts";

async function initWasm() {
  // const response = await requestFetch(
  //   "https://esm.sh/@ironcalc/wasm@0.3.2/wasm_bg.wasm",
  //   { responseType: "bytes" },
  // );
  // const module = await WebAssembly.compile(response.body);

  // @ts-ignore
  const module = await WebAssembly.compile(wasm);
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = await file.arrayBuffer();
    setModel(
      Model.fromXlsx(
        new Uint8Array(bytes),
        file.name.replace(/\.xlsx?$/i, ""),
        "en",
        "UTC",
      ),
    );
  }

  async function handleDownload() {
    const bytes = model?.toXlsx();
    if (!bytes) return;
    await requestDownload(`${model?.getName()}.xlsx`, bytes);
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="mx-3 mt-3 flex gap-3">
        <label className={"cursor-pointer"}>
          <Upload />
          <span className="sr-only">Upload File</span>
          <input type="file" className="hidden" onChange={handleUpload} />
        </label>
        <button onClick={handleDownload}>
          <Download />
          <span className="sr-only">Download File</span>
        </button>
        <button onClick={() => console.log(context())}>
          Log Workbook Data
        </button>
      </div>
      <div className="grow">
        <IronCalc model={model} />
      </div>
    </div>
  );
}

function context() {
  if (state.model === null) {
    return "";
  }
  return _context(state.model);
}

export { init, context };
