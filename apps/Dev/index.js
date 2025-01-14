/* global requestFetch, requestGetAllKeysData, requestGetData, requestPutData, requestDeleteData, requestPublish, requestDownload */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import CodeEditor from "./CodeEditor.js";
import { Preview } from "@magicsandbox.ai/react-sandbox";
import { historyField } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import FilePicker from "./FilePicker.js";
import * as esbuild from "esbuild-wasm";
import {
  buildApp,
  getDefaults,
  runProcessTailwind,
} from "@magicsandbox.ai/dev/buildApp";
import { createBundleDepsPlugin, createImportPlugin } from "./plugins.js";
import JSON5 from "json5";
import processTailwindBrowser from "@magicsandbox.ai/tailwind-browser";
import prettier from "prettier/standalone";
import babelParser from "prettier/plugins/babel";
import estreeParser from "prettier/plugins/estree";
import { Loader } from "lucide-react";

/*
AI chat
  window.setChat
  codemirror merge?
  ctrl enter to chat, pops open chat panel, ctrl s closes it?
  https://aider.chat/docs/repomap.html
  automated screenshot and multi modal chat? html2canvas or html-to-image?

how to get client frame in certain state? so I can develop function B that sits on top of function A?
  maybe special mock up function call? server does its thing, App ignores reset, frame saves globals rather than scripts

support vue, others?

add errors besides just console - toast

pull down published functions?

store panel sizes? https://react-resizable-panels.vercel.app/examples/external-persistence

versioning saves? isomorphic-git?

create a package lock file?
*/

async function initEsbuild() {
  const esbuildWasmResponse = await requestFetch(
    "https://esm.sh/esbuild-wasm@0.23.1/esbuild.wasm",
    { responseType: "bytes" },
  );
  return await WebAssembly.compile(esbuildWasmResponse.body).then((module) => {
    esbuild.initialize({ wasmModule: module });
  });
}

const esbuildPromise = initEsbuild();

const debounce = (callback, wait) => {
  let timeoutId = null;
  let isFirstCall = true;
  return (...args) => {
    if (isFirstCall) {
      isFirstCall = false;
      callback.apply(null, args); //run immediately on init
    } else {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        callback.apply(null, args);
      }, wait);
    }
  };
};

const exampleFiles = {
  "magic.json": `{
  name: 'HelloWorld',
  version: '0.1.0',
  description: '',
}`,
  "index.js": `import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <div className="flex h-screen items-center justify-center">
      Hello, world!
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
  `,
};

