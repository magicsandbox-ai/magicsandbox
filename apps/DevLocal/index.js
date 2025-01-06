/* global requestFetch requestPublish */

import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Preview } from "@magicsandbox.ai/react-sandbox";
import { Toasts } from "@components/Toasts.js";
import { Loader } from "lucide-react";

function App() {
  const [isLoading, setIsLoading] = useState(false);

  const previewRef = useRef(null);
  const toastsRef = useRef(null);

  async function handleUpdate() {
    try {
      setIsLoading(true);
      previewRef.current.reload();
      const sandboxId = previewRef.current.getSandboxId();
      const response = await requestFetch("http://localhost:3002");
      const appObj = response.body;
      previewRef.current.update(sandboxId, appObj);
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
      const sandboxId = previewRef.current.getSandboxId();
      const response = await requestFetch("http://localhost:3002");
      const appObj = response.body;
      previewRef.current.update(sandboxId, appObj);
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
