import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Sandbox } from "@magicsandbox.ai/react-sandbox";
import AssistantConfirm from "./AssistantConfirm.js";
import AssistantSearch from "./AssistantSearch.js";
import RiskConfirm from "./RiskConfirm.js";
import { Toasts } from "@components/Toasts.js";
import { Assistant } from "./Assistant.js";
import Home from "./Home.js";
import BottomChat from "./BottomChat.js";
import { ChatDisplay } from "./ChatDisplay.js";
import ChatHistory from "./ChatHistory.js";
import { formatAsDollars, getMinCost } from "./utils.js";
import { welcomeMessage } from "./welcomeMessage.js";
import Discover from "./Discover.js";

async function init({ user } = {}) {
  const urlParams = await requestUrlParams();
  const initData = await requestGetAllData({
    app: "magicsandbox.Assistant",
  });
  const initConversation = {
    conversationId: Date.now(),
    messages: [],
    summary: null,
    lastUpdated: Date.now(),
  };
  if (Object.keys(initData).length === 0) {
    const message = await welcomeMessage(urlParams._app);
    initConversation.messages.push({
      role: "assistant",
      tags: [{ content: message }],
    });
    initConversation.summary = "Welcome to Magic Sandbox!";
    initConversation.welcome = true;
    requestPutData(initConversation.conversationId, initConversation, {
      app: "magicsandbox.Assistant",
    }).catch(console.error);
  }
  createRoot(document.getElementById("root")).render(
    <App
      user={user}
      urlParams={urlParams}
      initData={initData}
      initConversation={initConversation}
    />,
  );
}

