import React, {
  useState,
  useRef,
  useEffect,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { X } from "lucide-react";
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
import DivButton from "./DivButton.tsx";
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
  seenTutorial?: boolean;
}

declare global {
  interface Window {
    _TESTING?: {
      seenTutorial?: boolean;
      initApp?: string;
    };
  }
}

async function init({ user }: { user?: User } = {}) {
  const [urlParams, initData] = await Promise.all([
    requestUrlParams(),
    requestGetAllData<DatabaseSchema>({
      app: "magicsandbox.Assistant",
    }),
  ]);
  const initConversations = {
    ...Object.fromEntries(
      Object.entries(initData).filter(([, v]) => v.conversationId),
    ),
  };
  let initConversation: Conversation = {
    conversationId: String(Date.now()), //numeric keys are coerced to string, so make id a string to avoid bugs
    messages: [],
    summary: null,
    lastUpdated: Date.now(),
  };
  const seenTutorial =
    window._TESTING?.seenTutorial || initData.seenTutorial || false;
  const initApp = window._TESTING?.initApp || urlParams._app;
  if (!("0" in initData)) {
    if (!seenTutorial && !initApp && !navigator.webdriver) {
      //start the tutorial by setting initConversation to the welcome conversation
      initConversation = createWelcomeConversation();
    } else {
      //we're not going to start the tutorial, but we still want the welcome conversation to exist
      const welcomeConversation = createWelcomeConversation();
      initConversations[welcomeConversation.conversationId] =
        welcomeConversation;
    }
  }
  initConversations[initConversation.conversationId] = initConversation;
  const assistantState = new AssistantState({
    initConversation,
    initConversations,
    app: initApp ? false : null,
    showChatHistory: window.innerWidth >= 768,
    seenTutorial,
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
        initApp={initApp}
        initData={initData}
        assistantState={assistantState}
      />
    </ErrorBoundary>,
  );
}

function App({
  user,
  initApp,
  initData,
  assistantState,
}: {
  user?: User;
  initApp: string | undefined;
  initData: DatabaseSchema;
  assistantState: AssistantState;
}) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [risk, setRisk] = useState<RiskState | null>(null);
  const currentConversation = useSyncExternalStore(
    assistantState.subscribe("currentConversation"),
    assistantState.getSnapshot("currentConversation"),
  );
  const chatCollapsed = useSyncExternalStore(
    assistantState.subscribe("chatCollapsed"),
    assistantState.getSnapshot("chatCollapsed"),
  );
  const [docked, setDocked] = useState(
    window.innerWidth >= 768 && (initData.docked || false),
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
  const showChatHistory = useSyncExternalStore(
    assistantState.subscribe("showChatHistory"),
    assistantState.getSnapshot("showChatHistory"),
  );
  const isDriverActive = useSyncExternalStore(
    assistantState.subscribe("isDriverActive"),
    assistantState.getSnapshot("isDriverActive"),
  );
  const showTutorialTooltip = useSyncExternalStore(
    assistantState.subscribe("showTutorialTooltip"),
    assistantState.getSnapshot("showTutorialTooltip"),
  );

  const firstRenderRef = useRef(true);
  const sandboxRef = useRef<SandboxRef>(null);
  const toastsRef = useRef<ToastsRef>(null);
  const appDataRef = useRef(appData);
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
      modelRef,
      setConfirm,
      setRisk,
      setChatLoading,
      setAppData,
      initData,
      assistantState,
    });
  }

  useEffect(() => {
    if (firstRenderRef.current) {
      try {
        if (initApp) {
          assistantRef.current.handleApp({ app: initApp });
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
    if (toastsRef.current) {
      assistantState.addToast = toastsRef.current.addToast;
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
        assistantState={assistantState}
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
            assistantState,
            currentConversationId: currentConversation.conversationId,
            model,
            setModel,
            assistantRef,
            setShowSearch,
            setShowDelete,
            show: showChatHistory,
            setShow: (show) => assistantRef.current.setShowChatHistory(show),
          }}
        />
      )}
      <div
        className="flex min-w-0 grow flex-col overflow-y-auto"
        onClick={() => {
          if (window.innerWidth < 768 && showChatHistory) {
            assistantRef.current.setShowChatHistory(false);
          }
        }}
      >
        {messages.length === 0 && app === null && (
          <Home
            {...{
              toastsRef,
              assistantRef,
              assistantState,
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
            (docked && !chatCollapsed)) && (
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
                    assistantState,
                    docked,
                    setDocked,
                    shouldFocusCollapseButtonRef,
                  }}
                />
              )}
              {messages[0]?.welcome && app === null && !isDriverActive && (
                <button
                  className="absolute right-4 top-3 z-10 rounded-xl border-2 border-stone-800 bg-stone-600 px-2 py-0.5 text-sm font-medium text-white shadow hover:bg-stone-700 md:py-1 md:text-base"
                  onClick={() => {
                    assistantRef.current.driver.drive();
                  }}
                >
                  Restart tutorial
                </button>
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
              chatCollapsed,
              shouldFocusCollapseButtonRef,
              docked,
              setDocked,
              toastsRef,
              assistantRef,
              assistantState,
              messages,
              chatLoading,
              app,
              model,
              setModel,
              setShowDiscover,
              setShowApps,
            }}
          />
        )}
        {modalComponent}
      </div>
      <Toasts className="top-2" ref={toastsRef} />
      {showTutorialTooltip && (
        <DivButton
          className="group absolute right-4 top-3 whitespace-pre rounded-lg bg-stone-600 px-2 py-1 text-center text-sm font-medium text-white shadow hover:bg-stone-700"
          onPress={() => {
            //todo clean this up
            assistantRef.current.driver.drive();
            assistantState.setShowTutorialTooltip(false);
          }}
        >
          <button
            className="absolute right-1 top-1 hidden rounded bg-stone-200 text-stone-700 hover:bg-stone-300 group-hover:block"
            onClick={() => {
              assistantState.setShowTutorialTooltip(false);
            }}
          >
            <X className="lucide-ignore size-4" />
            <span className="sr-only">Dismiss</span>
          </button>
          Welcome to Magic Sandbox!
          <br />
          Click to start tutorial
        </DivButton>
      )}
    </div>
  );
}

export { init };
