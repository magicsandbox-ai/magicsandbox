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
  {
    className,
    loadingIndicator = <p>Loading...</p>, // default simple text fallback
    initState = "ready",
  },
  ref,
) {
  const [state, setState] = useState(initState);

  const sandboxRef = useRef(null);
  const appObjRef = useRef(null);
  const requestAppRef = useRef({});
  const requestFunctionRef = useRef({});
  const requestDataRef = useRef({ requestedApp: false, db: {} });

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
    };
  }, []);

  function getSandboxId() {
    return sandboxRef.current.getSandboxId();
  }

  function reload() {
    setState("loading");
    sandboxRef.current.reload();
  }

  function update(sandboxId, appObj) {
    appObjRef.current = appObj;
    sandboxRef.current.postMessage(sandboxId, {
      script: appObj.script,
      html: appObj.html,
      style: appObj.style,
      args: {
        input: "",
        budget: 0.005,
        urlParams: window.args.urlParams,
        ...appObj.args,
      },
    });
    setState("ready");
  }

  function error() {
    setState("error");
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
          {state === "loading" && loadingIndicator}
          {state === "error" && <p>Error updating preview.</p>}
        </div>
      )}
    </div>
  );
});

export { Preview };
