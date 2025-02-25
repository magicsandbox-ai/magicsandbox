import React from "react";
import ModalOverlay from "@components/ModalOverlay.js";

function SearchInner({
  tree,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  setCurrentNodeId,
}) {
  function handleSearch(e) {
    e.preventDefault();
    const searchTerms = searchQuery.toLowerCase().split(" ");
    setSearchResults(
      tree.filter((node) => {
        if (!node.content) return false; // Only search notes, not folders
        const searchText = `${node.content} ${node.name}`.toLowerCase();
        const matches = searchTerms
          .map((term) => {
            const indexes = [];
            let pos = searchText.indexOf(term);
            while (pos !== -1 && indexes.length < 3) {
              indexes.push(pos);
              pos = searchText.indexOf(term, pos + 1);
            }
            return indexes.length > 0 ? { term, indexes } : null;
          })
          .filter(Boolean);
        if (matches.length === searchTerms.length) {
          node.matches = matches; // Attach match info to node
          return true;
        }
        return false;
      }),
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <form onSubmit={handleSearch} className="border-b">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="flex-1 rounded border p-2"
            autoFocus
          />
          <button
            type="submit"
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Search
          </button>
        </div>
      </form>
      {searchResults !== null && (
        <div className="flex-1 overflow-auto">
          {searchResults.length === 0 ? (
            <div className="text-stone-500">No results found</div>
          ) : (
            searchResults.map((note) => (
              <SearchResult
                key={note.id}
                note={note}
                setCurrentNodeId={setCurrentNodeId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SearchResult({ note, setCurrentNodeId }) {
  const path = [...note.parentNames, note.name].join(" > ");

  const matches = [];
  for (const { term, indexes } of note.matches) {
    for (const index of indexes) {
      matches.push({
        term,
        index,
      });
    }
  }
  matches.sort((a, b) => a.index - b.index);

  const segments = [];
  for (const match of matches.slice(0, 3)) {
    if (match.index + match.term.length > note.content.length) {
      break; //matching node.name which was added to searchText - don't show
    }
    const start = match.index - 20;
    const matchStart = match.index;
    const matchEnd = match.index + match.term.length;
    const end = matchEnd + 20;
    segments.push(
      `${start > 0 ? "..." : ""}${note.content.slice(start, matchStart)}`,
    );
    segments.push(
      <span className="font-bold">
        {note.content.slice(matchStart, matchEnd)}
      </span>,
    );
    segments.push(
      `${note.content.slice(matchEnd, end)}${
        end < note.content.length ? "..." : ""
      }`,
    );
  }

  return (
    <div
      className="mb-4 rounded border p-3 hover:bg-gray-50"
      onClick={() => setCurrentNodeId(note.id)}
    >
      <div className="mb-1 font-medium">{path}</div>
      <div className="line-clamp-2 text-sm text-gray-600">{segments}</div>
    </div>
  );
}

function Search({
  tree,
  setShowSearch,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  setCurrentNodeId,
}) {
  return (
    <ModalOverlay
      modal={
        <SearchInner
          tree={tree}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          setSearchResults={setSearchResults}
          setCurrentNodeId={setCurrentNodeId}
        />
      }
      onClose={() => {
        setShowSearch(false);
      }}
      fullScreen={true}
    />
  );
}

export default Search;
