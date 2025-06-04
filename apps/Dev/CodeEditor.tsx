import React, {
  useSyncExternalStore,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import { useCodeMirror } from "@uiw/react-codemirror";
import { type Extension, Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { lintGutter } from "@codemirror/lint";
import { historyField } from "@codemirror/commands";
import eslinter from "./eslinter.ts";
import { Hover, type HoverProps } from "./Hover.tsx";
import { diffExtension, externalAnnotationType } from "./diffExtension.ts";
import type { DevState } from "./DevState.ts";

declare let setTimeout: WindowOrWorkerGlobalScope["setTimeout"];

const debounce = (callback: (...args: any[]) => void, wait: number) => {
  let timeoutId: number | undefined;
  let isFirstCall = true;
  return (...args: any[]) => {
    if (isFirstCall) {
      isFirstCall = false;
      callback.apply(null, args); //run immediately on init
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        callback.apply(null, args);
      }, wait);
    }
  };
};

const editorStateFields = { history: historyField };

function CodeEditor({ devState }: { devState: DevState }) {
  const selectedApp = useSyncExternalStore(
    devState.subscribe("selectedApp"),
    devState.getSnapshot("selectedApp"),
  );
  const selectedFile = selectedApp.files[selectedApp.selectedFileName]!;

  const [tailwindClassMap, setTailwindClassMap] = useState<{
    [className: string]: string;
  }>({});
  const [hover, setHover] = useState<HoverProps | undefined>(undefined);

  const viewRef = useRef<EditorView | undefined>(undefined);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);

  //debounced functions need to be stable for closure to work
  const debouncedCallProcessTailwind = useCallback(
    debounce(async () => {
      const magicObj = devState.getMagicObj();
      let style: string =
        magicObj.style ||
        devState.readFile(magicObj.styleFile || "index.css") ||
        "@tailwind base; @tailwind components; @tailwind utilities;";
      if (style.includes("@tailwind")) {
        const { classMap } = await devState.processTailwind(
          magicObj.tailwindConfig || {},
          style,
          true,
        );
        setTailwindClassMap(classMap);
      }
    }, 500),
    [],
  );

  useEffect(() => {
    debouncedCallProcessTailwind(); //call once on mount, then called on changes
  }, []);

  useLayoutEffect(() => {
    //save the editor state on unmount (when the app or file is changed)
    //this needs to be useLayoutEffect so it runs before editorRef is removed from the DOM (as it is with useEffect)
    return () => {
      if (!viewRef.current) return;
      //need to make sure the app and/or file has not been deleted
      const app = devState.apps[selectedApp.id];
      if (!app) return;
      const file = app.files[selectedApp.selectedFileName];
      if (!file) return;
      //need to use updateFiles rather than updateFile as the app and/or file may have changed (selectedApp is a stale closure)
      devState.updateFiles(
        {
          [selectedApp.selectedFileName]: {
            editorState: viewRef.current.state.toJSON(editorStateFields),
            scroll: {
              top: viewRef.current.scrollDOM.scrollTop,
              left: viewRef.current.scrollDOM.scrollLeft,
            },
          },
        },
        selectedApp.id,
      );
    };
  }, []);

  useEffect(() => {
    const handleBuild = async () => {
      if (!viewRef.current) return;
      const { formatted, newCursorOffset } = await devState.runPrettier({
        cursorOffset: viewRef.current.state.selection.main.head,
      });
      if (!formatted) return;
      const yMargin = viewRef.current.coordsAtPos(newCursorOffset)?.top || 5;
      //need to update the content and the scroll in one transaction to prevent flicker
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: formatted,
        },
        selection: { anchor: newCursorOffset, head: newCursorOffset },
        effects: [
          EditorView.scrollIntoView(newCursorOffset, {
            y: "start",
            yMargin,
          }),
        ],
      });
    };
    window.addEventListener("buildApp", handleBuild);
    return () => window.removeEventListener("buildApp", handleBuild);
  }, []);

  //onChange and extensions should be stable to avoid creating unnecessary transactions
  const onChange = useCallback((value: string) => {
    devState.updateFile({
      content: value,
    });
    debouncedCallProcessTailwind();
  }, []);

  const diffCompartment = useMemo(() => {
    return new Compartment();
  }, []);

  const extensions = useMemo(() => {
    const extensions: Extension[] = [javascript({ jsx: true })];
    const fileExt = selectedApp.selectedFileName.split(".").pop();
    if (
      fileExt === "js" ||
      fileExt === "jsx"
      //eslint doesn't work with ts/tsx
      // fileExt === "ts" ||
      // fileExt === "tsx"
    ) {
      extensions.push(...[lintGutter(), eslinter()]);
    }
    if (selectedFile.changeSet) {
      extensions.push(
        diffCompartment.of(
          diffExtension(devState, selectedFile.changeSet, selectedFile.content),
        ),
      );
    } else {
      extensions.push(diffCompartment.of([]));
    }
    return extensions;
  }, []);

  function handleCreateEditor(view: EditorView) {
    if (selectedFile.scroll) {
      //this doesn't work perfectly, I think, because CodeMirror doesn't render the whole document, so the scroll is approximate
      //todo maybe rather than unmounting completely on file change, we keep the views in memory and switch between them somehow?
      //this would make switching between files snappier
      view.scrollDOM.scrollTo(selectedFile.scroll);
    }
    view.focus();
  }

  const { view, setContainer } = useCodeMirror({
    initialState: selectedFile.editorState
      ? {
          json: selectedFile.editorState,
          fields: editorStateFields,
        }
      : undefined,
    onCreateEditor: handleCreateEditor,
    onChange,
    extensions,
    height: "100%",
    className: "grow overflow-auto",
  });

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    //typically you would pass selectedFile.content as value to ReactCodeMirror, which does something similar to this internally
    //but we need more control over these external changes
    if (!view) return;
    const changes = [];
    const effects = [];
    if (selectedFile.content !== view.state.doc.toString()) {
      //external content change - update the whole doc and reset the diff extension
      changes.push({
        from: 0,
        to: view.state.doc.length,
        insert: selectedFile.content,
      });
      if (selectedFile.changeSet) {
        effects.push(
          diffCompartment.reconfigure(
            diffExtension(
              devState,
              selectedFile.changeSet,
              selectedFile.content,
            ),
          ),
        );
      } else {
        effects.push(diffCompartment.reconfigure([]));
      }
    } else if (selectedFile.changeSet === undefined) {
      //content didn't change but the changeSet is undefined (this happens if the user accepts all diffs) - remove the diff extension
      effects.push(diffCompartment.reconfigure([]));
    }
    if (effects.length > 0) {
      //reconfigure extension first so that it can see the changes
      view.dispatch({
        effects,
      });
    }
    if (changes.length > 0) {
      view.dispatch({
        changes,
        //add an annotation for the diff extension to ignore this transaction
        annotations: [externalAnnotationType.of(true)],
      });
    }
  }, [view, selectedFile.content, selectedFile.changeSet !== undefined]);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    clearTimeout(hoverTimeoutRef.current);
    if (event.target instanceof HTMLElement && event.target.innerText) {
      hoverTimeoutRef.current = setTimeout(() => {
        handleHover(event);
      }, 200);
    }
  }

  function handleMouseOut() {
    clearTimeout(hoverTimeoutRef.current); //sometimes the hover gets stuck so hopefully this helps?
    if (hover) {
      setHover(undefined);
    }
  }

  function handleHover(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest(".cm-line")) return;
    let text = target.innerText;
    text = text.replace(/["'`;]/g, " "); //since getWordAtIndex looks for spaces, turn any separators into spaces
    const { left, width } = getBoundingClientRect(target);
    //careful! width can be zero if target is not yet rendered (maybe?)
    //makes index Infinity and causes infinite loop in getWordAtIndex. use Math.min(, 1) to fix
    const index = Math.round(
      Math.min((event.clientX - left) / width, 1) * text.length,
    );
    const word = getWordAtIndex(text, index);
    if (!word) return;
    const modifiers = word.split(":");
    const className = modifiers[modifiers.length - 1];
    if (!className) return;
    const content = tailwindClassMap[className];
    if (typeof content !== "string") return; //if className is "__proto__", content is an object and attempting to render it will crash the app
    if (content && content !== hover?.content) {
      setHover({
        content,
        el: target,
        x: event.clientX,
      });
    }
  }

  function getBoundingClientRect(target: HTMLElement) {
    if (target.className.includes("cm-line")) {
      //in a js file, tailwind classes are within quotes and so in a span
      //but in a css file, they're within a div with class cm-line
      //the div's width is much wider than the width of the text, so we need to look at the div's children
      const range = document.createRange();
      range.selectNodeContents(target);
      return range.getBoundingClientRect();
    } else {
      return target.getBoundingClientRect();
    }
  }

  function getWordAtIndex(str: string, index: number) {
    if (str[index] === " ") {
      return;
    }
    let end = str.indexOf(" ", index);
    end = end === -1 ? str.length : end;
    let beg = 0;
    for (let i = index; i >= 0; i--) {
      if (str[i] === " ") {
        beg = i + 1; //since slice start is inclusive
        break;
      }
    }
    return str.slice(beg, end);
  }

  async function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      devState.buildApp();
    }
  }

  return (
    <>
      <div
        ref={(el) => setContainer(el)}
        className="grow overflow-auto"
        onMouseMove={handleMouseMove}
        onMouseOut={handleMouseOut}
        onKeyDown={handleKeyDown}
      />
      {hover && <Hover {...hover} />}
    </>
  );
}

export default CodeEditor;
