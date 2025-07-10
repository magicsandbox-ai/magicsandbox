import React, { useState } from "react";
import ModalOverlay from "@components/ModalOverlay.tsx";
import { Loader, Star } from "lucide-react";
import type {
  AssistantRefObject,
  AppData,
  DiscoverApp,
} from "./AssistantState.ts";

const discoverMetadata = ["id", "description", "type", "usage"];

function Discover({
  setShowDiscover,
  assistantRef,
  popularApps,
  appData,
}: {
  setShowDiscover: (show: boolean) => void;
  assistantRef: AssistantRefObject;
  popularApps: DiscoverApp[];
  appData: AppData;
}) {
  return (
    <ModalOverlay
      modal={
        <DiscoverInner
          assistantRef={assistantRef}
          setShowDiscover={setShowDiscover}
          popularApps={popularApps}
          appData={appData}
        />
      }
      onClose={() => {
        setShowDiscover(false);
      }}
      fullScreen={true}
    />
  );
}

function DiscoverInner({
  assistantRef,
  setShowDiscover,
  popularApps,
  appData,
}: {
  assistantRef: AssistantRefObject;
  setShowDiscover: (show: boolean) => void;
  popularApps: DiscoverApp[];
  appData: AppData;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [apps, setApps] = useState(() => {
    const filteredApps = popularApps?.filter((r) => filterResult(r));
    if (filteredApps?.length > 0) {
      return filteredApps;
    }
    return null;
  });
  const [showingPopular, setShowingPopular] = useState(true);
  const [status, setStatus] = useState<"loading" | "error" | null>(null);

  function filterResult(r: DiscoverApp) {
    if (r.type === "assistant") {
      return false;
    }
    const app = r.id.split("@")[0];
    if (app === "magicsandbox.Docs" || app === "magicsandbox.About") {
      return false;
    }
    return true;
  }

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (window.innerWidth < 768 && e.target instanceof HTMLFormElement) {
      //hide virtual keyboard on mobile
      const input = e.target.querySelector('input[type="search"]');
      if (input instanceof HTMLInputElement) {
        input.blur();
      }
    }
    setStatus("loading");
    try {
      const { result } = await requestFunction<any, DiscoverApp[]>(
        "magicsandbox.discover@0.0",
        {
          query: searchQuery,
          includeMetadata: discoverMetadata,
          kind: "app",
          limit: 100,
        },
      );
      const newApps = result
        .filter((r) => filterResult(r))
        .map((r) => ({
          ...r,
          score: r.relevance * Math.min(Math.log10(r.usage + 1) / 4 + 0.5, 2),
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
                    discoverApp={app}
                    assistantRef={assistantRef}
                    setShowDiscover={setShowDiscover}
                    appData={appData}
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

function App({
  discoverApp,
  assistantRef,
  setShowDiscover,
  appData,
}: {
  discoverApp: DiscoverApp;
  assistantRef: AssistantRefObject;
  setShowDiscover: (show: boolean) => void;
  appData: AppData;
}) {
  const authorName = discoverApp.id.split("@")[0]!;
  const app = {
    id: discoverApp.id,
    app: authorName,
    description: discoverApp.description,
    favorited: appData[authorName]?.favorited,
    recent: appData[authorName]?.recent,
    published: appData[authorName]?.published,
  };

  function handleClick() {
    assistantRef.current.handleApp({ app: app.app });
    setShowDiscover(false);
  }

  return (
    <div
      className="mb-4 w-full cursor-pointer rounded border border-stone-200 p-3 text-left hover:bg-stone-50"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={app.app}
    >
      <div className="items-center justify-between md:flex">
        <div className="mb-1 min-w-0 break-words text-sm font-medium md:text-base">
          {app.app}
        </div>
        <div className="text-xs text-stone-500 md:text-sm">
          {`Used ${formatNumber(discoverApp.usage)} times`}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="line-clamp-2 text-sm md:text-base">
          {app.description}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            assistantRef.current.handleFavorite(app);
          }}
        >
          <Star className={app.favorited ? "fill-yellow-200" : ""} />
          <span className="sr-only">Favorite</span>
        </button>
      </div>
    </div>
  );
}

export { Discover, discoverMetadata };

function formatNumber(num: number) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}
