import React, { useState, useRef, useEffect } from "react";

function Note({ initContent, setNodes, currentNodeId }) {
  const [content, setContent] = useState(initContent);

  const timeoutRef = useRef(null);

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setNodes((nodes) => ({
        ...nodes,
        [currentNodeId]: { ...nodes[currentNodeId], content },
      }));
    }, 1000);
  }, [content]);

  function handleChange(e) {
    setContent(e.target.value);
  }

  return (
    <textarea
      className="grow resize-none border-none p-3"
      value={content}
      onChange={handleChange}
      placeholder="Add a note..."
    />
  );
}

export default Note;
