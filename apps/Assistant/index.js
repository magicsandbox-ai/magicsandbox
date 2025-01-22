/* global requestGetData, requestUrlParams */

import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Sandbox } from "@magicsandbox.ai/react-sandbox";
import BottomNavBar from "./BottomNavBar.js";
import AssistantConfirm from "./AssistantConfirm.js";
import RiskConfirm from "./RiskConfirm.js";
import AssistantSettings from "./AssistantSettings.js";
import { Toasts } from "@components/Toasts.js";
import { Assistant } from "./Assistant.js";

const defaultSettings = {
  bangs: {},
};

function App() {
  const [confirm, setConfirm] = useState(null);
  const [risk, setRisk] = useState(null);
  const [modal, setModal] = useState("");
  const [messages, setMessages] = useState([]);

  const sandboxRef = useRef(null);
  const toastsRef = useRef(null);
  const settingsRef = useRef(null);
  const assistantRef = useRef(null);

  useEffect(() => {
    async function init() {
      /* settings */
      try {
        const savedSettings = await requestGetData(
          "magicsandbox.Assistant",
          "settings",
        );
        if (savedSettings) {
          settingsRef.current = savedSettings;
        }
      } catch (error) {
        console.error(error);
        toastsRef.current.addToast(
          "Failed to load Assistant settings. Using default settings",
          "error",
        );
      } finally {
        settingsRef.current = {
          ...defaultSettings,
          ...settingsRef.current,
        };
      }
      /* assistant */
      assistantRef.current = new Assistant({
        sandboxRef,
        toastsRef,
        settingsRef,
        setConfirm,
        setRisk,
        setMessage,
      });
      /* urlParams */
      const { app } = await requestUrlParams();
      //calling handleInput in DevLocal creates an infinite loop, so only call it in top sandbox
      const isTopSandbox = parent.parent.window === parent.window;
      if (app && isTopSandbox) {
        setConfirm({
          header: `Open App ${app}?`,
          message: `${app} from URL`,
          callback: (response) => {
            setConfirm(null);
            if (response) {
              setMessages([`Loading ${app} from URL...`]);
              assistantRef.current.handleInput({ app, input: "" });
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

  function setMessage(message) {
    setMessages((messages) => [...messages.slice(0, -1), message]);
  }

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
      <Sandbox ref={sandboxRef} className="w-full grow" />
      <BottomNavBar
        {...{
          setModal,
          settingsRef,
          toastsRef,
          assistantRef,
          messages,
          setMessages,
        }}
      />
      {modalComponent}
      <Toasts className="top-2" ref={toastsRef} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
