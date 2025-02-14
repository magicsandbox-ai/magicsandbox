import React, { useState } from "react";

function AppList({ appData }) {
  const [state, setState] = useState("Favorited");

  const states = ["Favorited", "Recent", "Published", "Blocked"];
  let filter;
  if (state === "Recent") {
    filter = () => true;
  } else {
    filter = (app) => app[state.toLowerCase()];
  }
  const displayApps = Object.values(appData).filter(filter);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-6">
        {states.map((s) => (
          <AppListButton
            key={s}
            active={s === state}
            onClick={() => setState(s)}
          >
            {s}
          </AppListButton>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-lg font-medium">{`${state} Apps`}</p>
        {displayApps.length > 0 ? (
          displayApps.map((app) => <AppCard key={app.id} app={app} />)
        ) : (
          <p>Nothing to see here yet!</p>
        )}
      </div>
    </div>
  );
}

function AppListButton({ active, onClick, children }) {
  return (
    <button
      className={`w-20 rounded-md py-px hover:bg-stone-300 ${
        active
          ? "border-2 border-stone-700 bg-stone-200 font-medium"
          : "border border-stone-500 bg-stone-100"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/*
- id, description, icon for deprecated
- expand to see minCost, finalCost, deprecated explained
- expand to edit and pin a version? link to homepage?
- buttons to (un)favorite, (un)block
- add bang?
*/

function AppCard({ app }) {
  return <div>{app.id.split("@")[0]}</div>;
}

export default AppList;
