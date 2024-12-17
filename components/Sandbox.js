import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from 'react';
import { createDeferredPromise } from './utils.js';

let nextId = 1;
const getId = () => nextId++;

const Sandbox = forwardRef(function Sandbox(
  { className, sandbox, onLoad, url },
  ref
) {
  const frameRef = useRef(null);
  const loadedRef = useRef(null);
  const sandboxIdRef = useRef(0);
  const listenersRef = useRef(new Map());

  useEffect(() => {
    function loadListener() {
      loadedRef.current.resolve();
    }
    frameRef.current.addEventListener('load', loadListener);
    return () => cleanup(loadListener);
  }, []);

  useEffect(() => {
    if (loadedRef.current === null) {
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
    };
  }, []);

  function reload() {
    sandboxIdRef.current++;
    loadedRef.current?.reject('Sandbox reloaded'); //any pending postMessages will reject
    loadedRef.current = createDeferredPromise(10000, 'Sandbox failed to load');
    loadedRef.current.catch(() => {});
    //use Date.now to make URL unique - needed to prevent infinite recursion
    //see: https://www.bryanbraun.com/2021/03/24/infinitely-nested-iframes/
    frameRef.current.src = `${url ? url : ''}/frame.html?${Date.now()}`;
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

  async function postMessage(sandboxId, msg, onError = false) {
    try {
      if (sandboxId !== sandboxIdRef.current) {
        throw new Error('Invalid sandboxId');
      }
      await loadedRef.current;
      frameRef.current.contentWindow.postMessage(msg, '*');
    } catch (error) {
      if (onError === 'throw') {
        throw error;
      } else if (onError === 'log') {
        console.error(error);
      }
    }
  }

  async function postMessageAndWaitForResponse(msg) {
    /*
  -->{id: number, msg: any}
  <--{id: number, response: any, error: {message: string, data: any}}
    */
    let listener;
    try {
      const sandboxId = getSandboxId();
      const promise = createDeferredPromise(10000, 'Sandbox failed to respond');
      const id = getId();
      listener = (event) => {
        if (
          !(
            event.data.id === id &&
            ('error' in event.data || 'response' in event.data)
          )
        ) {
          return;
        }
        if (event.data.error) {
          const error = new Error(event.data.error.message);
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
      removeListener(listener);
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
  function streamData(data, debug) {
    const id = getId();
    _streamData(data, id, debug);
    return { __isStream: true, id };
  }

  async function _streamData(data, id, debug) {
    let listener;
    try {
      const sandboxId = getSandboxId();
      const frameReady = createDeferredPromise();
      listener = (event) => {
        if (event.data.id === id && event.data.ready) {
          frameReady.resolve();
        }
      };
      addListener(listener);
      await frameReady;
      removeListener(listener);
      for await (const chunk of data) {
        if (debug) {
          console.log(debug, chunk);
        }
        postMessage(sandboxId, { value: chunk, id });
      }
      postMessage(sandboxId, { done: true, id });
    } finally {
      removeListener(listener);
    }
  }

  function addListener(_listener) {
    function listener(event) {
      if (event.source !== frameRef.current.contentWindow) return;
      _listener(event);
    }
    window.addEventListener('message', listener);
    listenersRef.current.set(_listener, listener);
  }

  function removeListener(_listener) {
    const listener = listenersRef.current.get(_listener);
    if (listener) {
      window.removeEventListener('message', listener);
      listenersRef.current.delete(_listener);
      return true;
    }
    return false;
  }

  function cleanup(loadListener) {
    frameRef.current?.removeEventListener('load', loadListener);
    listenersRef.current.forEach((listener) => {
      window.removeEventListener('message', listener);
    });
    listenersRef.current.clear();
  }

  return <iframe ref={frameRef} className={className} sandbox={sandbox} />;
});

export default Sandbox;
