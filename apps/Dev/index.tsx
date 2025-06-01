import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { Preview } from "@magicsandbox.ai/react-sandbox";
import { historyField } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import * as esbuild from "esbuild-wasm";
import JSON5 from "json5";
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
import { ErrorBoundary } from "react-error-boundary";
import { applyChangeSet } from "./diffExtension.ts";
import { Toasts } from "@components/Toasts.js";
import { DevState } from "./DevState.ts";
import CodeEditor from "./CodeEditor.tsx";
import FilePicker from "./FilePicker.tsx";
import Help from "./Help.tsx";

async function initEsbuild() {
  const response = await requestFetch(
    "https://esm.sh/esbuild-wasm@0.23.1/esbuild.wasm",
    { responseType: "bytes" },
  );
  const module = await WebAssembly.compile(response.body);
  await esbuild.initialize({ wasmModule: module });
  return esbuild;
}

const esbuildPromise = initEsbuild();

const devState = new DevState({
  esbuildPromise,
});

function App() {
  const [view, setView] = useState(window.innerWidth > 768 ? null : "code"); //"code" | "preview", only relevant for mobile
  const [showHelp, setShowHelp] = useState(false);
  const [testApi, setTestApi] = useState(false);

  const previewRef = useRef(null);
  const codePanelRef = useRef(null);
  const previewPanelRef = useRef(null);
  const toastsRef = useRef(null);
  // const previewLogsRef = useRef(null);

  useEffect(() => {
    initData();
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

  async function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      await handleSave();
    }
  }

  async function handlePutData(key, value) {
    try {
      await requestPutData(key, value);
    } catch (error) {
      console.error(error);
      let message = "Unexpected error saving data";
      if (error.message === "Database size limit exceeded") {
        message =
          "Error saving data: maximum storage limit reached. Delete some apps to free up space.";
      }
      toastsRef.current.addToast(message, "error");
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
    handlePutData(app, newFiles);
    if (!apps.includes(app)) {
      setApps([app, ...apps]);
      setSelectedApp(app);
      handlePutData("selectedApp", app);
    }
    await build(appObj);
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
        toastsRef.current.addToast(
          "Build skipped when update is set to true",
          "info",
        );
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
        fileExists,
        readFile,
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

  const filenames = Object.keys(files).map((filename) => ({
    filename,
    merge: Boolean(merges[filename]),
  }));
  const merge = merges[selectedFilename];
  const initialState = {
    json: editorStateRef.current[selectedApp + selectedFilename]?.state,
    fields: { history: historyField },
  };

  const buttonStyle =
    "px-1.5 md:px-2 py-1 text-xs md:text-sm font-medium transition-colors duration-150 border-b border-transparent hover:border-stone-500 hover:bg-stone-100";
  const approveButtonStyle =
    "rounded-lg border border-stone-500 py-1 text-sm w-28 font-medium";

  return (
    <div
      className="flex h-screen flex-col text-stone-700"
      onKeyDown={handleKeyDown}
    >
      <div className="flex justify-between border-b border-stone-500 px-2">
        <div>
          <button
            className={buttonStyle}
            onClick={() => {
              if (view === "code") {
                setView("preview");
                previewPanelRef.current.resize(100);
                handleSave();
              } else if (view === "preview") {
                setView("code");
                codePanelRef.current.resize(100);
              } else {
                handleSave();
              }
            }}
          >
            {view === "code"
              ? "Show Preview"
              : view === "preview"
                ? "Show Code"
                : "Update Preview"}
          </button>
          <button
            className={buttonStyle + " hidden md:inline-block"}
            onClick={() => handleResizePreview("mobile")}
          >
            Preview Mobile
          </button>
          <button
            className={buttonStyle + " hidden md:inline-block"}
            onClick={() => handleResizePreview("tablet")}
          >
            Preview Tablet
          </button>
          <button
            className={buttonStyle + " hidden lg:inline-block"}
            onClick={() => handleResizePreview("desktop")}
          >
            Preview Desktop
          </button>
          <button
            className={buttonStyle + " hidden md:inline-block"}
            onClick={() => {
              Object.entries(files).forEach(([filename, content]) => {
                requestDownload(filename, content);
              });
            }}
          >
            Download Files
          </button>
          <button className={buttonStyle} onClick={handlePublish}>
            Publish App
          </button>
          <button className={buttonStyle} onClick={() => setShowHelp(true)}>
            Help
          </button>
        </div>
        <button className={buttonStyle} onClick={() => setTestApi(!testApi)}>
          {testApi ? "Exit API Test Mode" : "Test App API"}
        </button>
      </div>
      <PanelGroup
        className="grow"
        direction="horizontal"
        style={{ height: "100vh", width: "100vw" }}
      >
        <Panel
          ref={codePanelRef}
          className="relative flex flex-col"
          defaultSize={view === "code" ? 100 : 50}
        >
          <FilePicker devState={devState} />
          <CodeEditor
            key={selectedApp + selectedFilename}
            devState={devState}
          />
          {Object.keys(merges).length > 0 && (
            <div className="absolute bottom-4 left-2 right-2 flex flex-wrap justify-center gap-2">
              <div className="flex gap-2">
                <button
                  className={`${approveButtonStyle} bg-green-200 hover:bg-green-300`}
                  onClick={() => {
                    devState.updateChangeSets(undefined);
                  }}
                >
                  Accept All Files
                </button>
                {merge && (
                  <button
                    className={`${approveButtonStyle} bg-green-200 hover:bg-green-300`}
                    onClick={() => {
                      devState.updateChangeSet(undefined);
                    }}
                  >
                    Accept File
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {merge && (
                  <button
                    className={`${approveButtonStyle} bg-red-200 hover:bg-red-300`}
                    onClick={() => {
                      devState.updateChangeSet(undefined);
                      setFiles((files) => ({
                        ...files,
                        [selectedFilename]: applyChangeSet(
                          merges[selectedFilename],
                          files[selectedFilename],
                        ),
                      }));
                    }}
                  >
                    Reject File
                  </button>
                )}
                <button
                  className={`${approveButtonStyle} bg-red-200 hover:bg-red-300`}
                  onClick={() => {
                    devState.updateChangeSets(undefined);
                    setFiles((files) => ({
                      ...files,
                      ...Object.fromEntries(
                        Object.entries(merges).map(([filename, changeSet]) => [
                          filename,
                          applyChangeSet(changeSet, files[filename]),
                        ]),
                      ),
                    }));
                  }}
                >
                  Reject All Files
                </button>
              </div>
            </div>
          )}
        </Panel>
        <PanelResizeHandle className={"w-px border-r border-stone-500"} />
        <Panel ref={previewPanelRef}>
          <Preview
            ref={previewRef}
            className="h-full"
            loadingIndicator={<Loader className="h-10 w-10 animate-spin" />}
          />
        </Panel>
      </PanelGroup>
      {showHelp && <Help setShowHelp={setShowHelp} />}
      <Toasts className="top-2" ref={toastsRef} />
    </div>
  );
}

async function init() {
  createRoot(document.getElementById("root")).render(
    <ErrorBoundary
      fallback={
        <div className="flex h-screen items-center justify-center font-bold">
          😬 Unexpected error occurred. Sorry! Please try again.
        </div>
      }
    >
      <App />
    </ErrorBoundary>,
  );
  await esbuildPromise;
  return prompt();
}

function context() {
  return _context(devState);
}

const api = {
  async createApp(name, description, createString) {
    await _createApp(devState, name, description, createString);
  },
  async updateFiles(updateString) {
    await _updateFiles(devState, updateString);
  },
  additionalContext: ({ files, code }) => {
    _additionalContext(devState, { files, code });
  },
  advancedDocs: () => {
    _advancedDocs();
  },
};

async function messageHandler(event) {
  //this executes the script in the Sandbox such that the Assistant doesn't know DevLocal is in between them
  //but to do so, it relies on implementation details in sandbox.js
  //which is not ideal, but not sure how to improve it
  //todo a lot of this is duplicated in DevLocal
  if (
    devState.testApi &&
    event.data.id &&
    event.data.msg?.request === "script" &&
    event.data.msg.data?.script
  ) {
    const { script, args } = event.data.msg.data;
    //remove id so that this function handles the message, not the default handler
    //this must be synchronous before any awaits in this function
    const id = event.data.id;
    delete event.data.id;
    const sandbox = devState.previewRef.current.sandboxRef.current;
    const sandboxId = sandbox.getSandboxId();
    const response = await sandbox.executeScriptAndWaitForResponse({
      sandboxId,
      script,
      args,
      timeout: 30000,
    });
    event.source.postMessage({ id, response }, "*");
  } else if (!devState.testApi && event.data.msg?.data?.script) {
    event.data.msg.data.script = event.data.msg.data.script.replace(
      /```([\s\S]*?)```/g,
      (_, p1) => {
        return JSON.stringify(p1); //handle escaping inside triple backticks
      },
    );
  }
}

export { init, context, api, messageHandler };
