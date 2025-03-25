import React, { useState } from "react";
import ModalOverlay from "@components/ModalOverlay.js";
import { formatAsDollars } from "./utils.js";
import { Loader } from "lucide-react";

export default function Discover({ setShowDiscover, assistantRef, appData }) {
  return (
    <ModalOverlay
      modal={
        <DiscoverInner
          assistantRef={assistantRef}
          appData={appData}
          setShowDiscover={setShowDiscover}
        />
      }
      onClose={() => {
        setShowDiscover(false);
      }}
      fullScreen={true}
    />
  );
}

function DiscoverInner({ assistantRef, appData, setShowDiscover }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [status, setStatus] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    setStatus("loading");
    try {
      const { result } = await requestFunction("magicsandbox.discover", {
        query: searchQuery,
        includeMetadata: ["id", "description", "minCost", "type"],
        kind: "app",
        limit: 100,
      });
      const newSearchResults = result
        .filter((r) => {
          if (r.type === "assistant") {
            return false;
          }
          if (appData[r.id.split("@")[0]]?.blocked) {
            return false;
          }
          return true;
        })
        .map((r) => ({
          ...r,
          score: r.relevance - 10 * r.minCost,
        }))
        .sort((a, b) => b.score - a.score);
      setSearchResults(newSearchResults);
      setStatus(null);
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }

  const placeholder = "Search for apps...";

  //styling here duplicated from Search

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
      {status === "loading" ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader className="h-10 w-10 animate-spin" />
          <span className="sr-only">Loading...</span>
        </div>
      ) : status === "error" ? (
        <div className="flex flex-1 items-center justify-center text-red-600">
          An unexpected error occurred. Please try again.
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
                  setShowDiscover={setShowDiscover}
                />
              ))
            )}
          </div>
        )
      )}
    </div>
  );
}

function SearchResult({ result, assistantRef, setShowDiscover }) {
  const app = result.id.split("@")[0];

  function handleClick() {
    assistantRef.current.handleApp({ app, maxCost: result.minCost });
    setShowDiscover(false);
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
