import React, {
  useState,
  useRef,
  useEffect,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { Sandbox, type SandboxRef } from "@magicsandbox.ai/react-sandbox";
import AssistantConfirm from "./AssistantConfirm.tsx";
import AssistantSearch from "./AssistantSearch.tsx";
import RiskConfirm from "./RiskConfirm.tsx";
import DeleteConfirm from "./DeleteConfirm.tsx";
import { Toasts, type ToastsRef, ToastError } from "@components/Toasts.tsx";
import { includeMetadata, Assistant } from "./Assistant.js";
import Home from "./Home.tsx";
import BottomChat from "./BottomChat.tsx";
import { ChatDisplay } from "./ChatDisplay.tsx";
import ChatHistory from "./ChatHistory.tsx";
import { createWelcomeConversation } from "./welcomeMessage.ts";
import { Discover, discoverMetadata } from "./Discover.tsx";
import { ErrorBoundary } from "react-error-boundary";
import AppModal from "./AppModal.tsx";
import ChatToolbar from "./ChatToolbar.tsx";
import { models } from "./ModelPicker.tsx";
import { startDriver } from "./driver.ts";
import {
  AssistantState,
  type Conversation,
  type AppData,
  type DiscoverApp,
  type AssistantRef,
  type User,
  type Confirm,
  type RiskState,
} from "./AssistantState.ts";

interface DatabaseSchema {
  docked?: boolean;
  appData?: AppData;
  selectedModel?: string;
  popularAppData?: {
    ts: number;
    apps: DiscoverApp[];
  };
  lastMetadataRefresh?: Date;
}

async function init({ user }: { user?: User } = {}) {
  const [urlParams, initData] = await Promise.all([
    requestUrlParams(),
    requestGetAllData<DatabaseSchema>({
      app: "magicsandbox.Assistant",
    }),
  ]);
  let initConversation: Conversation = {
    conversationId: String(Date.now()), //numeric keys are coerced to string, so make id a string to avoid bugs
    messages: [],
    summary: null,
    lastUpdated: Date.now(),
  };
  //if (!("0" in initData)) {
  if (true) {
    initConversation = createWelcomeConversation();
    requestPutData(initConversation.conversationId, initConversation, {
      app: "magicsandbox.Assistant",
      evictionPolicy: "fifo",
    }).catch(console.error);
  }
  const initConversations = {
    [initConversation.conversationId]: initConversation,
    ...Object.fromEntries(
      Object.entries(initData).filter(([, v]) => v.conversationId),
    ),
  };
  const assistantState = new AssistantState({
    app: urlParams._app ? false : null,
  });
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary
      fallback={
        <div className="flex h-screen items-center justify-center font-bold">
          😬 Unexpected error occurred. Sorry! Please try again.
        </div>
      }
    >
      <App
        user={user}
        urlParams={urlParams}
        initData={initData}
        initConversation={initConversation}
        initConversations={initConversations}
        assistantState={assistantState}
      />
    </ErrorBoundary>,
  );
}

