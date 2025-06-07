import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from "react";
import { createDeferredPromise, type DeferredPromise } from "./utils.js";

interface SandboxRef {
  reload: () => void;
  getSandboxId: () => number;
  postMessage: (
    sandboxId: number,
    msg: unknown,
    onError?: "throw" | "log",
  ) => Promise<void>;
  postMessageAndWaitForResponse: (
    sandboxId: number,
    msg: unknown,
    timeout?: number,
  ) => Promise<unknown>;
  streamData: (
    data: AsyncIterable<unknown>,
    debug?: boolean,
  ) => { __isStream: boolean; id: number };
  addListener: (listener: (event: MessageEvent) => void) => void;
  removeListener: (listener: (event: MessageEvent) => void) => void;
  executeScriptAndWaitForResponse: (params: {
    sandboxId: number;
    script: string;
    args?: unknown;
    timeout?: number;
  }) => Promise<{
    logs: string[];
    result: unknown;
    error: Error | undefined;
  }>;
  getInit: (params: {
    sandboxId: number;
    timeout?: number;
    args?: unknown;
  }) => Promise<{
    logs: string[];
    result: string | undefined;
    error: Error | undefined;
  }>;
  getContext: (
    sandboxId: number,
    timeout?: number,
  ) => Promise<{
    context: string | undefined;
    selection: string | undefined;
  }>;
}

interface SandboxProps {
  className?: string;
  sandbox?: string;
  allow?: string;
  onLoad?: () => void;
  url?: string;
  style?: React.CSSProperties;
}

let nextId = 1;
const getId = () => nextId++;

