import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  type RefObject,
} from "react";
import { Sandbox, type SandboxRef } from "./Sandbox.js";
import { requestHandler, type AppObj } from "./requestHandler.js";

type PreviewState = "ready" | "loading" | string; //string is an error message

interface PreviewRef {
  getSandboxId: () => number;
  reload: () => void;
  update: (
    sandboxId: number,
    appObj: { html: string; style: string; script: string },
  ) => Promise<{ logs: string[] }>;
  error: (err: string) => void;
  sandboxRef: RefObject<SandboxRef | null>;
}
interface PreviewProps {
  className?: string;
  loadingIndicator?: React.ReactNode;
  initState?: PreviewState;
}

const Preview = forwardRef<PreviewRef, PreviewProps>(function Preview(
  { className, loadingIndicator = <p>Loading...</p>, initState = "ready" },
  ref,
) {
  const [state, setState] = useState<PreviewState>(initState);

  const sandboxRef = useRef<SandboxRef>(null);
  const appObjRef = useRef<AppObj | undefined>(undefined);

  useEffect(() => {
    function _requestHandler(event: MessageEvent) {
      requestHandler({
        event,
        sandboxRef,
        appObjRef,
      });
    }
    sandboxRef.current!.addListener(_requestHandler);
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
    return sandboxRef.current!.getSandboxId();
  }

  function reload() {
    setState("loading");
    sandboxRef.current!.reload();
  }

  async function update(
    sandboxId: number,
    appObj: AppObj,
    timeout?: number,
    init = true,
  ) {
    /*
    call setState("ready") to display the iframe
    we can't check whether the state is already "ready" because the caller may call reload() then update() synchronously
    then we wait for a frame for the iframe to display
    then we can send the html/style/script
    otherwise, if the script immediately examines the size of any html elements, they'll be wrong because the iframe is not displayed
    */
    setState("ready");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    appObjRef.current = appObj;
    sandboxRef.current!.postMessage(sandboxId, {
      html: appObj.html,
      style: appObj.style,
    });
    let logs: string[] = [];
    if (timeout) {
      try {
        ({ logs } = await sandboxRef.current!.executeScriptAndWaitForResponse({
          sandboxId,
          script: appObj.script,
          timeout,
        }));
      } catch (error) {
        console.error(error);
        logs = ["[Uncaught Error] Error: script timed out"];
      }
    } else {
      sandboxRef.current!.postMessage(sandboxId, {
        script: appObj.script,
      });
    }
    let initLogs: string[] = [];
    if (init) {
      try {
        ({ logs: initLogs } = await sandboxRef.current!.getInit({
          sandboxId,
          timeout: 1000,
        }));
      } catch {
        //ignore
      }
    }
    return { logs: [...logs, ...initLogs] };
  }

  function error(err: string) {
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
            flexDirection: "column",
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

export { Preview, type PreviewRef, type AppObj };
