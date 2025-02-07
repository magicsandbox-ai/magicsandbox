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

const sampleMessages = [
  {
    role: "user",
    tags: [
      {
        tag: "user_request",
        content: "can you write me a function in JS to compute a factorial?",
      },
    ],
  },
  {
    role: "assistant",
    tags: [
      {
        content: `I can help with that! Here's a simple function in JavaScript to compute a factorial:

~~~javascript
function factorial(n) {
    if (n < 0) {
        return 'Factorial is not defined for negative numbers';
    }
    return n === 0 ? 1 : n * factorial(n - 1);
}
~~~

If you need a more complex implementation or want to test it, I can open the magicsandbox.Dev app for you to work on it. Would you like me to do that?`,
      },
    ],
  },
  {
    role: "user",
    tags: [
      {
        tag: "user_request",
        content:
          "what is it called when you call in a function inside of itself like that?",
      },
    ],
  },
  {
    role: "assistant",
    tags: [
      {
        content: `When a function calls itself within its own definition, it is referred to as "recursion." In your factorial function example, the function factorial is calling itself to compute the factorial of the number. If you have any more questions about recursion or need further assistance, feel free to ask!`,
      },
    ],
  },
  {
    role: "user",
    tags: [
      {
        tag: "user_request",
        content: `what does this part of the code do?

n === 0 ? 1 : n * factorial(n - 1)`,
      },
    ],
  },
  {
    role: "assistant",
    tags: [
      {
        content: `This part of the code uses a ternary operator, which is a shorthand for an if-else statement. Here's what it does:

n === 0 ? 1: This checks if n is equal to 0. If it is, the expression evaluates to 1.
: n * factorial(n - 1): If n is not equal to 0, the expression proceeds to this part, which multiplies n by the result of calling the factorial function with the argument n - 1.
So, the whole line can be understood as follows:

If n is 0, return 1 (the base case of the factorial).
If n is greater than 0, return the product of n and the factorial of n - 1, thus continuing the recursion until it reaches the base case.
This effectively calculates the factorial of n recursively. If you need any further clarification or have more questions, feel free to ask!`,
      },
    ],
  },
];

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
  const [messages, setMessages] = useState(sampleMessages);
  const [chatLoading, setChatLoading] = useState(false);
  const [app, setApp] = useState(true);
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
      {messages.length === 0 && !app && (
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
        className={`w-full ${app ? "grow" : "hidden"}`}
      />
      {(messages.length > 0 || app) && (
        <Chat
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