const Sandbox = forwardRef<SandboxRef, SandboxProps>(function Sandbox(
  { className, sandbox, allow, onLoad, url, style },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const loadedRef = useRef<DeferredPromise<void> | undefined>(undefined);
  const sandboxIdRef = useRef(0);
  const listenersRef = useRef(
    //map of inner listener to wrapper of that listener
    new Map<(event: MessageEvent) => void, (event: MessageEvent) => void>(),
  );

  useEffect(() => {
    function loadListener() {
      loadedRef.current?.resolve();
    }
    frameRef.current?.addEventListener("load", loadListener);
    return () => cleanup(loadListener);
  }, []);

  useEffect(() => {
    if (loadedRef.current === undefined) {
      reload();
    }
  }, []);

  useImperativeHandle(ref, () => {
    return {
      reload,
      getSandboxId,
      postMessage,
      postMessageAndWaitForResponse,
      streamData,
      addListener,
      removeListener,
      executeScriptAndWaitForResponse,
      getInit,
      getContext,
    };
  }, []);

  function reload() {
    sandboxIdRef.current++;
    loadedRef.current?.reject("Sandbox reloaded"); //any pending postMessages will reject
    loadedRef.current = createDeferredPromise(10000, "Sandbox failed to load");
    loadedRef.current.catch(() => {});
    //use Date.now to make URL unique - needed to prevent infinite recursion
    //see: https://www.bryanbraun.com/2021/03/24/infinitely-nested-iframes/
    frameRef.current!.src = `${url ? url : ""}/public/sandbox.html?${Date.now()}`;
    if (onLoad) {
      onLoad();
    }
  }

  /**
   * Returns the sandboxId to use in postMessage to ensure the message is sent to the correct Sandbox.
   * Prevents sending stale messages after Sandbox reloads.
   * Should be called prior to any async operations.
   */
  function getSandboxId() {
    return sandboxIdRef.current;
  }

  async function postMessage(
    sandboxId: number,
    msg: unknown,
    onError?: "throw" | "log",
  ) {
    try {
      if (sandboxId !== sandboxIdRef.current) {
        throw new Error("Invalid sandboxId");
      }
      await loadedRef.current;
      frameRef.current!.contentWindow?.postMessage(msg, "*");
    } catch (error) {
      if (onError === "throw") {
        throw error;
      } else if (onError === "log") {
        console.error(error);
      }
    }
  }

  async function postMessageAndWaitForResponse(
    sandboxId: number,
    msg: unknown,
    timeout?: number,
  ) {
    /*
  -->{id: number, msg: any}
  <--{id: number, response: any, error: {message: string, data: any}}
    */
    let listener: ((event: MessageEvent) => void) | undefined;
    try {
      let promise;
      if (timeout) {
        promise = createDeferredPromise(timeout, "Sandbox failed to respond");
      } else {
        promise = createDeferredPromise();
      }
      const id = getId();
      listener = (event: MessageEvent) => {
        if (
          !(
            event.data.id === id &&
            ("error" in event.data || "response" in event.data)
          )
        ) {
          return;
        }
        if (event.data.error) {
          const error = new Error(event.data.error.message);
          // @ts-ignore
          error.data = event.data.error.data;
          promise.reject(error);
        } else {
          promise.resolve(event.data.response);
        }
      };
      addListener(listener);
      postMessage(sandboxId, { msg, id });
      return await promise;
    } finally {
      if (listener) {
        removeListener(listener);
      }
    }
  }

  /**
   * Arguments:
   * data: AsyncIterable
   *
   * Returns: an object { __isStream: true, id } to send to the Sandbox via postMessage,
   * which is a signal to the Sandbox to start listening for streamed data.
   * Once the Sandbox acknowledges the signal, streamData streams data to the Sandbox.
   */
  function streamData(data: AsyncIterable<unknown>, debug?: boolean) {
    const id = getId();
    _streamData(data, id, debug);
    return { __isStream: true, id };
  }

  async function _streamData(
    data: AsyncIterable<unknown>,
    id: number,
    debug?: boolean,
  ) {
    let listener: ((event: MessageEvent) => void) | undefined;
    try {
      const sandboxId = getSandboxId();
      const frameReady = createDeferredPromise<void>();
      listener = (event: MessageEvent) => {
        if (event.data.id === id && event.data.ready) {
          frameReady.resolve();
        }
      };
      addListener(listener);
      await frameReady;
      removeListener(listener);
      try {
        for await (const chunk of data) {
          if (debug) {
            console.log(debug, chunk);
          }
          postMessage(sandboxId, { value: chunk, id });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        postMessage(sandboxId, { done: { error: errorMessage }, id });
      }
      postMessage(sandboxId, { done: true, id });
    } finally {
      if (listener) {
        removeListener(listener);
      }
    }
  }

  function addListener(_listener: (event: MessageEvent) => void) {
    function listener(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      //don't listen to messages between reload and load event
      //in case frame is reloaded but old frame had sent a message we hadn't received yet
      if (!loadedRef.current?.resolved) return;
      _listener(event);
    }
    window.addEventListener("message", listener);
    listenersRef.current.set(_listener, listener);
  }

  function removeListener(_listener: (event: MessageEvent) => void) {
    const listener = listenersRef.current.get(_listener);
    if (listener) {
      window.removeEventListener("message", listener);
      listenersRef.current.delete(_listener);
    }
  }

  function cleanup(loadListener: () => void) {
    frameRef.current?.removeEventListener("load", loadListener);
    listenersRef.current.forEach((listener) => {
      window.removeEventListener("message", listener);
    });
    listenersRef.current.clear();
  }

  async function executeScriptAndWaitForResponse({
    sandboxId,
    script,
    args,
    timeout,
  }: {
    sandboxId: number;
    script: string;
    args?: unknown;
    timeout?: number;
  }) {
    const response = await postMessageAndWaitForResponse(
      sandboxId,
      {
        request: "script",
        data: { script, args },
      },
      timeout,
    );
    let logs: string[] = [];
    let result: unknown;
    let error: Error | undefined;
    if (response && typeof response === "object") {
      if ("logs" in response && Array.isArray(response.logs)) {
        for (const log of response.logs) {
          if (typeof log === "string") {
            logs.push(log);
          }
        }
      }
      if ("result" in response) {
        result = response.result;
      }
      if ("error" in response) {
        if (response.error instanceof Error) {
          error = response.error;
        } else {
          error = new Error("Unexpected error in Sandbox response");
        }
      }
    }
    return { logs, result, error };
  }

  async function getInit({
    sandboxId,
    timeout,
    args,
  }: {
    sandboxId: number;
    timeout?: number;
    args?: unknown;
  }) {
    const script = `return await window.app?.init?.(args);`;
    const { logs, result, error } = await executeScriptAndWaitForResponse({
      sandboxId,
      script,
      args,
      timeout,
    });
    return {
      logs,
      result: typeof result === "string" ? result : undefined,
      error,
    };
  }

  async function getContext(sandboxId: number, timeout?: number) {
    const script = `return { context: await window.app?.context?.(), selection: window.getSelection()?.toString() };`;
    const { result } = await executeScriptAndWaitForResponse({
      sandboxId,
      script,
      timeout,
    });
    let context: string | undefined;
    let selection: string | undefined;
    if (result && typeof result === "object") {
      if ("context" in result && typeof result.context === "string") {
        context = result.context;
      }
      if ("selection" in result && typeof result.selection === "string") {
        selection = result.selection;
      }
    }
    return { context, selection };
  }

  return (
    <iframe
      ref={frameRef}
      className={className}
      sandbox={sandbox}
      allow={allow || "clipboard-write *"}
      style={style}
    />
  );
});

export { Sandbox, type SandboxRef };
