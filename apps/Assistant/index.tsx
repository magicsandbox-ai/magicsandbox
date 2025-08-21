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
import Home from "./Home.tsx";
import BottomChat from "./BottomChat.tsx";
import { ChatDisplay } from "./ChatDisplay.tsx";
import ChatHistory from "./ChatHistory.tsx";
import { createWelcomeConversation } from "./welcomeMessage.ts";
import { Discover, discoverMetadata } from "./Discover.tsx";
import { ErrorBoundary } from "react-error-boundary";
import AppModal from "./AppModal.tsx";
import ChatToolbar from "./ChatToolbar.tsx";
import DivButton from "./DivButton.tsx";
import {
  includeMetadata,
  AssistantState,
  type DatabaseSchema,
  type Conversation,
  type DiscoverApp,
  type User,
} from "./AssistantState.ts";

declare global {
  interface Window {
    _TESTING?: {
      seenTutorial?: boolean;
      initApp?: string;
    };
  }
}

//https://www.npmjs.com/package/nopp
[
  Object,
  Object.prototype,
  Function,
  Function.prototype,
  Array,
  Array.prototype,
  String,
  String.prototype,
  Number,
  Number.prototype,
  Boolean,
  Boolean.prototype,
].forEach(Object.freeze);

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
    window._TESTING?.seenTutorial ?? initData.seenTutorial ?? false;
  const initApp = window._TESTING?.initApp ?? urlParams._app;
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
    initData,
    initConversation,
    initConversations,
    app: initApp ? false : null,
    showChatHistory: window.innerWidth >= 768,
    seenTutorial,
    user,
    docked: window.innerWidth >= 768 && (initData.docked || false),
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
  const confirm = useSyncExternalStore(
    assistantState.subscribe("confirm"),
    assistantState.getSnapshot("confirm"),
  );
  const risk = useSyncExternalStore(
    assistantState.subscribe("risk"),
    assistantState.getSnapshot("risk"),
  );
  const currentConversation = useSyncExternalStore(
    assistantState.subscribe("currentConversation"),
    assistantState.getSnapshot("currentConversation"),
  );
  const chatCollapsed = useSyncExternalStore(
    assistantState.subscribe("chatCollapsed"),
    assistantState.getSnapshot("chatCollapsed"),
  );
  const docked = useSyncExternalStore(
    assistantState.subscribe("docked"),
    assistantState.getSnapshot("docked"),
  );
  const chatLoading = useSyncExternalStore(
    assistantState.subscribe("chatLoading"),
    assistantState.getSnapshot("chatLoading"),
  );
  const app = useSyncExternalStore(
    assistantState.subscribe("app"),
    assistantState.getSnapshot("app"),
  );
  const appData = useSyncExternalStore(
    assistantState.subscribe("appData"),
    assistantState.getSnapshot("appData"),
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
  const shouldFocusCollapseButtonRef = useRef(false);

  useEffect(() => {
    if (toastsRef.current) {
      assistantState.addToast = toastsRef.current.addToast;
    }
    if (sandboxRef.current) {
      assistantState.sandboxRef = sandboxRef.current;
    }
  }, []);

  useEffect(() => {
    if (firstRenderRef.current) {
      try {
        if (initApp) {
          assistantState.handleApp({ app: initApp });
        }
      } catch (error: any) {
        console.error(error);
        if (error instanceof ToastError) {
          assistantState.addToast(error.message, error.type);
        } else {
          assistantState.addToast("Error: please try again", "error");
        }
      }
    }
  }, []);

  useEffect(() => {
    function handleRequest(event: MessageEvent) {
      if (!(event.data.id && event.data.msg?.request)) return;
      assistantState.handleRequest(event);
    }
    sandboxRef.current!.addListener(handleRequest);
    return () => sandboxRef.current?.removeListener(handleRequest);
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== parent) return;
      if (event.data.message === "reload") {
        assistantState.reload();
      } else if (event.data.message === "user") {
        assistantState.user = event.data.user;
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

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
          const metadata = await requestMetadata(user.name, includeMetadata, {
            kind: "app",
            includePrivate: true,
          });
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
          assistantState.setAppData(newAppData);
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
        <AssistantConfirm confirm={confirm} assistantState={assistantState} />
      );
    }
  } else if (risk) {
    //@ts-ignore - used for testing
    if (window._AUTO_CONFIRM) {
      risk.callback?.(true);
    } else {
      modalComponent = (
        <RiskConfirm risk={risk} assistantState={assistantState} />
      );
    }
  } else if (showDelete) {
    modalComponent = (
      <DeleteConfirm
        assistantState={assistantState}
        setShowDelete={setShowDelete}
        currentConversation={currentConversation}
      />
    );
  } else if (showSearch) {
    modalComponent = (
      <AssistantSearch
        setShowSearch={setShowSearch}
        assistantState={assistantState}
      />
    );
  } else if (showDiscover) {
    modalComponent = (
      <Discover
        setShowDiscover={setShowDiscover}
        assistantState={assistantState}
        popularApps={popularAppData?.apps}
        appData={appData}
      />
    );
  } else if (showApps) {
    modalComponent = (
      <AppModal
        setShowApps={setShowApps}
        appData={appData}
        assistantState={assistantState}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {showTutorialTooltip && (
        <DivButton
          className="flex items-center justify-between bg-stone-600 px-2 py-1 text-center text-xs font-medium text-white shadow hover:bg-stone-700 md:text-sm"
          onPress={() => {
            assistantState.drive(app ? app.app : undefined);
            assistantState.setShowTutorialTooltip(false);
          }}
        >
          <div className="flex-1"></div>
          <p>Welcome to Magic Sandbox! Click to start tutorial</p>
          <div className="flex flex-1 items-center justify-end">
            <button
              className="rounded bg-stone-100 text-stone-700 hover:bg-stone-200"
              onClick={() => {
                assistantState.setShowTutorialTooltip(false);
              }}
            >
              <X className="lucide-ignore size-4" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        </DivButton>
      )}
      <div className="relative flex min-h-0 grow">
        {app === null && (
          <ChatHistory
            {...{
              assistantState,
              currentConversationId: currentConversation.conversationId,
              setShowSearch,
              setShowDelete,
              show: showChatHistory,
              setShow: (show) => assistantState.setShowChatHistory(show),
            }}
          />
        )}
        <div
          className="flex min-w-0 grow flex-col overflow-y-auto"
          onClick={() => {
            if (window.innerWidth < 768 && showChatHistory) {
              assistantState.setShowChatHistory(false);
            }
          }}
        >
          {messages.length === 0 && app === null && (
            <Home
              {...{
                assistantState,
                chatLoading,
                appData,
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
                      assistantState,
                      docked,
                      shouldFocusCollapseButtonRef,
                    }}
                  />
                )}
                {messages[0]?.welcome && app === null && !isDriverActive && (
                  <button
                    className="absolute right-4 top-3 z-10 rounded-xl border-2 border-stone-800 bg-stone-600 px-2 py-0.5 text-sm font-medium text-white shadow hover:bg-stone-700 md:py-1 md:text-base"
                    onClick={() => {
                      assistantState.drive();
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
                  assistantState={assistantState}
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
                assistantState,
                messages,
                chatLoading,
                app,
                setShowDiscover,
                setShowApps,
              }}
            />
          )}
          {modalComponent}
        </div>
        <Toasts className="top-2" ref={toastsRef} />
      </div>
    </div>
  );
}

export { init };
