import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Sandbox } from "@magicsandbox.ai/react-sandbox";
import AssistantConfirm from "./AssistantConfirm.js";
import RiskConfirm from "./RiskConfirm.js";
import { Toasts } from "@components/Toasts.js";
import { Assistant } from "./Assistant.js";
import Home from "./Home.js";
import BottomChat from "./BottomChat.js";
import { ChatDisplay } from "./ChatDisplay.js";
import ChatHistory from "./ChatHistory.js";

function App({ user, urlParams }) {
  const [confirm, setConfirm] = useState(null);
  const [risk, setRisk] = useState(null);
  /*
  conversation is an object with keys:
  - conversationId
  - summary
  - messages

  messages is an array of objects with keys:
  - role: "user", "assistant", or "display"
  - tags: an array of objects [{tag?: string, content: string}] representing a message
    - [{tag: 'logs', content: '...'}, {tag: 'user_request', content: '...'}] represents '<logs>...</logs><user_request>...</user_request>'
    - [{content: 'hello'}, {tag: 'final_script', content: '...'}] represents 'hello<final_script>...</final_script>'
  - promptToContinue: boolean indicating whether the user should be prompted to let the Assistant continue
  - model: the model used to generate the message
  */
  const [conversation, setConversation] = useState({
    conversationId: Date.now(),
    summary: null,
    messages: [],
  });
  const [collapsed, setCollapsed] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  //app can be null, false, or an App, so be careful with boolean checks
  //false is a signal to indicate an app is loading, so don't show a flash of the home page or full screen chat
  //type App {id, app, description, minCost, status, favorited, recent, published, blocked}} //todo add versions somehow?
  const [app, setApp] = useState(urlParams._app ? false : null);
  const [appData, setAppData] = useState({}); // {[app: string]: App}
  const [model, setModel] = useState("auto");

  const sandboxRef = useRef(null);
  const toastsRef = useRef(null);
  const assistantRef = useRef(null);
  const appDataRef = useRef({});
  const conversationRef = useRef(conversation);
  const conversationsRef = useRef({
    [conversation.conversationId]: conversation,
  }); // {[conversationId: string]: Conversation}
  const modelRef = useRef(model);

  useEffect(() => {
    async function init() {
      const appData = await requestGetData("appData", {
        app: "magicsandbox.Assistant",
      });
      appDataRef.current = appData || {};
      setAppData(appData || {});
      assistantRef.current = new Assistant({
        user,
        sandboxRef,
        toastsRef,
        appDataRef,
        conversationRef,
        conversationsRef,
        modelRef,
        setConfirm,
        setRisk,
        setConversation,
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
      const conversationData = await requestGetAllData({
        app: "magicsandbox.Assistant",
      });
      conversationsRef.current = Object.fromEntries(
        Object.entries(conversationData).filter(([, v]) => v.conversationId),
      );
      conversationsRef.current[conversation.conversationId] = conversation;
    }
    if (assistantRef.current === null) {
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
        evictionPolicy: "fifo",
      }).catch(console.error);
    }
  }, [appData]);

  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  const messages = conversation.messages;

  let modalComponent;
  if (confirm) {
    modalComponent = <AssistantConfirm confirm={confirm} />;
  } else if (risk) {
    modalComponent = <RiskConfirm risk={risk} />;
  }

  return (
    <div className="flex h-screen">
      {app === null && (
        <ChatHistory
          {...{
            model,
            setModel,
            assistantRef,
          }}
        />
      )}
      <div className="flex grow flex-col">
        {messages.length === 0 && app === null && (
          <Home
            {...{
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
          <ChatDisplay
            outerClassName="my-4 flex grow flex-col items-center"
            innerClassName="w-full max-w-screen-lg"
            messages={messages}
            assistantRef={assistantRef}
          />
        )}
        <Sandbox
          ref={sandboxRef}
          className={`w-full ${app !== null ? "grow" : "hidden"}`}
        />
        {(messages.length > 0 || app !== null) && (
          <BottomChat
            {...{
              collapsed,
              setCollapsed,
              toastsRef,
              assistantRef,
              messages,
              chatLoading,
              app,
              model,
              setModel,
            }}
          />
        )}
        {modalComponent}
        <Toasts className="top-2" ref={toastsRef} />
      </div>
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
