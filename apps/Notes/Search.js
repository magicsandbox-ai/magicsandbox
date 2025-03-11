import React, { useState } from "react";
import ModalOverlay from "@components/ModalOverlay.js";

function Search({ notesState, setShowSearch }) {
  return (
    <ModalOverlay
      modal={
        <SearchInner notesState={notesState} setShowSearch={setShowSearch} />
      }
      onClose={() => {
        setShowSearch(false);
      }}
      fullScreen={true}
    />
  );
}

function SearchInner({ notesState, setShowSearch }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);

  function handleSearch(e) {
    e.preventDefault();
    const searchTerms = searchQuery.toLowerCase().split(" ");
    const newSearchResults = [];
    notesState.tree.forEach((node) => {
      if (node.type !== "note") return; // Only search notes, not folders
      const searchText =
        `${node.content} ${node.prevContent || ""} ${node.name}`.toLowerCase();
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
      if (matches.length > 0) {
        newSearchResults.push({ ...node, matches });
      }
    });
    newSearchResults.sort((a, b) => b.matches.length - a.matches.length);
    setSearchResults(newSearchResults);
  }

  return (
    <div className="flex h-[440px] w-[680px] flex-col gap-3 overflow-y-auto p-3">
      <form onSubmit={handleSearch}>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="flex-1 rounded border border-stone-200 p-2"
            autoFocus
          />
          <button
            type="submit"
            className="rounded bg-stone-200 px-4 py-2 font-bold hover:bg-stone-300"
          >
            Search
          </button>
        </div>
      </form>
      {searchResults !== null && (
        <div className="flex-1 overflow-auto">
          {searchResults.length === 0 ? (
            <div className="text-center italic text-stone-500">
              No results found
            </div>
          ) : (
            searchResults.map((note) => (
              <SearchResult
                key={note.uuid}
                note={note}
                notesState={notesState}
                setShowSearch={setShowSearch}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SearchResult({ note, notesState, setShowSearch }) {
  function handleClick() {
    notesState.setCurrentNodeUuid(note.uuid);
    setShowSearch(false);
  }

  const path = [
    ...note.ancestorNames.slice(1), //exclude root
    note.name,
  ].join("/");

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

  let i = 0;
  const displayMatches = [];
  let displayMatch = [];
  const displayMatchLength = 60;
  while (i < matches.length && displayMatches.length < 3) {
    const match = matches[i];
    if (match.index + match.term.length > note.content.length) {
      break; //matching node.name which was added to searchText - don't show
    }
    const start = match.index - 20;
    const matchStart = match.index;
    const matchEnd = match.index + match.term.length;
    let end;
    if (displayMatch.length === 0) {
      displayMatch.push({
        text: `${start > 0 ? "..." : ""}${note.content.slice(Math.max(0, start), matchStart)}`,
      });
      end = start + displayMatchLength;
    } else {
      const currentLength = displayMatch.reduce((acc, curr) => {
        return acc + curr.text.length;
      }, 0);
      end = displayMatchLength - currentLength;
    }
    displayMatch.push({
      text: note.content.slice(matchStart, matchEnd),
      isMatch: true,
    });
    const nextMatch = matches[i + 1];
    if (nextMatch && nextMatch.index + nextMatch.term.length < end) {
      displayMatch.push({
        text: `${note.content.slice(matchEnd, nextMatch.index)}`,
      });
    } else {
      displayMatch.push({
        text: `${note.content.slice(matchEnd, end)}${
          end < note.content.length ? "..." : ""
        }`,
      });
      displayMatches.push(displayMatch);
      displayMatch = [];
    }
    i++;
  }

  return (
    <div
      className="mb-4 cursor-pointer rounded border border-stone-200 p-3 hover:bg-stone-50"
      onClick={handleClick}
    >
      <div className="mb-1 font-medium">{path}</div>
      <div>
        {displayMatches.map((displayMatch, index) => (
          <DisplayMatch key={index} displayMatch={displayMatch} />
        ))}
      </div>
    </div>
  );
}

function DisplayMatch({ displayMatch }) {
  return (
    <div>
      {displayMatch.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 ? " " : ""}
          <span
            className={`text-sm text-stone-600 ${item.isMatch ? "font-bold" : ""}`}
          >
            {item.text}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

export default Search;
