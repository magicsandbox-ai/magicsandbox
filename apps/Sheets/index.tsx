import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { IronCalc, Model, init as _initWasm } from "@ironcalc/workbook";
import { Loader, Upload, Download } from "lucide-react";
import wasm from "@ironcalc/wasm/wasm_bg.wasm";
import { SheetsState } from "./SheetsState.ts";
import { Toasts } from "@components/Toasts.js";
import UploadConfirm from "./UploadConfirm.tsx";

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
  const modelBytes = (await requestGetData("modelBytes")) as
    | Uint8Array
    | undefined;
  if (modelBytes) {
    sheetsState = new SheetsState(Model.from_bytes(modelBytes));
  } else {
    sheetsState = new SheetsState(new Model("New Workbook", "en", "UTC"));
  }
}

const initWasmPromise = initWasm();

async function init() {
  createRoot(document.getElementById("root")!).render(<App />);
  await initWasmPromise;
  return sheetsState?.context();
}

function App() {
  const [model, _setModel] = useState<Model | null>(null);
  const [_redrawId, setRedrawId] = useState(0);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);

  function setModel(newModel: Model) {
    sheetsState!.modelUndo = newModel.undo.bind(newModel);
    sheetsState!.modelRedo = newModel.redo.bind(newModel);
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

  const toastsRef = useRef<typeof Toasts>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addToast(message: string, type: string) {
    toastsRef.current?.addToast(message, type);
  }

  useEffect(() => {
    async function initModel() {
      await initWasmPromise;
      setModel(sheetsState!.model);
      sheetsState!.redraw = () => setRedrawId((id) => id + 1);
      sheetsState!.addToast = addToast;
    }
    initModel();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[href]") as HTMLAnchorElement;
      if (link) {
        e.preventDefault();
        //requestOpenUrl(link.href);
        console.log(context());
      }
    };
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    //move toolbar to make room for upload/download buttons
    const firstButton = document.querySelector(".ironcalc button");
    const toolbar = firstButton?.parentElement;
    if (toolbar) {
      toolbar.style.marginLeft = "64px";
      toolbar.style.paddingLeft = "4px";
    }
  }, [model]); //todo when to run this?

  if (model === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
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
    } catch (e) {
      console.error(e);
      addToast("Unexpected error uploading spreadsheet.", "error");
    } finally {
      // Clear the input so the same file can be selected again
      e.target.value = "";
    }
  }

  async function handleDownload() {
    try {
      const bytes = model?.toXlsx();
      if (!bytes) return;
      await requestDownload(`${model?.getName()}.xlsx`, bytes);
    } catch (e) {
      console.error(e);
      addToast("Unexpected error downloading spreadsheet.", "error");
    }
  }

  const buttonClassName = "mock-ironcalc-button";

  return (
    <div className="flex h-screen w-screen flex-col">
      <div className="absolute z-50 flex h-12 items-center gap-1 border-b border-[#E0E0E0] pl-3">
        <button
          className={buttonClassName}
          onClick={() => setShowUploadConfirm(true)}
        >
          <Upload />
          <span className="sr-only">Upload File</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
          accept=".xlsx,.xls"
        />
        <button className={buttonClassName} onClick={handleDownload}>
          <Download />
          <span className="sr-only">Download File</span>
        </button>
      </div>
      <div className="ironcalc grow">
        <IronCalc model={model} />
      </div>
      <Toasts className="top-2" ref={toastsRef} />
      {showUploadConfirm && (
        <UploadConfirm
          setShowUploadConfirm={setShowUploadConfirm}
          fileInputRef={fileInputRef}
        />
      )}
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
