/* global requestGetData, requestUrlParams */

import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Sandbox } from "@magicsandbox.ai/react-sandbox";
import BottomNavBar from "./BottomNavBar.js";
import AssistantSettings from "./AssistantSettings.js";
import AssistantConfirm from "./AssistantConfirm.js";
import { Toasts } from "@components/Toasts.js";
import { Assistant } from "./Assistant.js";

/*
App
  Handles Sandbox requests
  Auth
  Generate API key
  Payments
  Manages settings: which Assistant to use
  Initiates the Assistant
  Syncs data
  Welcome modal if first visit
  Displays payments?
Assistant
  Creates UI, handles input
  Confirms Sandbox requests
  Manages settings: bangs (plus maxCost), trust (apps and authors?), some built in bangs?
  Display functions on page?
*/

const defaultSettings = {
  findApp: "magicsandbox.findApp",
  appWeights: {},
  bangs: {},
  trust: new Set(),
  privacyRiskUserActionThreshold: 5,
};

function App() {
  const [modal, setModal] = useState("");
  const [confirm, setConfirm] = useState(null);
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
          savedSettings.trust = new Set(savedSettings.trust);
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
        setMessage,
      });
      /* urlParams */
      const { input, app } = await requestUrlParams();
      if (input || app) {
        //todo need better UX if budget is less than maxCost - maybe prompt user to approve?
        await assistantRef.current.handleInput({ input, app });
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
    function handleUserAction(event) {
      const userAction = event.data.userAction;
      if (userAction) {
        assistantRef.current.handleUserAction({ userAction });
      }
    }
    sandboxRef.current.addListener(handleUserAction);
    return () => sandboxRef.current.removeListener(handleUserAction);
  }, []);

  function setMessage(message) {
    setMessages((messages) => [...messages.slice(0, -1), message]);
  }

  function onSandboxLoad() {
    const sandboxId = sandboxRef.current.getSandboxId();
    const script = `
(function postUserActionToParent() {
  //use iife to avoid cluttering global scope
  let sendIsActive = false;
  let lastIsActive = false;
  ['keydown', 'pointerup'].forEach((eventType) => {
    window.addEventListener(
      eventType,
      (event) => {
        //since we've captured the event, we don't need the fallback
        if (event.isTrusted) {
          lastIsActive = true;
          sendIsActive = false;
          parent.postMessage({ userAction: 'event' }, '*');
        }
      },
      true
    );
  });
  //this is a fallback to capture user actions in nested iframes
  setInterval(() => {
    if (sendIsActive) {
      parent.postMessage({ userAction: 'isActive' }, '*');
      sendIsActive = false;
    }
    //todo handle browsers where userActivation is unsupported
    const isActive = navigator.userActivation?.isActive;
    if (isActive && !lastIsActive) {
      //technically this could run prior to the event listeners above
      //the spec requires that isActive is set prior to dispatching the event
      //so we set sendIsActive to true to send the message next time, giving the event listeners a chance to set sendIsActive to false
      sendIsActive = true;
    }
    lastIsActive = isActive;
  }, 100);
})();
    `;
    sandboxRef.current.postMessage(sandboxId, { script });
  }

  let modalComponent;
  if (confirm) {
    modalComponent = <AssistantConfirm confirm={confirm} />;
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
      <Sandbox
        ref={sandboxRef}
        className="w-full grow"
        onLoad={onSandboxLoad}
      />
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
      <Toasts ref={toastsRef} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
