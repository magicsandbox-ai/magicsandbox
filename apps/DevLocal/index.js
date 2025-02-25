import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Preview } from "@magicsandbox.ai/react-sandbox";
import { Toasts } from "@components/Toasts.js";
import { Loader } from "lucide-react";
import ExternalLink from "@components/ExternalLink.js";

function DocsLink({ children }) {
  return (
    <ExternalLink
      href="https://github.com/magicsandbox-ai/magicsandbox/blob/main/packages/js/dev/README.md"
      className="text-blue-600 hover:underline"
    >
      {children}
    </ExternalLink>
  );
}

function App({ urlParams }) {
  const [state, setState] = useState("");
  const [widthClass, setWidthClass] = useState("w-full");

  const previewRef = useRef(null);
  const toastsRef = useRef(null);
  const portRef = useRef(null);
  const tokenRef = useRef(null);

  useEffect(() => {
    async function init() {
      try {
        const { port, token } = urlParams;
        if (!port || !token) {
          setState("error");
          return;
        }
        portRef.current = port;
        tokenRef.current = token;
        await previewApp();
      } catch (error) {
        console.error(error);
        previewRef.current.error(error.message);
      }
    }
    init();
  }, []);

  async function previewApp(update = true) {
    const sandboxId = previewRef.current.getSandboxId();
    let response;
    try {
      response = await requestFetch(`http://localhost:${portRef.current}`, {
        headers: {
          "x-token": tokenRef.current,
        },
      });
    } catch (error) {
      console.error(error);
      throw new Error("Unexpected error. Is your development server running?");
    }
    if (response.status >= 400) {
      throw new Error(response.body.error);
    }
    const appObj = response.body;
    if (update) {
      previewRef.current.update(sandboxId, appObj);
    }
    return appObj;
  }

  async function handleUpdate() {
    try {
      previewRef.current.reload();
      await previewApp();
    } catch (error) {
      console.error(error);
      previewRef.current.error(error.message);
    }
  }

  async function handlePublish() {
    try {
      previewRef.current.reload();
      const sandboxId = previewRef.current.getSandboxId();
      const appObj = await previewApp(false);
      await requestPublish(appObj);
      toastsRef.current.addToast("Successfully published!", "success");
      previewRef.current.update(sandboxId, appObj);
    } catch (error) {
      console.error(error);
      toastsRef.current.addToast("Failed to publish", "error");
      previewRef.current.error(error.message);
    }
  }

  //todo a lot of this is duplicated in Dev
  function handleResizePreview(platform) {
    if (platform === "desktop") {
      setWidthClass("w-full");
    } else if (platform === "mobile") {
      setWidthClass("w-[360px]");
    } else if (platform === "tablet") {
      //768 is the most common tablet width, but need to add 2 pixels for border
      //otherwise tailwind md breakpoint of 768 is not triggered
      setWidthClass("w-[770px]");
    } else {
      throw new Error(`Invalid platform: ${platform}`);
    }
  }

  const buttonStyle =
    "w-32 rounded-lg border border-stone-700 bg-stone-100 py-0.5 font-semibold text-sm";

  if (state === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-lg font-semibold text-stone-700">
        <p>
          magicsandbox.DevLocal is intended for use with the{" "}
          <DocsLink>@magicsandbox.ai/dev</DocsLink> package.
        </p>
        <p>Your URL is invalid. It should include a port and a token.</p>
        <p>
          You may have navigated to this page directly. Refer to the{" "}
          <DocsLink>docs</DocsLink> for help getting started.
        </p>
      </div>
    );
  }

  privateApi.previewRef = previewRef;

  return (
    <div className="flex h-screen flex-col items-center text-stone-700">
      <div className="flex w-full items-center justify-center gap-12 border-b border-stone-500 px-2 py-0.5">
        <button className={buttonStyle} onClick={handleUpdate}>
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
      <Preview
        ref={previewRef}
        className={`grow ${widthClass} ${widthClass === "w-full" ? "" : "border-x border-stone-500"}`}
        loadingIndicator={<Loader className="h-10 w-10 animate-spin" />}
        initState="loading"
      />
      <Toasts className="top-2" ref={toastsRef} />
    </div>
  );
}

async function init() {
  const urlParams = await requestUrlParams();
  createRoot(document.getElementById("root")).render(
    <App urlParams={urlParams} />,
  );
}

const privateApi = {
  previewRef: null,
};

async function context() {
  //get context from Sandbox and return it
  const sandbox = privateApi.previewRef.current.sandboxRef.current;
  const sandboxId = sandbox.getSandboxId();
  return await sandbox.getContext(sandboxId, 10000);
}

async function messageHandler(event) {
  if (privateApi.previewRef === null) return; //this is the app.init call which we don't want to intercept
  //this executes the script in the Sandbox such that the Assistant doesn't know DevLocal is in between them
  //but to do so, it relies on implementation details in sandbox.js
  //which is not ideal, but not sure how to improve it
  if (
    event.data.id &&
    event.data.msg?.request === "script" &&
    event.data.msg.data?.script
  ) {
    const { script, args } = event.data.msg.data;
    //remove id so that this function handles the message, not the default handler
    //this must be synchronous before any awaits in this function
    const id = event.data.id;
    delete event.data.id;
    const sandbox = privateApi.previewRef.current.sandboxRef.current;
    const sandboxId = sandbox.getSandboxId();
    const response = await sandbox.executeScriptAndWaitForResponse({
      sandboxId,
      script,
      args,
      timeout: 30000,
    });
    event.source.postMessage({ id, response }, "*");
  }
}

export { init, context, messageHandler };
