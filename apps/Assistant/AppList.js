import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Star, Ban, MoveVertical } from "lucide-react";

function AppList({ appData, setAppData, assistantRef }) {
  const [state, setState] = useState("favorited");

  const states = ["favorited", "published", "recent", "blocked"];

  let message;
  if (state === "favorited") {
    message = "Your Assistant can launch your favorited apps";
  } else if (state === "blocked") {
    message =
      "Blocked apps don't appear in searches and can't be launched without approval";
  }

  const displayApps = Object.values(appData).filter((app) => app[state]);

  let sort;
  if (state === "recent") {
    //most recent first
    sort = (a, b) => b[state] - a[state];
  } else {
    //most recent last
    sort = (a, b) => a[state] - b[state];
  }
  displayApps.sort(sort);

  const sortable = state === "favorited" || state === "published";
  const ListComponent = sortable ? SortableList : StaticList;
  const favoritable =
    state === "favorited" || state === "published" || state === "recent";
  const blockable = state === "recent" || state === "blocked";

  return (
    <div className="flex justify-center pb-6">
      <div className="flex w-full max-w-lg flex-col items-center">
        <div className="flex w-full justify-evenly">
          {states.map((s) => (
            <AppListButton
              key={s}
              active={s === state}
              onClick={() => setState(s)}
            >
              {properCase(s)}
            </AppListButton>
          ))}
        </div>
        <p className="mt-2 text-lg font-medium">{`${properCase(state)} Apps`}</p>
        {message && (
          <p className="text-center text-sm text-stone-500">{message}</p>
        )}
        {displayApps.length > 0 ? (
          <ListComponent {...{ appData, setAppData, state, displayApps }}>
            <div className="mt-3 flex max-w-full flex-col divide-y divide-stone-300 border border-stone-500 bg-stone-50">
              {displayApps.map((app) => (
                <AppCard
                  key={app.app}
                  app={app}
                  sortable={sortable}
                  favoritable={favoritable}
                  blockable={blockable}
                  assistantRef={assistantRef}
                />
              ))}
            </div>
          </ListComponent>
        ) : (
          <p className="mt-3">Nothing to see here yet!</p>
        )}
      </div>
    </div>
  );
}

function SortableList({ appData, setAppData, state, displayApps, children }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (active.id !== over.id) {
      //note that the ids we get from dnd are app.app, not app.id, since that's what we pass in
      const activeApp = appData[active.id]; //clone because we're mutating
      const overApp = appData[over.id];
      const overState = overApp[state];
      const newAppData = { ...appData };
      if (activeApp[state] > overState) {
        //add 1 to overApp and everything after it
        Object.entries(appData).forEach(([key, app]) => {
          if (app[state] && app[state] >= overState) {
            newAppData[key] = { ...app, [state]: app[state] + 1 };
          }
        });
      } else {
        //subtract 1 from overApp and everything before it
        Object.entries(appData).forEach(([key, app]) => {
          if (app[state] && app[state] <= overState) {
            newAppData[key] = { ...app, [state]: app[state] - 1 };
          }
        });
      }
      //activeApp gets overApp's state
      newAppData[active.id] = { ...activeApp, [state]: overState };
      setAppData(newAppData);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext
        items={displayApps.map((app) => app.app)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

function StaticList({ children }) {
  return children;
}

function AppListButton({ active, onClick, children }) {
  return (
    <button
      className={`w-20 rounded-md py-px hover:bg-stone-200 ${
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
- expand to see description, minCost, finalCost?, status
- expand to see versions, pin a version? link to homepage?
- add bang?
*/

function AppCard({ app, sortable, favoritable, blockable, assistantRef }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: app.app });

  const style = sortable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    : undefined;

  const handleClick = (e) => {
    if (e.target.tagName !== "BUTTON" && !e.target.closest("button")) {
      assistantRef.current.handleApp({ app: app.app, maxCost: app.minCost });
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-full cursor-pointer items-center gap-1 px-2 py-1 hover:bg-stone-200"
      onClick={handleClick}
    >
      <div className="mx-1 min-w-0 grow text-wrap break-words">
        {app.id.split("@")[0]}
      </div>
      {favoritable && (
        <button onClick={() => assistantRef.current.handleFavorite(app)}>
          <Star className={app.favorited ? "fill-yellow-500" : ""} />
          <span className="sr-only">Favorite</span>
        </button>
      )}
      {blockable && (
        <button onClick={() => assistantRef.current.handleBlock(app)}>
          <Ban className={app.blocked ? "text-red-500" : ""} />
          <span className="sr-only">Block</span>
        </button>
      )}
      {sortable && (
        <button
          className="cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <MoveVertical />
          <span className="sr-only">Drag to reorder</span>
        </button>
      )}
    </div>
  );
}

export default AppList;

function properCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
