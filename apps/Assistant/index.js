import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Sandbox } from "@magicsandbox.ai/react-sandbox";
import BottomNavBar from "./BottomNavBar.js";
import AssistantConfirm from "./AssistantConfirm.js";
import RiskConfirm from "./RiskConfirm.js";
import AssistantSettings from "./AssistantSettings.js";
import { Toasts } from "@components/Toasts.js";
import { Assistant } from "./Assistant.js";
import Home from "./Home.js";

function App({ urlParams }) {
  const [confirm, setConfirm] = useState(null);
  const [risk, setRisk] = useState(null);
  const [modal, setModal] = useState("");
  const [state, setState] = useState("home");
  /*
  messages is an array of objects with keys:
  - role: "user" or "assistant"
  - content: the content to use in the API. if not set, excluded from API call
  - displayContent: the content to display in the UI. if not set, not shown in the UI
  - promptToContinue: whether to prompt the user to allow the assistant to continue executing additional scripts
  */
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const sandboxRef = useRef(null);
  const toastsRef = useRef(null);
  const settingsRef = useRef(null);
  const assistantRef = useRef(null);

  useEffect(() => {
    async function init() {
      // try {
      //   const savedSettings = await requestGetData(
      //     "magicsandbox.Assistant",
      //     "settings",
      //   );
      //   if (savedSettings) {
      //     settingsRef.current = savedSettings;
      //   }
      // } catch (error) {
      //   console.error(error);
      //   toastsRef.current.addToast(
      //     "Failed to load Assistant settings. Using default settings",
      //     "error",
      //   );
      // } finally {
      //   settingsRef.current = {
      //     ...defaultSettings,
      //     ...settingsRef.current,
      //   };
      // }
      settingsRef.current = {};
      assistantRef.current = new Assistant({
        urlParams,
        sandboxRef,
        toastsRef,
        settingsRef,
        setConfirm,
        setRisk,
        setMessages,
        setChatLoading,
        setState,
      });
      const { app } = urlParams;
      if (app) {
        setConfirm({
          header: `Open App ${app}?`,
          message: `The link you opened includes a request to open this App`,
          callback: (response) => {
            setConfirm(null);
            if (response) {
              assistantRef.current.handleApp({
                app,
                input: "",
              });
            }
          },
        });
      }
    }
    if (!settingsRef.current) {
      init().catch((error) => {
        console.error(error);
        if (error.name === "ToastError") {
          toastsRef.current.addToast(error.message, error.type);
        } else {
          toastsRef.current.addToast("Error: please try again", "error");
        }
      });
    }
  }, []);

  useEffect(() => {
    function handleRequest(event) {
      if (!(event.data.id && event.data.msg?.request)) return;
      assistantRef.current.handleRequest(event);
    }
    sandboxRef.current.addListener(handleRequest);
    return () => sandboxRef.current.removeListener(handleRequest);
  }, []);

  useEffect(() => {
    function handleReload(event) {
      if (event.source !== parent) return;
      if (event.data === "reload") {
        assistantRef.current.reload();
      }
    }
    window.addEventListener("message", handleReload);
    return () => window.removeEventListener("message", handleReload);
  }, []);

  let modalComponent;
  if (confirm) {
    modalComponent = <AssistantConfirm confirm={confirm} />;
  } else if (risk) {
    modalComponent = <RiskConfirm risk={risk} />;
  } else if (modal === "settings") {
    modalComponent = (
      <AssistantSettings
        assistantRef={assistantRef}
        setModal={setModal}
        addToast={toastsRef.current.addToast}
      />
    );
  }
  return (
    <div className="flex h-screen w-full flex-col">
      {state === "home" && (
        <Home
          {...{
            setModal,
            settingsRef,
            toastsRef,
            assistantRef,
            messages,
            chatLoading,
          }}
        />
      )}
      <Sandbox
        ref={sandboxRef}
        className={`w-full ${state === "home" ? "hidden" : "grow"}`}
      />
      {state !== "home" && (
        <BottomNavBar
          {...{
            setModal,
            settingsRef,
            toastsRef,
            assistantRef,
            messages,
            chatLoading,
          }}
        />
      )}
      {modalComponent}
      <Toasts className="top-2" ref={toastsRef} />
    </div>
  );
}

function init({ urlParams }) {
  createRoot(document.getElementById("root")).render(
    <App urlParams={urlParams} />,
  );
}

export { init };