function App() {
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [files, setFiles] = useState({});
  const [selectedFilename, setSelectedFilename] = useState("magic.json");
  const [tailwindState, setTailwindState] = useState({
    processedCss: "",
    classMap: {},
  });
  const [isLoading, setIsLoading] = useState(false);

  const previewRef = useRef(null);
  const deletedFilesRef = useRef({});
  const appObjRef = useRef(null);
  const contextRef = useRef(null);
  const filesRef = useRef(files);
  const editorRef = useRef(null);
  const editorStateRef = useRef({});
  const appsFilesMapRef = useRef(null);
  const bundleDepsPluginRef = useRef(null);
  const bundledDepsRef = useRef(null);
  const importPluginRef = useRef(null);
  const tailwindConfigRef = useRef(null);

  useEffect(() => {
    initData();
  }, []);

  const debouncedCallProcessTailwind = useCallback(
    debounce(callProcessTailwind, 500),
    [],
  );

  useEffect(() => {
    if (Object.keys(files).length > 0) {
      //don't bother on initial render
      filesRef.current = files;
      api.files = filesRef.current;
      debouncedCallProcessTailwind();
    }
  }, [files]);

  useEffect(() => {
    bundleDepsPluginRef.current = createBundleDepsPlugin(
      filesRef,
      appObjRef,
      esbuild,
      bundledDepsRef,
    );
    importPluginRef.current = createImportPlugin(filesRef, appObjRef);
  }, []);

  const filenames = Object.keys(files);
  const value = files[selectedFilename];
  const initialState = {
    json: editorStateRef.current[selectedApp + selectedFilename]?.state,
    fields: { history: historyField },
  };

  async function initData() {
    const exampleObj = JSON5.parse(exampleFiles["magic.json"]);
    const exampleApp = `${exampleObj.name}@${exampleObj.version}`;
    let initApps, initSelectedApp, initFiles;
    try {
      initApps = await requestGetAllKeysData("magicsandbox.Dev");
      initApps = initApps.filter((key) => key !== "selectedApp");
      if (initApps.length === 0) {
        throw new Error(); //fall back to examples
      }
      initSelectedApp = await requestGetData("magicsandbox.Dev", "selectedApp");
      initSelectedApp = initSelectedApp || initApps[0];
      initFiles = await requestGetData("magicsandbox.Dev", initSelectedApp);
      if (!initFiles) {
        initApps.push(exampleApp);
        initSelectedApp = exampleApp;
        initFiles = exampleFiles;
      }
    } catch {
      initApps = [exampleApp];
      initSelectedApp = exampleApp;
      initFiles = exampleFiles;
    }
    setApps(initApps);
    setSelectedApp(initSelectedApp);
    setFiles(initFiles);
    //need this in case user deletes all other functions
    appsFilesMapRef.current = { exampleApp: exampleFiles }; //todo save more in here in case no indexeddb?
    return { initApps, initSelectedApp, initFiles };
  }

  async function callProcessTailwind() {
    let appObj;
    try {
      appObj = JSON5.parse(filesRef.current["magic.json"]);
    } catch {
      return; //user may be editing magic.json and it could be in an invalid state, just skip
    }
    appObj = await getDefaults(appObj);
    //this is only used for tailwind tooltips, so skip building tailwind.config.js
    //not worth the slow build that potentially makes network requests
    setTailwindState(
      await runProcessTailwind(
        appObj,
        (filename) => filename in filesRef.current,
        (filename) => filesRef.current[filename],
        (config, css) => processTailwind(config, css, true),
      ),
    );
  }

  async function processTailwind(config, css, _skipBuild = false) {
    //config is magic.json tailwindConfig, but if tailwind.config.js exists, use that instead
    if (filesRef.current["tailwind.config.js"]) {
      try {
        //if skipBuild is true, skip the build, or if file hasn't changed, skip the build
        const skipBuild =
          _skipBuild ||
          filesRef.current["tailwind.config.js"] === tailwindConfigRef.current;
        if (!skipBuild) {
          const configResult = await esbuild.build({
            entryPoints: ["tailwind.config.js"],
            write: false,
            plugins: [importPluginRef.current],
            bundle: true,
            globalName: "__tailwindConfig",
          });
          eval?.(configResult.outputFiles[0].text); //indirect eval
          tailwindConfigRef.current = filesRef.current["tailwind.config.js"];
        }
        config = window.__tailwindConfig?.default || {};
      } catch (error) {
        console.error(`Error building tailwind.config.js`, error); //todo toast
      }
    }
    const excludeContent = new Set(config.excludeContent || []);
    config.content = Object.entries(filesRef.current)
      .filter(
        ([filename]) =>
          (filename.endsWith(".js") ||
            filename.endsWith(".jsx") ||
            filename.endsWith(".html")) &&
          !excludeContent.has(filename),
      )
      .map(([filename, value]) => {
        const filenameSplit = filename.split(".");
        return {
          raw: value,
          extension: filenameSplit[filenameSplit.length - 1],
        };
      });
    //tailwind caches and skips if content hasn't changed, but it's not picking up changes in style.css (probably due to fs not working in browser)
    //so this is a hack to change content every time to force rerun and always pick up changes in style.css
    if (config.content.length > 0) {
      config.content[0].raw += Date.now();
    }
    return await processTailwindBrowser(config, css);
  }

  function deleteFile(filename) {
    console.log(
      `${filename} deleted, add a file with the exact same name to recover the deleted code.`,
    );
    deletedFilesRef.current[filename] = files[filename];
    const nextFiles = { ...files };
    delete nextFiles[filename];
    setFiles(nextFiles);
    handleSelectFilename("magic.json");
  }

  function addFile(filename) {
    const nextFiles = { ...files };
    if (deletedFilesRef.current[filename]) {
      nextFiles[filename] = deletedFilesRef.current[filename];
    } else {
      nextFiles[filename] = "";
    }
    setFiles(nextFiles);
    handleSelectFilename(filename);
  }

  function handleSelectFilename(filename) {
    editorStateRef.current[selectedApp + selectedFilename] = {
      state: editorRef.current.view.state.toJSON({ history: historyField }),
      scroll: {
        top: editorRef.current.view.scrollDOM?.scrollTop,
        left: editorRef.current.view.scrollDOM?.scrollLeft,
      },
    };
    setSelectedFilename(filename);
  }

  function handleCreateEditor(view) {
    view.scrollDOM?.scrollTo(
      editorStateRef.current[selectedApp + selectedFilename]?.scroll,
    );
    view.focus();
  }

  function onChange(value) {
    const newFiles = { ...files, [selectedFilename]: value };
    setFiles(newFiles);
  }

  async function handleKeyDown(event) {
    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      await handleSave();
    } else if (event.ctrlKey && event.key === "Enter") {
      document.getElementById("magic-input").focus();
    }
  }

  async function handleSave() {
    const appObj = JSON5.parse(files["magic.json"]);
    if (!appObj.name || !appObj.version) {
      throw new Error("magic.json must have name and version");
    }
    const app = `${appObj.name}@${appObj.version}`;
    let newFiles = files;
    if (
      selectedFilename.endsWith(".js") ||
      selectedFilename.endsWith(".jsx") ||
      selectedFilename.endsWith(".json")
      //todo add typescript?
    ) {
      try {
        const { formatted, cursorOffset } = await prettier.formatWithCursor(
          files[selectedFilename],
          {
            filepath: selectedFilename,
            plugins: [babelParser, estreeParser],
            cursorOffset: editorRef.current.view.state.selection.main.head,
          },
        );
        const yMargin =
          editorRef.current.view?.coordsAtPos(cursorOffset)?.top || 5;
        //need to do this in one transaction to prevent scroll flicker
        editorRef.current.view?.dispatch({
          changes: {
            from: 0,
            to: files[selectedFilename].length,
            insert: formatted || "",
          },
          selection: { anchor: cursorOffset, head: cursorOffset },
          effects: [
            EditorView.scrollIntoView(cursorOffset, {
              y: "start",
              yMargin,
            }),
          ],
        });
        newFiles = { ...files, [selectedFilename]: formatted };
        setFiles(newFiles);
      } catch (error) {
        console.error(`Prettier error: ${error}`);
      }
    }
    requestPutData("magicsandbox.Dev", app, newFiles); //todo handle database full
    await build();
    if (!apps.includes(app)) {
      setApps([app, ...apps]);
      setSelectedApp(app);
      requestPutData("magicsandbox.Dev", "selectedApp", app);
    }
  }

  async function handleSelectApp(app) {
    try {
      let newFiles;
      if (appsFilesMapRef.current[app]) {
        newFiles = appsFilesMapRef.current[app];
      } else {
        newFiles = await requestGetData("magicsandbox.Dev", app);
      }
      setFiles(newFiles);
      setSelectedApp(app);
      requestPutData("magicsandbox.Dev", "selectedApp", app);
      handleSelectFilename("magic.json", app);
      deletedFilesRef.current = {};
    } catch (error) {
      console.error(`handleSelectApp ${app} error`, error);
    }
  }

  async function deleteApp(app) {
    const newApps = apps.filter((a) => a !== app);
    if (newApps.length === 0) {
      await requestDeleteData("magicsandbox.Dev", app);
      const { initSelectedApp } = initData(); //get default example
      handleSelectApp(initSelectedApp);
      setApps([initSelectedApp]);
    } else {
      setApps(newApps);
      handleSelectApp(newApps[0]);
      requestDeleteData("magicsandbox.Dev", app);
    }
  }

  async function handlePublish() {
    try {
      const appObj = await build({
        minify: true,
        sourcemap: false,
      });
      requestPublish(appObj);
    } catch (error) {
      console.error(error);
    }
  }

  async function build(esbuildOptions) {
    try {
      setIsLoading(true);
      previewRef.current.reload();
      const sandboxId = previewRef.current.getSandboxId();
      let _appObj = JSON5.parse(files["magic.json"]);
      delete _appObj?.esbuildOptions?.plugins; //not supported
      _appObj.optimizedTreeShaking = true; //todo remove
      appObjRef.current = _appObj; //update for plugins
      await esbuildPromise;
      const { appObj, context } = await buildApp({
        appObj: _appObj,
        esbuild: esbuild,
        esbuildOptions: {
          plugins: [bundleDepsPluginRef.current, importPluginRef.current],
          minify: false,
          sourcemap: true,
          ...esbuildOptions,
        },
        context: contextRef.current,
        fileExists: (filename) => filename in files,
        readFile: (filename) => files[filename],
        processTailwind,
      });
      contextRef.current = context;
      previewRef.current.update(sandboxId, appObj);
    } catch (error) {
      //todo
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const buttonStyle =
    "w-32 rounded-lg border border-stone-700 bg-stone-100 py-0.5 font-semibold text-sm";
  const panelResizeHandleStyle = "w-px bg-stone-500";

  return (
    <div
      className="flex h-screen flex-col text-stone-700"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center border-b border-stone-500 px-2 py-0.5">
        <div className="flex-1" /> {/* spacer */}
        <div className="flex gap-12">
          <button className={buttonStyle} onClick={handleSave}>
            Update Preview
          </button>
          <button className={buttonStyle} onClick={handlePublish}>
            Publish
          </button>
        </div>
        <div className="flex flex-1 justify-end">
          {isLoading ? (
            <Loader className="animate-spin" />
          ) : (
            <i className="text-xs">Ctrl+S to save and refresh preview</i>
          )}
        </div>
      </div>
      <PanelGroup
        className="grow"
        direction="horizontal"
        style={{ height: "100vh", width: "100vw" }}
      >
        <Panel className="flex flex-col">
          <FilePicker
            apps={apps}
            deleteApp={deleteApp}
            selectedApp={selectedApp}
            handleSelectApp={handleSelectApp}
            filenames={filenames}
            selectedFilename={selectedFilename}
            setSelectedFilename={handleSelectFilename}
            deleteFile={deleteFile}
            addFile={addFile}
          />
          <CodeEditor
            className="grow overflow-auto"
            key={selectedApp + selectedFilename}
            ref={editorRef}
            initialState={initialState.json ? initialState : undefined}
            handleCreateEditor={handleCreateEditor}
            value={value}
            onChange={onChange}
            selectedFilename={selectedFilename}
            cssClassMap={tailwindState.classMap || {}}
          />
        </Panel>
        <PanelResizeHandle className={panelResizeHandleStyle} />
        <Panel>
          <Preview ref={previewRef} className="h-full" />
        </Panel>
      </PanelGroup>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));

function context() {
  //todo what if files too large?
  return `The user is editing the below files:

<files>
${Object.entries(api.files)
  .map(
    ([filename, value]) => `<${filename}>
${value}
</${filename}>`,
  )
  .join("\n")}
</files>

API:

- app.api.download(): download files to the user's computer

Usage:

- If the user is asking a question about the code, answer it and don't run any scripts.
- Otherwise, use the API to complete the user's request.
`;
}

const api = {
  download: () => {
    Object.entries(api.files).forEach(([filename, content]) => {
      requestDownload({ filename, content });
    });
  },
};

function render() {
  root.render(<App />);
}

render(); //initial render

export { context, api, render };
