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
import { ChatDisplay } from "./Chat.js";

function App({ urlParams, userBalance, userBalanceRemainingDays }) {
  const [confirm, setConfirm] = useState(null);
  const [risk, setRisk] = useState(null);
  const [modal, setModal] = useState("");
  /*
  messages is an array of objects with keys:
  - role: "user", "assistant", or "display"
  - tags: an array of objects [{tag?: string, content: string}] representing a message
    - [{tag: 'logs', content: '...'}, {tag: 'user_request', content: '...'}] represents '<logs>...</logs><user_request>...</user_request>'
    - [{content: 'hello'}, {tag: 'final_script', content: '...'}] represents 'hello<final_script>...</final_script>'
  - promptToContinue: boolean indicating whether the user should be prompted to let the Assistant continue
  */
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [app, setApp] = useState(null);
  const [appData, setAppData] = useState([]);

  const sandboxRef = useRef(null);
  const toastsRef = useRef(null);
  const settingsRef = useRef(null);
  const assistantRef = useRef(null);

  useEffect(() => {
    async function init() {
      // try {
      //   const savedSettings = await requestGetData("settings", {
      //     app: "magicsandbox.Assistant",
      //   });
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
        userBalance,
        userBalanceRemainingDays,
        sandboxRef,
        toastsRef,
        settingsRef,
        setConfirm,
        setRisk,
        setMessages,
        setChatLoading,
        setApp,
      });
      const { app } = urlParams;
      if (app) {
        setConfirm({
          header: `Open App ${app}?`,
          message: `The link you opened includes a request to open this App`,
          callback: (response) => {
            setConfirm(null);
            if (response) {
              assistantRef.current.handleApp({ app });
            }
          },
        });
      }
      const appData = await requestGetData("appData", {
        app: "magicsandbox.Assistant",
      });
      setAppData(appData || []);
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
      {messages.length === 0 && app === null && (
        <Home
          {...{
            setModal,
            settingsRef,
            toastsRef,
            assistantRef,
            messages,
            chatLoading,
            appData,
            setAppData,
          }}
        />
      )}
      {messages.length > 0 && app === null && (
        <div className="my-4 max-w-screen-lg grow self-center">
          <ChatDisplay messages={messages} assistantRef={assistantRef} />
        </div>
      )}
      <Sandbox
        ref={sandboxRef}
        className={`w-full ${app ? "grow" : "hidden"}`}
      />
      {(messages.length > 0 || app) && (
        <BottomNavBar
          {...{
            settingsRef,
            toastsRef,
            assistantRef,
            messages,
            chatLoading,
            app,
            setAppData,
          }}
        />
      )}
      {modalComponent}
      <Toasts className="top-2" ref={toastsRef} />
    </div>
  );
}

function init({ urlParams, userBalance, userBalanceRemainingDays }) {
  createRoot(document.getElementById("root")).render(
    <App
      urlParams={urlParams}
      userBalance={userBalance}
      userBalanceRemainingDays={userBalanceRemainingDays}
    />,
  );
}

export { init };
