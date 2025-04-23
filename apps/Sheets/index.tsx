import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { IronCalc, Model, init as _initWasm } from "@ironcalc/workbook";
import { Loader, Upload, Download } from "lucide-react";
import wasm from "@ironcalc/wasm/wasm_bg.wasm";

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
      model?.fromXlsx(bytes, file.name.replace(/\.xlsx?$/i, ""), "en", "UTC"),
    );
  }

  async function handleDownload() {
    const bytes = model?.toXlsx();
    await requestDownload(`${model?.getName()}.xlsx`, bytes);
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="mx-2 flex gap-2">
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
    return;
  }
  const workbookData = state.model.getWorkbookData();
  const sheetData = workbookData[0]!; //todo: support multiple sheets

  // Get all row and column indices
  const rowIndices = Object.keys(sheetData)
    .map(Number)
    .sort((a, b) => a - b);
  const allColumnIndices = new Set<number>();
  rowIndices.forEach((row) => {
    Object.keys(sheetData[row]!)
      .map(Number)
      .forEach((col) => allColumnIndices.add(col));
  });
  const columnIndices = Array.from(allColumnIndices).sort((a, b) => a - b);

  // Convert column index to A1 notation
  const toColumnName = (index: number): string => {
    let name = "";
    while (index >= 0) {
      name = String.fromCharCode(65 + (index % 26)) + name;
      index = Math.floor(index / 26) - 1;
    }
    return name;
  };

  // Build the cells string
  const cells = rowIndices
    .map((row) => {
      return columnIndices
        .map((col) => {
          const cell = sheetData[row]?.[col];
          const cellRef = `${toColumnName(col)}${row + 1}`;
          if (cell) {
            return `${cellRef},${cell.formula || ""},${cell.value}`;
          }
          return `${cellRef},,`;
        })
        .join("|");
    })
    .join("\n");

  return `# magicsandbox.Sheets

magicsandbox.Sheets is a work in progress spreadsheet app with limited functionality at the moment.

## Context

${cells}
`;
}

export { init, context };
