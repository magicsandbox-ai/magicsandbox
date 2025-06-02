import React, {
  useSyncExternalStore,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { lintGutter } from "@codemirror/lint";
import { historyField } from "@codemirror/commands";
import eslinter from "./eslinter.ts";
import { Hover, type HoverProps } from "./Hover.tsx";
import { diffExtension } from "./diffExtension.ts";
import { type DevState } from "./DevState.ts";

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

  const [tailwindClassMap, setTailwindClassMap] = useState<{
    [className: string]: string;
  }>({});
  const [hover, setHover] = useState<HoverProps | undefined>(undefined);

  const editorRef = useRef<ReactCodeMirrorRef>(null);
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
    return () => {
      const view = editorRef.current?.view;
      if (!view) return;
      devState.updateFile({
        editorState: view.state.toJSON(editorStateFields),
        scroll: {
          top: view.scrollDOM.scrollTop,
          left: view.scrollDOM.scrollLeft,
        },
      });
    };
  }, []);

  useEffect(() => {
    const handleBuild = async () => {
      const view = editorRef.current?.view;
      if (!view) return;
      const { formatted, newCursorOffset } = await devState.runPrettier({
        cursorOffset: view.state.selection.main.head,
      });
      if (!formatted) return;
      const yMargin = view.coordsAtPos(newCursorOffset)?.top || 5;
      //need to update the content and the scroll in one transaction to prevent flicker
      view.dispatch({
        changes: {
          from: 0,
          to: selectedApp.selectedFile.content.length,
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

  const extensions = useMemo(() => {
    const extensions: Extension[] = [javascript({ jsx: true })];
    const fileExt = selectedApp.selectedFile.name.split(".").pop();
    if (
      fileExt === "js" ||
      fileExt === "jsx"
      //eslint doesn't work with ts/tsx
      // fileExt === "ts" ||
      // fileExt === "tsx"
    ) {
      extensions.push(...[lintGutter(), eslinter()]);
    }
    if (selectedApp.selectedFile.changeSet) {
      extensions.push(
        diffExtension(
          selectedApp.selectedFile.changeSet,
          selectedApp.selectedFile.content,
        ),
      );
    }
    return extensions;
  }, [selectedApp.selectedFile.changeSet !== undefined]);

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

  function handleCreateEditor(view: EditorView) {
    if (selectedApp.selectedFile.scroll) {
      view.scrollDOM.scrollTo(selectedApp.selectedFile.scroll);
    }
    view.focus();
  }

  async function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      devState.buildApp();
    }
  }

  return (
    <>
      <CodeMirror
        ref={editorRef}
        initialState={{
          json: selectedApp.selectedFile.editorState,
          fields: editorStateFields,
        }}
        onCreateEditor={handleCreateEditor}
        value={selectedApp.selectedFile.content}
        onChange={onChange}
        extensions={extensions}
        height="100%"
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
