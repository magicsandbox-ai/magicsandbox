import React, { forwardRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { lintGutter } from "@codemirror/lint";
import { unifiedMergeView, getChunks } from "@codemirror/merge";
import { StateField } from "@codemirror/state";
import eslinter from "./eslinter.js";
import Hover from "./Hover.js";

const CodeEditor = forwardRef(function CodeEditor(props, ref) {
  const [hover, setHover] = useState({});

  const hoverRef = React.useRef(null);

  const {
    initialState,
    handleCreateEditor,
    value,
    onChange,
    selectedFilename,
    cssClassMap,
    className,
    merge,
    setMerge,
  } = props;

  function handleMouseMove(event) {
    clearTimeout(hoverRef.current);
    if (event.target.innerText) {
      hoverRef.current = setTimeout(() => {
        handleHover(event);
      }, 200);
    }
  }

  function handleMouseOut() {
    clearTimeout(hoverRef.current); //sometimes the hover gets stuck so hopefully this helps?
    if (hover.content) {
      setHover({});
    }
  }

  function handleHover(event) {
    let text = event.target.innerText;
    text = text.replace(/["'`;]/g, " "); //since getWordAtIndex looks for spaces, turn any separators into spaces
    const { left, width } = getBoundingClientRect(event.target);
    //careful! width can be zero if target is not yet rendered (maybe?)
    //makes index Infinity and causes infinite loop in getWordAtIndex. use Math.min(, 1) to fix
    const index = Math.round(
      Math.min((event.clientX - left) / width, 1) * text.length,
    );
    const word = getWordAtIndex(text, index);
    if (!word) return;
    const modifiers = word.split(":");
    const content = cssClassMap[modifiers[modifiers.length - 1]];
    if (content && content !== hover.content) {
      setHover({
        content,
        el: event.target,
        x: event.clientX,
      });
    }
  }

  function getBoundingClientRect(target) {
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

  function getWordAtIndex(str, index) {
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

  const extensions = [javascript({ jsx: true })];

  if (selectedFilename.endsWith("js")) {
    extensions.push(...[lintGutter(), eslinter()]);
  }

  if (merge) {
    const mergeListener = StateField.define({
      create() {
        return;
      },
      update(value, tr) {
        if (tr.isUserEvent("accept") || tr.isUserEvent("revert")) {
          const chunks = getChunks(ref.current.view.state);
          if (chunks?.chunks?.length === 1) {
            setMerge(null);
          }
        }
      },
    });
    extensions.push(unifiedMergeView({ original: merge }), mergeListener);
  }

  return (
    <>
      <CodeMirror
        ref={ref}
        initialState={initialState}
        onCreateEditor={handleCreateEditor}
        value={value}
        onChange={onChange}
        extensions={extensions}
        height="100%"
        className={className}
        onMouseMove={handleMouseMove}
        onMouseOut={handleMouseOut}
      />
      <Hover {...hover} />
    </>
  );
});

export default CodeEditor;
