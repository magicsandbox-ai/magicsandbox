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
  updateMagicJson,
  exampleAppFiles,
} from "@magicsandbox.ai/dev";
import { createBundleDepsPlugin, createImportPlugin } from "./plugins.js";
import JSON5 from "json5";
import processTailwindBrowser from "@magicsandbox.ai/tailwind-browser";
import prettier from "prettier/standalone";
import babelParser from "prettier/plugins/babel";
import estreeParser from "prettier/plugins/estree";
import { Loader } from "lucide-react";
import { prompt } from "./prompt.js";
import { context as _context } from "./context.js";
import {
  createApp as _createApp,
  updateFiles as _updateFiles,
  additionalContext as _additionalContext,
  advancedDocs as _advancedDocs,
} from "./api.js";

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

exampleAppFiles["magic.json"] = exampleAppFiles["magic.json5"];
delete exampleAppFiles["magic.json5"];

function App() {
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [files, setFiles] = useState({});
  const [merges, setMerges] = useState({});
  const [selectedFilename, setSelectedFilename] = useState("magic.json");
  const [tailwindState, setTailwindState] = useState({
    processedCss: "",
    classMap: {},
  });

  const previewRef = useRef(null);
  const previewPanelRef = useRef(null);
  const deletedFilesRef = useRef({});
  const appObjRef = useRef(null);
  const esbuildContextRef = useRef(null);
  const filesRef = useRef(files);
  const editorRef = useRef(null);
  const editorStateRef = useRef({});
  const bundleDepsPluginRef = useRef(null);
  const bundledDepsRef = useRef(null);
  const importPluginRef = useRef(null);
  const tailwindConfigRef = useRef(null);
  // const previewLogsRef = useRef(null);

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

  async function initData(handleDelete) {
    const exampleObj = JSON5.parse(exampleAppFiles["magic.json"]);
    const exampleApp = `${exampleObj.name}@${exampleObj.version}`;
    let initApps, initSelectedApp, initFiles;
    if (!handleDelete) {
      try {
        initApps = await requestGetAllKeysData();
        initApps = initApps.filter((key) => key !== "selectedApp");
        if (initApps.length === 0) {
          throw new Error(); //fall back to examples
        }
        initSelectedApp = await requestGetData("selectedApp");
        initSelectedApp = initSelectedApp || initApps[0];
        initFiles = await requestGetData(initSelectedApp);
        if (!initFiles) {
          initApps.push(exampleApp);
          initSelectedApp = exampleApp;
          initFiles = exampleAppFiles;
        }
      } catch {
        initApps = [exampleApp];
        initSelectedApp = exampleApp;
        initFiles = exampleAppFiles;
      }
    } else {
      initApps = [exampleApp];
      initSelectedApp = exampleApp;
      initFiles = exampleAppFiles;
    }
    setApps(initApps);
    setSelectedApp(initSelectedApp);
    setFiles(initFiles);
    setMerges({});
    setSelectedFilename("magic.json");
  }

  async function callProcessTailwind() {
    let appObj;
    try {
      appObj = JSON5.parse(filesRef.current["magic.json"]);
    } catch {
      return; //user may be editing magic.json and it could be in an invalid state, just skip
    }
    appObj = await getDefaults(appObj);
    privateApi.scriptFile = appObj.scriptFile;
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
    //tailwind caches and skips if content hasn't changed, but it's not picking up changes in index.css (probably due to fs not working in browser)
    //so this is a hack to change content every time to force rerun and always pick up changes in index.css
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
    ) {
      try {
        const { formatted, cursorOffset } = await prettier.formatWithCursor(
          files[selectedFilename],
          {
            filepath:
              selectedFilename === "magic.json"
                ? "magic.json5"
                : selectedFilename,
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
    requestPutData(app, newFiles); //todo handle database full
    if (!apps.includes(app)) {
      setApps([app, ...apps]);
      setSelectedApp(app);
      requestPutData("selectedApp", app);
    }
    await build(appObj);
  }

  async function handleSelectApp(app) {
    try {
      const newFiles = await requestGetData(app);
      setFiles(newFiles);
      setSelectedApp(app);
      setMerges({});
      requestPutData("selectedApp", app);
      handleSelectFilename("magic.json", app);
      deletedFilesRef.current = {};
    } catch (error) {
      console.error(`handleSelectApp ${app} error`, error);
    }
  }

  async function deleteApp(app) {
    const newApps = apps.filter((a) => a !== app);
    if (newApps.length === 0) {
      await initData(true); //get example app
    } else {
      setApps(newApps);
      handleSelectApp(newApps[0]);
    }
    await requestDeleteData(app);
  }

  async function handlePublish() {
    try {
      const _appObj = JSON5.parse(files["magic.json"]);
      await build(_appObj, true);
    } catch (error) {
      console.error(error);
      previewRef.current.error(error.message);
    }
  }

  async function build(_appObj, publish) {
    try {
      if (_appObj.update) {
        console.log("Build skipped when update is true"); //todo show user
        return _appObj;
      }
      previewRef.current.reload();
      const sandboxId = previewRef.current.getSandboxId();
      delete _appObj?.esbuildOptions?.plugins; //not supported
      appObjRef.current = _appObj; //update for plugins
      await esbuildPromise;
      const { appObj, context } = await buildApp({
        appObj: _appObj,
        esbuild: esbuild,
        esbuildOptions: {
          plugins: [bundleDepsPluginRef.current, importPluginRef.current],
          minify: false,
          sourcemap: true,
          ...(publish ? { minify: true, sourcemap: false } : {}),
        },
        context: esbuildContextRef.current,
        fileExists: (filename) => filename in files,
        readFile: (filename) => files[filename],
        processTailwind,
      });
      if (appObjRef.current.dependencies) {
        //dependencies updated by buildApp
        setFiles((files) => ({
          ...files,
          "magic.json": updateMagicJson(files["magic.json"], (obj) => {
            obj.dependencies = appObjRef.current.dependencies;
          }),
        }));
      }
      esbuildContextRef.current = context;
      if (publish) {
        delete appObj.esbuildOptions; //plugins can't be serialized and cause an error
        await requestPublish(appObj);
      }
      await previewRef.current.update(sandboxId, appObj);
      /*
      todo this doesn't work because the Async Function with use strict cannot create the global app variable
      either fix it, or remove the extra logic from Preview.js
      */
      // const { logs } = await previewRef.current.update(
      //   sandboxId,
      //   appObj,
      //   10000,
      // );
      // previewLogsRef.current = logs;
    } catch (error) {
      console.error(error);
      previewRef.current.error(error.message);
    }
  }

  function handleResizePreview(platform) {
    let targetWidth;
    if (platform === "desktop") {
      previewPanelRef.current.resize(100);
      return;
    } else if (platform === "mobile") {
      targetWidth = 360;
    } else if (platform === "tablet") {
      //768 is the most common tablet width, but need to add some wiggle room because resize is not exact
      //otherwise tailwind md breakpoint of 768 is not triggered
      targetWidth = 770;
    } else {
      throw new Error(`Invalid platform: ${platform}`);
    }
    previewPanelRef.current.resize((targetWidth / window.innerWidth) * 100);
  }

  privateApi.setApps = setApps;
  privateApi.setSelectedApp = setSelectedApp;
  privateApi.files = files;
  privateApi.setFiles = setFiles;
  privateApi.setMerges = setMerges;
  privateApi.selectedFilename = selectedFilename;
  privateApi.setSelectedFilename = setSelectedFilename;
  privateApi.build = build;

  const filenames = Object.keys(files).map((filename) => ({
    filename,
    merge: Boolean(merges[filename]),
  }));
  const value = files[selectedFilename];
  const merge = merges[selectedFilename];
  const setMerge = (nextMerge) => {
    let nextMerges;
    if (nextMerge) {
      nextMerges = { ...merges, [selectedFilename]: nextMerge };
    } else {
      nextMerges = { ...merges };
      delete nextMerges[selectedFilename];
    }
    setMerges(nextMerges);
  };
  const initialState = {
    json: editorStateRef.current[selectedApp + selectedFilename]?.state,
    fields: { history: historyField },
  };

  const buttonStyle =
    "w-32 rounded-lg border border-stone-700 bg-stone-100 py-0.5 font-semibold text-sm";
  const panelResizeHandleStyle = "w-px bg-stone-500";

  return (
    <div
      className="flex h-screen flex-col text-stone-700"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center border-b border-stone-500 px-2 py-0.5">
        <div className="flex flex-1">
          <i className="text-xs">Ctrl+S to save and update preview</i>
        </div>
        <div className="flex gap-12">
          <button className={buttonStyle} onClick={handleSave}>
            Update Preview
          </button>
          <button
            className={buttonStyle}
            onClick={() => handleResizePreview("mobile")}
          >
            Preview Mobile
          </button>
          <button
            className={buttonStyle}
            onClick={() => handleResizePreview("tablet")}
          >
            Preview Tablet
          </button>
          <button
            className={buttonStyle}
            onClick={() => handleResizePreview("desktop")}
          >
            Preview Desktop
          </button>
          <button className={buttonStyle} onClick={handlePublish}>
            Publish
          </button>
        </div>
        <div className="flex-1" /> {/* spacer */}
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
            merge={merge}
            setMerge={setMerge}
          />
        </Panel>
        <PanelResizeHandle className={panelResizeHandleStyle} />
        <Panel ref={previewPanelRef}>
          <Preview
            ref={previewRef}
            className="h-full"
            loadingIndicator={<Loader className="h-10 w-10 animate-spin" />}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}

const privateApi = {};

function init({ input, budget, urlParams }) {
  createRoot(document.getElementById("root")).render(
    <App input={input} budget={budget} urlParams={urlParams} />,
  );
  return prompt();
}

function context() {
  return _context(privateApi);
}

const api = {
  createApp: (name, description, createString) => {
    _createApp(privateApi, name, description, createString);
  },
  updateFiles: (updateString) => {
    _updateFiles(privateApi, updateString);
  },
  additionalContext: ({ files, code }) => {
    _additionalContext(privateApi, { files, code });
  },
  advancedDocs: () => {
    _advancedDocs();
  },
};

function messageHandler(event) {
  if (event.data.msg?.data?.script) {
    event.data.msg.data.script = event.data.msg.data.script.replace(
      /```([\s\S]*?)```/g,
      (_, p1) => {
        return JSON.stringify(p1); //handle escaping inside triple backticks
      },
    );
  }
}

export { init, context, api, messageHandler };