function App({
  user,
  urlParams,
  initData,
  initConversation,
  initConversations,
  assistantState,
}: {
  user?: User;
  urlParams: { [key: string]: string };
  initData: DatabaseSchema;
  initConversation: Conversation;
  initConversations: Record<string, Conversation>;
  assistantState: AssistantState;
}) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [risk, setRisk] = useState<RiskState | null>(null);
  const [currentConversation, setCurrentConversation] = useState({
    conversationId: initConversation.conversationId,
    messages: initConversation.messages,
  });
  const [conversationSummaries, setConversationSummaries] = useState(
    Object.entries(initConversations)
      .sort(([, a], [, b]) => (b.lastUpdated || 0) - (a.lastUpdated || 0))
      .map(([conversationId, conversation]) => ({
        conversationId,
        summary: conversation.summary,
      })),
  );
  const [collapsed, setCollapsed] = useState(true);
  const [docked, setDocked] = useState(
    window.innerWidth > 768 && (initData.docked || false),
  );
  const [chatLoading, setChatLoading] = useState(false);
  const app = useSyncExternalStore(
    assistantState.subscribe("app"),
    assistantState.getSnapshot("app"),
  );
  const [appData, setAppData] = useState(
    initData.appData || {
      "magicsandbox.Notes": {
        id: "magicsandbox.Notes", //missing version, which is potentially problematic. but currently id is only used in validateAndDefaultRequest
        app: "magicsandbox.Notes",
        description:
          "Take notes, create to-do lists, organize documents, and more",
        favorited: Date.now(),
      },
      "magicsandbox.Sheets": {
        id: "magicsandbox.Sheets",
        app: "magicsandbox.Sheets",
        description: "Create and edit spreadsheets",
        favorited: Date.now(),
      },
      "magicsandbox.Dev": {
        id: "magicsandbox.Dev",
        app: "magicsandbox.Dev",
        description: "Develop, preview, and publish a Magic Sandbox App",
        favorited: Date.now(),
      },
    },
  );
  const [model, setModel] = useState(
    initData.selectedModel && models[initData.selectedModel]
      ? initData.selectedModel
      : "auto",
  );
  const [showDelete, setShowDelete] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [showApps, setShowApps] = useState(false);
  const [popularAppData, setPopularAppData] = useState<{
    ts: number;
    apps: DiscoverApp[];
  }>(initData.popularAppData || { ts: 0, apps: [] }); // {ts, apps}
  const [showChatHistory, setShowChatHistory] = useState(
    window.innerWidth > 768,
  );
  const [showWelcomeTooltip, setShowWelcomeTooltip] = useState(
    initConversation.conversationId === "0" &&
      Boolean(urlParams._app) &&
      !navigator.webdriver,
  );

  const firstRenderRef = useRef(true);
  const sandboxRef = useRef<SandboxRef>(null);
  const toastsRef = useRef<ToastsRef>(null);
  const appDataRef = useRef(appData);
  const conversationsRef = useRef(initConversations);
  const currentConversationRef = useRef(currentConversation);
  const conversationSummariesRef = useRef(conversationSummaries);
  const modelRef = useRef(model);
  const shouldFocusCollapseButtonRef = useRef(false);
  const assistantRef = useRef<AssistantRef>(null as unknown as AssistantRef);
  if (assistantRef.current === null) {
    //@ts-ignore
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
      setAppData,
      initData,
      assistantState,
    });
  }

  useEffect(() => {
    if (firstRenderRef.current) {
      try {
        if (urlParams._app) {
          assistantRef.current.handleApp({ app: urlParams._app });
        }
      } catch (error: any) {
        console.error(error);
        if (error instanceof ToastError) {
          toastsRef.current?.addToast(error.message, error.type);
        } else {
          toastsRef.current?.addToast("Error: please try again", "error");
        }
      }
    }
  }, []);

  useEffect(() => {
    function handleRequest(event: MessageEvent) {
      if (!(event.data.id && event.data.msg?.request)) return;
      assistantRef.current.handleRequest(event);
    }
    sandboxRef.current!.addListener(handleRequest);
    return () => sandboxRef.current?.removeListener(handleRequest);
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== parent) return;
      if (event.data.message === "reload") {
        assistantRef.current.reload();
      } else if (event.data.message === "user") {
        assistantRef.current.user = event.data.user;
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    currentConversationRef.current = currentConversation;
  }, [currentConversation]);

  useEffect(() => {
    conversationSummariesRef.current = conversationSummaries;
  }, [conversationSummaries]);

  useEffect(() => {
    if (!firstRenderRef.current) {
      requestPutData("docked", docked, {
        app: "magicsandbox.Assistant",
        evictionPolicy: "fifo",
      }).catch(console.error);
    }
  }, [docked]);

  useEffect(() => {
    appDataRef.current = appData;
    if (!firstRenderRef.current) {
      requestPutData("appData", appData, {
        app: "magicsandbox.Assistant",
        evictionPolicy: "fifo",
      }).catch(console.error);
    }
  }, [appData]);

  useEffect(() => {
    modelRef.current = model;
    if (!firstRenderRef.current) {
      requestPutData("selectedModel", model, {
        app: "magicsandbox.Assistant",
        evictionPolicy: "fifo",
      }).catch(console.error);
    }
  }, [model]);

  useEffect(() => {
    async function refreshPublishedApps() {
      try {
        if (
          user &&
          user.name &&
          (user.lastPublished?.getTime() ?? 0) >
            (initData.lastMetadataRefresh?.getTime() ?? 0) &&
          !navigator.webdriver
        ) {
          const metadata = await requestMetadata(
            user.name,
            //@ts-ignore - todo
            includeMetadata,
            {
              kind: "app",
              includePrivate: true,
            },
          );
          setAppData((appData) => {
            const newAppData = { ...appData };
            metadata.forEach((m) => {
              const app = m.id.split("@")[0]!;
              newAppData[app] = {
                ...newAppData[app],
                ...m,
                app,
                published: newAppData[app]?.published || Date.now(),
              };
            });
            return newAppData;
          });
          await requestPutData("lastMetadataRefresh", user.lastPublished, {
            app: "magicsandbox.Assistant",
            evictionPolicy: "fifo",
          });
        }
      } catch (error) {
        console.error(error);
      }
    }
    if (firstRenderRef.current) {
      refreshPublishedApps();
    }
  }, []);

  useEffect(() => {
    async function refreshPopularApps() {
      try {
        if (
          Date.now() - popularAppData.ts > 1000 * 60 * 60 * 24 * 7 &&
          !navigator.webdriver
        ) {
          const { result } = await requestFunction<DiscoverApp[]>(
            "magicsandbox.discover@0.0",
            {
              includeMetadata: discoverMetadata,
              kind: "app",
              limit: 100,
            },
          );
          const newPopularAppData = {
            ts: Date.now(),
            apps: result,
          };
          setPopularAppData(newPopularAppData);
          await requestPutData("popularAppData", newPopularAppData, {
            app: "magicsandbox.Assistant",
            evictionPolicy: "fifo",
          });
        }
      } catch (error) {
        console.error(error);
      }
    }
    if (firstRenderRef.current) {
      refreshPopularApps();
    }
  }, []);

  useEffect(() => {
    //todo handle if opening an app
    if (
      firstRenderRef.current &&
      initConversation.conversationId === "0" &&
      !navigator.webdriver
    ) {
      startDriver(assistantRef);
    }
  }, []);

  useEffect(() => {
    firstRenderRef.current = false;
  }, []);

  const messages = currentConversation.messages;

  let modalComponent;
  if (confirm) {
    //@ts-ignore - used for testing
    if (window._AUTO_CONFIRM) {
      confirm.callback?.(true);
    } else {
      modalComponent = (
        <AssistantConfirm confirm={confirm} setConfirm={setConfirm} />
      );
    }
  } else if (risk) {
    //@ts-ignore - used for testing
    if (window._AUTO_CONFIRM) {
      risk.callback?.(true);
    } else {
      modalComponent = <RiskConfirm risk={risk} setRisk={setRisk} />;
    }
  } else if (showDelete) {
    modalComponent = (
      <DeleteConfirm
        assistantRef={assistantRef}
        setShowDelete={setShowDelete}
        currentConversation={currentConversation}
      />
    );
  } else if (showSearch) {
    modalComponent = (
      <AssistantSearch
        setShowSearch={setShowSearch}
        assistantRef={assistantRef}
        conversationsRef={conversationsRef}
      />
    );
  } else if (showDiscover) {
    modalComponent = (
      <Discover
        setShowDiscover={setShowDiscover}
        assistantRef={assistantRef}
        popularApps={popularAppData?.apps}
        appData={appData}
      />
    );
  } else if (showApps) {
    modalComponent = (
      <AppModal
        setShowApps={setShowApps}
        appData={appData}
        setAppData={setAppData}
        assistantRef={assistantRef}
      />
    );
  }

  return (
    <div className="flex h-screen">
      {app === null && (
        <ChatHistory
          {...{
            conversationSummaries,
            currentConversationId: currentConversation.conversationId,
            model,
            setModel,
            assistantRef,
            setShowSearch,
            setShowDelete,
            show: showChatHistory,
            setShow: setShowChatHistory,
          }}
        />
      )}
      <div
        id="main-container"
        className="flex min-w-0 grow flex-col overflow-y-auto"
        onClick={() => {
          if (window.innerWidth <= 768 && showChatHistory) {
            setShowChatHistory(false);
          }
        }}
      >
        {messages.length === 0 && app === null && (
          <Home
            {...{
              toastsRef,
              assistantRef,
              chatLoading,
              appData,
              setAppData,
              setShowDiscover,
            }}
          />
        )}
        <div className="flex min-h-0 grow">
          <Sandbox
            ref={sandboxRef}
            className={`w-[1024px] ${app !== null ? "grow" : "hidden"}`}
          />
          {((messages.length > 0 && app === null) ||
            (docked && !collapsed)) && (
            <div
              className={`flex w-[336px] min-w-0 grow flex-col ${
                app !== null ? "border-l border-stone-500" : ""
              }`}
            >
              {app !== null && (
                <ChatToolbar
                  containerClassName="mx-3 mt-3 flex items-center justify-between gap-2"
                  {...{
                    model,
                    setModel,
                    assistantRef,
                    docked,
                    setDocked,
                    setCollapsed,
                    shouldFocusCollapseButtonRef,
                  }}
                />
              )}
              <ChatDisplay
                key={currentConversation.conversationId}
                outerClassName="py-6 flex grow flex-col items-center"
                innerClassName="w-full max-w-screen-lg"
                messages={messages}
                assistantRef={assistantRef}
                chatLoading={chatLoading}
              />
            </div>
          )}
        </div>
        {(messages.length > 0 || app !== null) && (
          <BottomChat
            {...{
              collapsed,
              setCollapsed,
              shouldFocusCollapseButtonRef,
              docked,
              setDocked,
              toastsRef,
              assistantRef,
              messages,
              chatLoading,
              app,
              model,
              setModel,
              setShowDiscover,
              setShowApps,
              showWelcomeTooltip,
              setShowWelcomeTooltip,
            }}
          />
        )}
        {modalComponent}
      </div>
      <Toasts className="top-2" ref={toastsRef} />
    </div>
  );
}

export { init };
