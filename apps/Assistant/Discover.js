import React, { useState } from "react";
import ModalOverlay from "@components/ModalOverlay.js";
import { includeMetadata } from "./Assistant.js";
import { formatAsDollars } from "./utils.js";
import { Loader } from "lucide-react";

export default function Discover({ setShowDiscover, assistantRef }) {
  return (
    <ModalOverlay
      modal={<DiscoverInner assistantRef={assistantRef} />}
      onClose={() => {
        setShowDiscover(false);
      }}
      fullScreen={true}
    />
  );
}

function DiscoverInner({ assistantRef }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { results } = await requestFunction("discover", {
        query: searchQuery,
        includeMetadata,
        kind: "app",
      });
      setSearchResults(results);
    } finally {
      setIsLoading(false);
    }
  }

  const placeholder = "Search for apps...";

  return (
    <div className="flex h-[440px] w-[680px] flex-col gap-3 overflow-y-auto p-3">
      <form onSubmit={handleSearch}>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded border border-stone-200 p-2"
            autoFocus
            aria-label={placeholder}
          />
          <button
            type="submit"
            className="rounded bg-stone-200 px-4 py-2 font-bold hover:bg-stone-300"
          >
            Search
          </button>
        </div>
      </form>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader className="h-10 w-10 animate-spin" />
        </div>
      ) : (
        searchResults !== null && (
          <div className="flex-1 overflow-auto">
            {searchResults.length === 0 ? (
              <div className="text-center italic text-stone-500">
                No results found
              </div>
            ) : (
              searchResults.map((result) => (
                <SearchResult
                  key={result.id}
                  result={result}
                  assistantRef={assistantRef}
                />
              ))
            )}
          </div>
        )
      )}
    </div>
  );
}

function SearchResult({ result, assistantRef }) {
  const app = result.id.split("@")[0];

  function handleClick() {
    assistantRef.current.handleApp({ app, maxCost: result.minCost });
  }

  return (
    <button
      className="mb-4 w-full rounded border border-stone-200 p-3 text-left hover:bg-stone-50"
      onClick={handleClick}
      aria-label={app}
    >
      <div className="flex items-center justify-between">
        <div className="mb-1 font-medium">{app}</div>
        <div>{formatAsDollars(result.minCost)}</div>
      </div>
      <div className="line-clamp-2">{result.description}</div>
    </button>
  );
}
