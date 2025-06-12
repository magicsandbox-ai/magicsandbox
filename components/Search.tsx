import React, { useState } from "react";
import ModalOverlay from "./ModalOverlay.tsx";

interface SearchNode {
  key: any;
  name: string;
  content: string;
}

interface SearchResult extends SearchNode {
  matches: { term: string; indexes: number[] }[];
}

type DisplayMatch = { text: string; isMatch?: boolean }[];

/**
 * - nodes should be an array of objects with keys:
 *   - key (any): unique identifier for the node used when rendering search results
 *   - name (string): name of the node - will be used in search query and displayed in search results
 *   - content (string): content to search
 * - onClose (function): called when the search modal should be closed
 * - onClickResult (function): called when a search result is clicked and passed the node as an argument
 * - placeholder (string): placeholder text for the search input
 */
function Search({
  nodes,
  onClose = () => {},
  onClickResult = () => {},
  placeholder = "Search...",
}: {
  nodes: SearchNode[];
  onClose: () => void;
  onClickResult: (node: SearchNode) => void;
  placeholder: string;
}) {
  return (
    <ModalOverlay
      modal={
        <SearchInner
          nodes={nodes}
          onClickResult={onClickResult}
          placeholder={placeholder}
        />
      }
      onClose={onClose}
      fullScreen={true}
    />
  );
}

function SearchInner({
  nodes,
  onClickResult,
  placeholder,
}: {
  nodes: SearchNode[];
  onClickResult: (node: SearchNode) => void;
  placeholder: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null,
  );

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (window.innerWidth < 768 && e.target instanceof Element) {
      //hide virtual keyboard on mobile
      (
        e.target.querySelector('input[type="search"]') as HTMLInputElement
      ).blur();
    }
    const searchTerms = searchQuery.toLowerCase().split(" ");
    const newSearchResults: SearchResult[] = [];
    nodes.forEach((node) => {
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
        .filter((match) => match !== null);
      if (matches.length > 0) {
        newSearchResults.push({ ...node, matches });
      }
    });
    newSearchResults.sort((a, b) => b.matches.length - a.matches.length);
    setSearchResults(newSearchResults);
  }

  return (
    <div className="flex h-[440px] w-[680px] max-w-full flex-col gap-3 overflow-y-auto p-3">
      <form onSubmit={handleSearch}>
        <div className="flex gap-2">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 rounded border border-stone-200 p-2"
            autoFocus
            aria-label={placeholder}
            enterKeyHint="search"
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
            searchResults.map((node) => (
              <SearchResult
                key={node.key}
                node={node}
                onClickResult={onClickResult}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SearchResult({
  node,
  onClickResult,
}: {
  node: SearchResult;
  onClickResult: (node: SearchNode) => void;
}) {
  function handleClick() {
    onClickResult(node);
  }

  const matches = [];
  for (const { term, indexes } of node.matches) {
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
    const match = matches[i]!;
    if (match.index + match.term.length > node.content.length) {
      break; //matching node.name which was added to searchText - don't show
    }
    const start = match.index - 20;
    const matchStart = match.index;
    const matchEnd = match.index + match.term.length;
    let end;
    if (displayMatch.length === 0) {
      displayMatch.push({
        text: `${start > 0 ? "..." : ""}${node.content.slice(Math.max(0, start), matchStart)}`,
      });
      end = start + displayMatchLength;
    } else {
      const currentLength = displayMatch.reduce((acc, curr) => {
        return acc + curr.text.length;
      }, 0);
      end = displayMatchLength - currentLength;
    }
    displayMatch.push({
      text: node.content.slice(matchStart, matchEnd),
      isMatch: true,
    });
    const nextMatch = matches[i + 1];
    if (nextMatch && nextMatch.index + nextMatch.term.length < end) {
      displayMatch.push({
        text: `${node.content.slice(matchEnd, nextMatch.index)}`,
      });
    } else {
      displayMatch.push({
        text: `${node.content.slice(matchEnd, end)}${
          end < node.content.length ? "..." : ""
        }`,
      });
      displayMatches.push(displayMatch);
      displayMatch = [];
    }
    i++;
  }

  return (
    <button
      className="mb-4 w-full rounded border border-stone-200 p-3 text-left hover:bg-stone-50"
      onClick={handleClick}
      aria-label={node.name}
    >
      <div className="mb-1 font-medium">{node.name}</div>
      <div>
        {displayMatches.map((displayMatch, index) => (
          <DisplayMatch key={index} displayMatch={displayMatch} />
        ))}
      </div>
    </button>
  );
}

function DisplayMatch({ displayMatch }: { displayMatch: DisplayMatch }) {
  return (
    <div>
      {displayMatch.map((item, index) => (
        <span
          key={index}
          className={`text-sm text-stone-600 ${item.isMatch ? "font-bold" : ""}`}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
}

export default Search;
