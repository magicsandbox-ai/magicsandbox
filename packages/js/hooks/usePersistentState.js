import { useState, useRef, useEffect } from "react";

function usePersistentState(key, initialState, options = {}) {
  const { debounceMs = 300, onError, app, evictionPolicy } = options;
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
        if (onError) {
          onError(error, { key, options: { app } });
        } else {
          console.error(
            `usePersistentState error loading key "${key}":`,
            error,
          );
        }
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [key, app, onError]);

  useEffect(() => {
    if (!initialized.current) return;
    clearTimeout(timeoutRef.current);
    const saveValue = () => {
      requestPutData(key, value, { app, evictionPolicy }).catch((error) => {
        if (onError) {
          onError(error, {
            key,
            value,
            options: { app, evictionPolicy },
          });
        } else {
          console.error(`usePersistentState error saving key "${key}":`, error);
        }
      });
    };
    if (debounceMs) {
      timeoutRef.current = setTimeout(saveValue, debounceMs);
    } else {
      saveValue();
    }
  }, [key, value, app, evictionPolicy, debounceMs, onError]);

  return [value, setValue];
}

export { usePersistentState };
