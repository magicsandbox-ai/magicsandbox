import { useState, useRef, useEffect } from "react";

function usePersistentState(key, initialState, options = {}) {
  const { debounceMs = 300, app, evictionPolicy } = options;
  const [value, setValue] = useState(initialState);
  const initialized = useRef(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const value = await requestGetData(key, { app });
        if (isMounted) {
          // only update state if still mounted, since requestGetData is async
          if (value !== undefined) {
            setValue(value);
          }
          initialized.current = true;
        }
      } catch (error) {
        console.error(`usePersistentState error loading key "${key}":`, error);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [key, app]);

  useEffect(() => {
    if (!initialized.current) return;
    clearTimeout(timeoutRef.current);
    const saveValue = () => {
      requestPutData(key, value, { app, evictionPolicy }).catch((error) => {
        console.error(`usePersistentState error saving key "${key}":`, error);
      });
    };
    if (debounceMs) {
      timeoutRef.current = setTimeout(saveValue, debounceMs);
    } else {
      saveValue();
    }
  }, [key, value, app, evictionPolicy, debounceMs]);

  return [value, setValue];
}

export { usePersistentState };
