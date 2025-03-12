import React from "react";
import SearchComponent from "@components/Search.js";

function Search({ notesState, setShowSearch }) {
  const nodes = notesState.tree
    .filter((node) => node.type === "note")
    .map((node) => ({
      key: node.uuid,
      name: node.path,
      content: `${node.content} ${node.prevContent || ""}`,
    }));
  return (
    <SearchComponent
      nodes={nodes}
      onClose={() => setShowSearch(false)}
      onClickResult={(node) => {
        notesState.setCurrentNodeUuid(node.key);
        setShowSearch(false);
      }}
      placeholder="Search notes..."
    />
  );
}

export default Search;
