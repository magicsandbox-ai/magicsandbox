import React, { useState } from "react";
import ModalOverlay from "@components/ModalOverlay.js";
import { formatAsDollars } from "./utils.js";
import { Loader } from "lucide-react";

function Discover({ setShowDiscover, assistantRef, popularApps }) {
  return (
    <ModalOverlay
      modal={
        <DiscoverInner
          assistantRef={assistantRef}
          setShowDiscover={setShowDiscover}
          popularApps={popularApps}
        />
      }
      onClose={() => {
        setShowDiscover(false);
      }}
      fullScreen={true}
    />
  );
}

const discoverMetadata = ["id", "description", "minCost", "type", "usage"];

function DiscoverInner({ assistantRef, setShowDiscover, popularApps }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [apps, setApps] = useState(() => {
    const filteredApps = popularApps?.filter((r) => filterResult(r));
    if (filteredApps?.length > 0) {
      return filteredApps;
    }
    return null;
  });
  const [showingPopular, setShowingPopular] = useState(true);
  const [status, setStatus] = useState(null);

  function filterResult(r) {
    if (r.type === "assistant") {
      return false;
    }
    const app = r.id.split("@")[0];
    if (app === "magicsandbox.Docs" || app === "magicsandbox.About") {
      return false;
    }
    return true;
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (window.innerWidth < 768) {
      //hide virtual keyboard on mobile
      e.target.querySelector('input[type="search"]').blur();
    }
    setStatus("loading");
    try {
      const { result } = await requestFunction("magicsandbox.discover@0.1", {
        query: searchQuery,
        includeMetadata: discoverMetadata,
        kind: "app",
        limit: 100,
      });
      const newApps = result
        .filter((r) => filterResult(r))
        .map((r) => ({
          ...r,
          score:
            r.relevance *
            (1 - r.minCost * 0.5) *
            Math.min(Math.log10(r.usage + 1) / 4 + 0.5, 2),
        }))
        .sort((a, b) => b.score - a.score);
      setApps(newApps);
      setShowingPopular(false);
      setStatus(null);
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  }

  const placeholder = "Search for apps...";

  //styling here duplicated from Search

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
        apps !== null && (
          <div className="flex-1 overflow-auto">
            {apps.length === 0 ? (
              <div className="text-center italic text-stone-500">
                No results found
              </div>
            ) : (
              <>
                {showingPopular && (
                  <div className="mb-4 text-center text-lg font-bold">
                    Most Popular Apps
                  </div>
                )}
                {apps.map((app) => (
                  <App
                    key={app.id}
                    app={app}
                    assistantRef={assistantRef}
                    setShowDiscover={setShowDiscover}
                  />
                ))}
              </>
            )}
          </div>
        )
      )}
    </div>
  );
}

function App({ app, assistantRef, setShowDiscover }) {
  const appName = app.id.split("@")[0];

  function handleClick() {
    assistantRef.current.handleApp({ app: appName });
    setShowDiscover(false);
  }

  //todo display usage?

  return (
    <button
      className="mb-4 w-full rounded border border-stone-200 p-3 text-left hover:bg-stone-50"
      onClick={handleClick}
      aria-label={appName}
    >
      <div className="flex items-center justify-between">
        <div className="mb-1 font-medium">{appName}</div>
        <div>{formatAsDollars(app.minCost)}</div>
      </div>
      <div className="line-clamp-2">{app.description}</div>
    </button>
  );
}

export { Discover, discoverMetadata };
