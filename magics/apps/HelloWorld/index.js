/* global requestFunction */

import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [output, setOutput] = useState('');
  const initRef = useRef(null);

  useEffect(() => {
    async function init() {
      // const { result } = await requestFunction(
      //   'magicsandbox.llm',
      //   'hello there!'
      // );
      // setOutput(result);
      const generator = await requestFunction(
        'magicsandbox.llm',
        'hello there!',
        { stream: true }
      );
      for await (const chunk of generator) {
        if (chunk.result) {
          setOutput((output) => output + chunk.result);
        }
      }
    }
    if (initRef.current === null) {
      initRef.current = true;
      init();
    }
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">{output}</div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
