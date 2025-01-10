/* global requestFetch requestPublish requestUrlParams */

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

function App() {
  const [state, setState] = useState("loading");
  const [isLoading, setIsLoading] = useState(false);

  const previewRef = useRef(null);
  const toastsRef = useRef(null);
  const portRef = useRef(null);
  const tokenRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { port, token } = await requestUrlParams();
      if (!port || !token) {
        setState("error");
        return;
      }
      portRef.current = port;
      tokenRef.current = token;
      setState("ready");
    }
    init();
  }, []);

  useEffect(() => {
    async function loadPreview() {
      try {
        setIsLoading(true);
        await previewApp();
      } catch (error) {
        console.error(error);
        toastsRef.current.addToast("Failed to load preview", "error");
      } finally {
        setIsLoading(false);
      }
    }
    if (state === "ready") {
      loadPreview();
    }
  }, [state]);

  async function previewApp() {
    const sandboxId = previewRef.current.getSandboxId();
    const response = await requestFetch(`http://localhost:${portRef.current}`, {
      headers: {
        "x-token": tokenRef.current,
      },
    });
    const appObj = response.body;
    previewRef.current.update(sandboxId, appObj);
    return appObj;
  }

  async function handleUpdate() {
    try {
      setIsLoading(true);
      previewRef.current.reload();
      await previewApp();
    } catch (error) {
      console.error(error);
      toastsRef.current.addToast("Failed to update preview", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePublish() {
    try {
      setIsLoading(true);
      previewRef.current.reload();
      const appObj = await previewApp();
      await requestPublish(appObj);
      toastsRef.current.addToast("Successfully published!", "success");
    } catch (error) {
      console.error(error);
      toastsRef.current.addToast("Failed to publish", "error");
    } finally {
      setIsLoading(false);
    }
  }

  //todo a lot of this is duplicated in Dev
  const buttonStyle =
    "w-32 rounded-lg border border-stone-700 bg-stone-100 py-0.5 font-semibold text-sm";

  if (state === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-10 w-10 animate-spin" />
      </div>
    );
  }

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

  return (
    <div className="flex h-screen flex-col text-stone-700">
      <div className="flex items-center border-b border-stone-500 px-2 py-0.5">
        <div className="flex-1" /> {/* spacer */}
        <div className="flex gap-12">
          <button className={buttonStyle} onClick={handleUpdate}>
            Update Preview
          </button>
          <button className={buttonStyle} onClick={handlePublish}>
            Publish
          </button>
        </div>
        <div className="flex flex-1 justify-end">
          {isLoading && <Loader className="animate-spin" />}
        </div>
      </div>
      <Preview ref={previewRef} className="w-full grow" />
      <Toasts ref={toastsRef} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
