import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { IronCalc, Model, init as _initWasm } from "@ironcalc/workbook";
import { Loader, Upload, Download } from "lucide-react";
import wasm from "@ironcalc/wasm/wasm_bg.wasm";
import { SheetsState } from "./SheetsState.ts";

let sheetsState: SheetsState | null = null;

async function initWasm() {
  // const response = await requestFetch(
  //   "https://esm.sh/@ironcalc/wasm@0.3.2/wasm_bg.wasm",
  //   { responseType: "bytes" },
  // );
  // const module = await WebAssembly.compile(response.body);

  // @ts-ignore
  const module = await WebAssembly.compile(wasm);
  await _initWasm(module);
  sheetsState = new SheetsState(new Model("New Workbook", "en", "UTC"));
}

const initWasmPromise = initWasm();

async function init() {
  createRoot(document.getElementById("root")!).render(<App />);
  await initWasmPromise;
  return sheetsState?.context();
}

function App() {
  const [model, _setModel] = useState<Model | null>(null);

  function setModel(newModel: Model) {
    const newModelProxy = new Proxy(newModel, {
      get(target, prop, receiver) {
        if (prop === "undo") {
          sheetsState!.undo();
          return () => {};
        } else if (prop === "redo") {
          sheetsState!.redo();
          return () => {};
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    _setModel(newModelProxy);
    sheetsState!.model = newModelProxy;
  }

  useEffect(() => {
    async function initModel() {
      await initWasmPromise;
      setModel(sheetsState!.model);
    }
    initModel();
  }, []);

  if (model === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    //todo handle errors
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
    //todo handle errors
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
  return sheetsState!.context();
}

const api = {
  getRange: (...args: Parameters<SheetsState["getRange"]>) =>
    sheetsState!.getRange(...args),
  setRange: (...args: Parameters<SheetsState["setRange"]>) =>
    sheetsState!.setRange(...args),
  clearRange: (...args: Parameters<SheetsState["clearRange"]>) =>
    sheetsState!.clearRange(...args),
  insertRows: (...args: Parameters<SheetsState["insertRows"]>) =>
    sheetsState!.insertRows(...args),
  deleteRows: (...args: Parameters<SheetsState["deleteRows"]>) =>
    sheetsState!.deleteRows(...args),
  insertColumns: (...args: Parameters<SheetsState["insertColumns"]>) =>
    sheetsState!.insertColumns(...args),
  deleteColumns: (...args: Parameters<SheetsState["deleteColumns"]>) =>
    sheetsState!.deleteColumns(...args),
  addSheet: (...args: Parameters<SheetsState["addSheet"]>) =>
    sheetsState!.addSheet(...args),
  renameSheet: (...args: Parameters<SheetsState["renameSheet"]>) =>
    sheetsState!.renameSheet(...args),
  deleteSheet: (...args: Parameters<SheetsState["deleteSheet"]>) =>
    sheetsState!.deleteSheet(...args),
};

export { init, context, api };
