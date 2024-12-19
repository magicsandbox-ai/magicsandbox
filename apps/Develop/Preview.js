import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from "react";
import Sandbox from "components/Sandbox.js";
import requestHandler from "./requestHandler.js";

const Preview = forwardRef(function Preview({ className }, ref) {
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
    };
  }, []);

  function getSandboxId() {
    return sandboxRef.current.getSandboxId();
  }

  function reload() {
    sandboxRef.current.reload();
  }

  function update(sandboxId, appObj) {
    appObjRef.current = appObj;
    sandboxRef.current.postMessage(sandboxId, {
      script: appObj.script,
      html: appObj.html,
      style: appObj.style,
      args: appObj.args,
    });
  }

  return (
    <div className={className}>
      <Sandbox ref={sandboxRef} className="h-full w-full" />
    </div>
  );
});

export default Preview;
