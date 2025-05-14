import React from "react";
import SearchComponent from "@components/Search.tsx";
import NotesState from "./NotesState.ts";

function Search({
  notesState,
  setShowSearch,
}: {
  notesState: NotesState;
  setShowSearch: (showSearch: boolean) => void;
}) {
  const nodes = notesState.tree
    .filter((node) => node.isNote())
    .map((node) => ({
      key: node.nodeData.uuid,
      name: node.treeData.path,
      content: `${node.nodeData.content} ${node.nodeData.prevContent || ""}`,
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
