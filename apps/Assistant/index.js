import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Sandbox } from "@magicsandbox.ai/react-sandbox";
import AssistantConfirm from "./AssistantConfirm.js";
import RiskConfirm from "./RiskConfirm.js";
import AssistantSettings from "./AssistantSettings.js";
import { Toasts } from "@components/Toasts.js";
import { Assistant } from "./Assistant.js";
import Home from "./Home.js";
import Chat from "./Chat.js";

function App({ user, urlParams }) {
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
  - model: the model used to generate the message
  - summary: summary of the first user message
  */
  const [messages, setMessages] = useState([]);
  const [collapsed, setCollapsed] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  //app can be null, false, or an App, so be careful with boolean checks
  //false is a signal to indicate an app is loading, so don't show a flash of the home page or full screen chat
  //type App {id, app, description, minCost, status, favorited, recent, published, blocked}} //todo add versions somehow?
  const [app, setApp] = useState(urlParams._app ? false : null);
  const [appData, setAppData] = useState({}); // {[app: string]: App}

  const sandboxRef = useRef(null);
  const toastsRef = useRef(null);
  const settingsRef = useRef(null);
  const assistantRef = useRef(null);
  const appDataRef = useRef({});

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
      const appData = await requestGetData("appData", {
        app: "magicsandbox.Assistant",
      });
      appDataRef.current = appData || {};
      setAppData(appData || {});
      assistantRef.current = new Assistant({
        user,
        sandboxRef,
        toastsRef,
        settingsRef,
        appDataRef,
        setConfirm,
        setRisk,
        setMessages,
        setChatLoading,
        setCollapsed,
        setApp,
        setAppData,
      });
      const { _app } = urlParams;
      if (_app) {
        let app = _app.split("@")[0];
        const [author, name] = app.split(".");
        app = `${author}.${name[0].toUpperCase()}${name.slice(1)}`;
        if (
          Date.now() - (appData[app]?.recent || 0) >
          1000 * 60 * 60 * 24 * 7
        ) {
          //only ask for confirmation if the app hasn't been opened in the last week
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
        } else {
          assistantRef.current.handleApp({ app });
        }
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

  useEffect(() => {
    appDataRef.current = appData;
    if (Object.keys(appData).length > 0) {
      requestPutData("appData", appData, {
        app: "magicsandbox.Assistant",
      }).catch(console.error);
    }
  }, [appData]);

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
      <Sandbox
        ref={sandboxRef}
        className={`w-full ${app !== null ? "grow" : "hidden"}`}
      />
      {(messages.length > 0 || app !== null) && (
        <Chat
          {...{
            collapsed,
            setCollapsed,
            settingsRef,
            toastsRef,
            assistantRef,
            messages,
            chatLoading,
            app,
          }}
        />
      )}
      {modalComponent}
      <Toasts className="top-2" ref={toastsRef} />
    </div>
  );
}

async function init({ user } = {}) {
  const urlParams = await requestUrlParams();
  createRoot(document.getElementById("root")).render(
    <App user={user} urlParams={urlParams} />,
  );
}

export { init };
