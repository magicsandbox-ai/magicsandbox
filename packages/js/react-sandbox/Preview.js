import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
} from "react";
import { Sandbox } from "./Sandbox.js";
import { requestHandler } from "./requestHandler.js";

const Preview = forwardRef(function Preview(
  { className, loadingIndicator = <p>Loading...</p>, initState = "ready" },
  ref,
) {
  const [state, setState] = useState(initState); // "ready", "loading", or an error message

  const sandboxRef = useRef(null);
  const appObjRef = useRef(null);
  const requestAppRef = useRef({});
  const requestFunctionRef = useRef({});
  const requestDataRef = useRef({});

  useEffect(() => {
    function _requestHandler(event) {
      requestHandler({
        event,
        sandboxRef,
        appObjRef,
        requestAppRef,
        requestFunctionRef,
        requestDataRef,
      });
    }
    sandboxRef.current.addListener(_requestHandler);
    return () => sandboxRef.current?.removeListener(_requestHandler);
  }, []);

  useImperativeHandle(ref, () => {
    return {
      getSandboxId,
      reload,
      update,
      error,
      sandboxRef,
    };
  }, []);

  function getSandboxId() {
    return sandboxRef.current.getSandboxId();
  }

  function reload() {
    setState("loading");
    sandboxRef.current.reload();
  }

  async function update(sandboxId, appObj, timeout) {
    appObjRef.current = appObj;
    sandboxRef.current.postMessage(sandboxId, {
      html: appObj.html,
      style: appObj.style,
    });
    let logs;
    if (timeout) {
      try {
        ({ logs } = await sandboxRef.current.executeScriptAndWaitForResponse({
          sandboxId,
          script: appObj.script,
          timeout,
        }));
      } catch (error) {
        console.error(error);
        logs = ["[Uncaught Error] Error: script timed out"];
      }
    } else {
      sandboxRef.current.postMessage(sandboxId, {
        script: appObj.script,
      });
    }
    sandboxRef.current
      .getInit(
        sandboxId,
        {
          input: "",
          budget: 0.005,
          urlParams: {},
          ...appObj.args,
        },
        1000,
      )
      .catch(() => {}); //ignore
    setState("ready");
    return { logs };
  }

  function error(err) {
    setState(err);
  }

  return (
    <div className={className}>
      <Sandbox
        ref={sandboxRef}
        style={
          state !== "ready"
            ? { display: "none" }
            : { height: "100%", width: "100%" }
        }
      />
      {state !== "ready" && (
        <div
          style={{
            display: "flex",
            height: "100%",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {state === "loading" ? (
            loadingIndicator
          ) : (
            <>
              <p>Error loading preview:</p>
              <p>{state}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export { Preview };
