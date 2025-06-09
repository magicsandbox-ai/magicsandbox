import React, {
  useState,
  useRef,
  useSyncExternalStore,
  useEffect,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  ImperativePanelHandle,
} from "react-resizable-panels";
import * as esbuild from "esbuild-wasm";
import { Loader } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";
import { Preview, type PreviewRef } from "@magicsandbox.ai/react-sandbox";
import { prompt } from "./prompt.ts";
import { context as _context } from "./context.ts";
import { Toasts, ToastError, type ToastsRef } from "@components/Toasts.tsx";
import { DevState } from "./DevState.ts";
import CodeEditor from "./CodeEditor.tsx";
import FilePicker from "./FilePicker.tsx";
import Help from "./Help.tsx";
import Approve from "./Approve.tsx";

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

async function init() {
  await devState.initData();
  createRoot(document.getElementById("root")!).render(
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

function App() {
  const selectedApp = useSyncExternalStore(
    devState.subscribe("selectedApp"),
    devState.getSnapshot("selectedApp"),
  );
  const [view, setView] = useState<"code" | "preview" | undefined>(
    window.innerWidth > 768 ? undefined : "code",
  );
  const [showHelp, setShowHelp] = useState(false);
  const [testApi, setTestApi] = useState(false);

  const previewRef = useRef<PreviewRef>(null);
  const codePanelRef = useRef<ImperativePanelHandle>(null);
  const previewPanelRef = useRef<ImperativePanelHandle>(null);
  const toastsRef = useRef<ToastsRef>(null);

  useEffect(() => {
    const unregister = devState.registerBuildCallback<{
      sandboxId: number;
    }>({
      pre: async () => {
        previewRef.current!.reload();
        const sandboxId = previewRef.current!.getSandboxId();
        previewRef.current!.sandboxRef.current!.postMessage(sandboxId, {
          script: `console = new Proxy(console, {
  get(target, prop) {
    const originalMethod = target[prop];
    if (typeof originalMethod === "function") {
      return function (...args) {
        if (["log", "error", "warn", "info", "debug"].includes(prop)) {
          parent.postMessage(
            { log: \`[\${prop}] \${args.map(String).join(" ")}\` },
            "*",
          );
        } else {
          parent.postMessage(
            { log: \`[warn] console.\${prop} logs are not captured\` },
            "*",
          );
        }
        return originalMethod.apply(target, args);
      };
    }
    return originalMethod;
  },
});`,
        });
        return {
          sandboxId,
        };
      },
      post: async ({ preResult, appObj, errorMessage }) => {
        const { sandboxId } = preResult;
        if (errorMessage) {
          previewRef.current!.error(errorMessage);
          return;
        }
        if (appObj.update) {
          toastsRef.current?.addToast(
            "Build skipped when update is set to true",
            "info",
          );
          return;
        }
        previewRef.current!.update(sandboxId, appObj);
      },
    });
    return unregister;
  }, []);

  useEffect(() => {
    function handleLog(event: MessageEvent) {
      if (typeof event.data.log !== "string") return;
      if (devState.debugContext) {
        devState.debugContext.previewLogs.push(event.data.log);
      }
    }
    previewRef.current?.sandboxRef.current?.addListener(handleLog);
    return () =>
      previewRef.current?.sandboxRef.current?.removeListener(handleLog);
  }, []);

  useEffect(() => {
    //@ts-ignore
    window.app.messageHandler = async (event: MessageEvent) => {
      //this executes the script in the Sandbox such that the Assistant doesn't know Dev is in between them
      //but to do so, it relies on implementation details in sandbox.js
      //which is not ideal, but not sure how to improve it
      //todo a lot of this is duplicated in DevLocal
      if (
        testApi &&
        event.data.id &&
        event.data.msg?.request === "script" &&
        event.data.msg.data?.script
      ) {
        const { script, args } = event.data.msg.data;
        //remove id so that this function handles the message, not the default handler
        //this must be synchronous before any awaits in this function
        const id = event.data.id;
        delete event.data.id;
        const sandbox = previewRef.current!.sandboxRef.current;
        const sandboxId = sandbox!.getSandboxId();
        const response = await sandbox!.executeScriptAndWaitForResponse({
          sandboxId,
          script,
          args,
          timeout: 30000,
        });
        //@ts-ignore
        event.source.postMessage({ id, response }, "*");
      } else if (!testApi && event.data.msg?.data?.script) {
        event.data.msg.data.script = event.data.msg.data.script.replace(
          /```([\s\S]*?)```/g,
          (_: any, p1: string) => {
            return JSON.stringify(p1); //handle escaping inside triple backticks
          },
        );
      }
    };
  }, [testApi]);

  devState.errorHandler = (error) => {
    console.error(error);
    if (error instanceof ToastError) {
      toastsRef.current?.addToast(error.message, error.type);
    }
  };

  function handleResizePreview(platform: string) {
    let targetWidth;
    if (platform === "desktop") {
      previewPanelRef.current?.resize(100);
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
    previewPanelRef.current?.resize((targetWidth / window.innerWidth) * 100);
  }

  const buttonStyle =
    "px-1.5 md:px-2 py-1 text-xs md:text-sm font-medium transition-colors duration-150 border-b border-transparent hover:border-stone-500 hover:bg-stone-100";

  return (
    <div className="flex h-screen flex-col text-stone-700">
      <div className="flex justify-between border-b border-stone-500 px-2">
        <div>
          <button
            className={buttonStyle}
            onClick={() => {
              if (view === "code") {
                setView("preview");
                previewPanelRef.current?.resize(100);
                devState.buildApp();
              } else if (view === "preview") {
                setView("code");
                codePanelRef.current?.resize(100);
              } else {
                devState.buildApp();
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
              Object.entries(selectedApp.files).forEach(([filename, file]) => {
                requestDownload(filename, file.content);
              });
            }}
          >
            Download Files
          </button>
          <button
            className={buttonStyle}
            onClick={() => devState.buildApp({ publish: true })}
          >
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
            key={selectedApp.id + selectedApp.selectedFileName}
            devState={devState}
          />
          <Approve devState={devState} />
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

async function context() {
  return await _context(devState);
}

const api = {
  async createApp(...args: Parameters<DevState["apiCreateApp"]>) {
    return await devState.apiCreateApp(...args);
  },
  async updateFiles(...args: Parameters<DevState["apiUpdateFiles"]>) {
    return await devState.apiUpdateFiles(...args);
  },
  async additionalContext(
    ...args: Parameters<DevState["apiAdditionalContext"]>
  ) {
    return await devState.apiAdditionalContext(...args);
  },
  advancedDocs: () => {
    return devState.apiAdvancedDocs();
  },
};

export { init, context, api };