function App({ user, urlParams, initData, initConversation }) {
  const [confirm, setConfirm] = useState(null);
  const [risk, setRisk] = useState(null);
  /*
  conversationsRef maintains all the conversation data. it's an object mapping conversationIds to objects with keys:
  - conversationId
  - messages: see below
  - summary: summary of the first user message
  - lastUpdated: timestamp of the last message
  - welcome: boolean

  messages is an array of objects with keys:
  - role: "user", "assistant", "display"
  - tags: an array of objects [{tag?: string, content: string}] representing a message
    - [{tag: 'logs', content: '...'}, {tag: 'user_request', content: '...'}] represents '<logs>...</logs><user_request>...</user_request>'
    - [{content: 'hello'}, {tag: 'final_script', content: '...'}] represents 'hello<final_script>...</final_script>'
  - promptToContinue: boolean indicating whether the user should be prompted to let the Assistant continue
  - model: the model used to generate the message

  currentConversation is an object with keys:
  - conversationId
  - messages

  conversationSummaries is an array of objects with keys, sorted by lastUpdated timestamp descending:
  - conversationId
  - summary
  */
  const [currentConversation, setCurrentConversation] = useState({
    conversationId: initConversation.conversationId,
    messages: initConversation.messages,
  });
  const [conversationSummaries, setConversationSummaries] = useState([
    {
      conversationId: initConversation.conversationId,
      summary: initConversation.summary,
    },
  ]);
  const [collapsed, setCollapsed] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  //app can be null, false, or an App, so be careful with boolean checks
  //false is a signal to indicate an app is loading, so don't show a flash of the home page or full screen chat
  //type App {id, app, description, minCost, status, favorited, recent, published, blocked}} //todo add versions somehow?
  //app is author.name - todo need a better name for this and to clean up usage. confusing whether it refers to the string or the object
  const [app, setApp] = useState(urlParams._app ? false : null);
  const [appData, setAppData] = useState({}); // {[app: string]: App}
  const [model, setModel] = useState("auto");
  const [showSearch, setShowSearch] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);

  const sandboxRef = useRef(null);
  const toastsRef = useRef(null);
  const assistantRef = useRef(null);
  const appDataRef = useRef({});
  const conversationsRef = useRef({
    [initConversation.conversationId]: initConversation,
  });
  const currentConversationRef = useRef(currentConversation);
  const conversationSummariesRef = useRef(conversationSummaries);
  const modelRef = useRef(null);

  useEffect(() => {
    async function init() {
      const appData = initData.appData || {
        "magicsandbox.Notes": {
          //id not needed?
          app: "magicsandbox.Notes",
          description:
            "Take notes, create to-do lists, organize documents, and more",
          minCost: 0.001,
          status: "active",
          favorited: Date.now(),
        },
      };
      appDataRef.current = appData;
      setAppData(appData);
      const model = initData.selectedModel || "auto";
      modelRef.current = model;
      setModel(model);
      assistantRef.current = new Assistant({
        user,
        sandboxRef,
        toastsRef,
        appDataRef,
        conversationsRef,
        currentConversationRef,
        conversationSummariesRef,
        modelRef,
        setConfirm,
        setRisk,
        setCurrentConversation,
        setConversationSummaries,
        setChatLoading,
        setCollapsed,
        setApp,
        setAppData,
      });
      const { _app } = urlParams;
      if (_app && !initConversation.welcome) {
        let appString = _app.split("@")[0];
        const [author, name] = appString.split(".");
        appString = `${author}.${name[0].toUpperCase()}${name.slice(1)}`;
        const app = appData[appString] || { app: appString };
        let maxCost = app.minCost;
        let messages = [
          "The link you opened includes a request to open this App",
        ];
        if (app.blocked) {
          messages.push("This App is blocked");
        } else if (app.favorited || app.published) {
          messages = []; //no need to confirm
        } else if (
          Date.now() - (app.recent || 0) < 1000 * 60 * 60 * 24 * 7 &&
          maxCost < 0.01
        ) {
          //todo enable user to configure thresholds
          messages = []; //opened in last week and less than a penny, no need to confirm
        } else if (!maxCost) {
          try {
            maxCost = await getMinCost(app.app);
          } catch (error) {
            console.error(error);
            toastsRef.current.addToast(`Invalid app in URL`, "warning");
          }
        }
        if (messages.length > 0 && maxCost) {
          messages.push(`${app.app} costs ${formatAsDollars(maxCost)}`);
          const message = messages.join("\n");
          setConfirm({
            header: `Open App ${app.app}?`,
            message,
            callback: (response) => {
              setConfirm(null);
              if (response) {
                assistantRef.current.handleApp({ app: app.app, maxCost });
              }
            },
          });
        } else if (maxCost) {
          assistantRef.current.handleApp({ app: app.app, maxCost });
        }
      }
      conversationsRef.current = {
        ...conversationsRef.current, //keep initConversation
        ...Object.fromEntries(
          Object.entries(initData).filter(([, v]) => v.conversationId),
        ),
      };
      setConversationSummaries(
        Object.entries(conversationsRef.current)
          .sort(([, a], [, b]) => b.lastUpdated - a.lastUpdated)
          .map(([conversationId, conversation]) => ({
            conversationId,
            summary: conversation.summary,
          })),
      );
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
    return () => sandboxRef.current?.removeListener(handleRequest);
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
    currentConversationRef.current = currentConversation;
  }, [currentConversation]);

  useEffect(() => {
    conversationSummariesRef.current = conversationSummaries;
  }, [conversationSummaries]);

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
    if (modelRef.current) {
      //on mount, modelRef.current is null, and model is auto - don't save
      requestPutData("selectedModel", model, {
        app: "magicsandbox.Assistant",
        evictionPolicy: "fifo",
      }).catch(console.error);
    }
    modelRef.current = model;
  }, [model]);

  const messages = currentConversation.messages;

  let modalComponent;
  if (confirm) {
    modalComponent = <AssistantConfirm confirm={confirm} />;
  } else if (risk) {
    modalComponent = <RiskConfirm risk={risk} />;
  } else if (showSearch) {
    modalComponent = (
      <AssistantSearch
        setShowSearch={setShowSearch}
        assistantRef={assistantRef}
        conversationsRef={conversationsRef}
      />
    );
  } else if (showDiscover) {
    modalComponent = <Discover setShowDiscover={setShowDiscover} />;
  }

  return (
    <main className="flex h-screen">
      {app === null && (
        <ChatHistory
          {...{
            conversationSummaries,
            currentConversationId: currentConversation.conversationId,
            model,
            setModel,
            assistantRef,
            setShowSearch,
          }}
        />
      )}
      <div className="flex grow flex-col">
        {messages.length === 0 && app === null && (
          <Home
            {...{
              toastsRef,
              assistantRef,
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
            setShowDiscover={setShowDiscover}
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
    </main>
  );
}

export { init };
