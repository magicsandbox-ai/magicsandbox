import React, { forwardRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { lintGutter } from '@codemirror/lint';
import eslinter from './eslinter.js';
import Hover from './Hover.js';

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
    text = text.replace(/["'`]/g, ' ');
    const { left, width } = event.target.getBoundingClientRect();
    //careful! width can be zero if target is not yet rendered (maybe?)
    //makes index Infinity and causes infinite loop in getWordAtIndex. use Math.min(, 1) to fix
    const index = Math.round(
      Math.min((event.clientX - left) / width, 1) * text.length
    );
    const word = getWordAtIndex(text, index);
    if (cssClassMap[word] && cssClassMap[word] !== hover.content) {
      setHover({
        content: cssClassMap[word],
        el: event.target,
        x: event.clientX,
      });
    }
  }

  function getWordAtIndex(str, index) {
    if (str[index] === ' ') {
      return;
    }
    let end = str.indexOf(' ', index);
    end = end === -1 ? str.length : end;
    let beg = 0;
    for (let i = index; i >= 0; i--) {
      if (str[i] === ' ') {
        beg = i + 1; //since slice start is inclusive
        break;
      }
    }
    return str.slice(beg, end);
  }

  return (
    <>
      <CodeMirror
        ref={ref}
        initialState={initialState}
        onCreateEditor={handleCreateEditor}
        value={value}
        onChange={onChange}
        extensions={[
          javascript({ jsx: true }),
          ...(selectedFilename.endsWith('js')
            ? [lintGutter(), eslinter()]
            : []),
        ]}
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
