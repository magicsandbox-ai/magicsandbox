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

function AppList({ appData, setAppData }) {
  const [state, setState] = useState("favorited");

  const states = ["favorited", "published", "recent", "blocked"];

  let message;
  if (state === "favorited") {
    message = "Your Assistant can launch your favorited apps";
  } else if (state === "blocked") {
    message = "Your Assistant will not launch blocked apps";
  }

  let filter;
  if (state === "recent") {
    filter = () => true;
  } else {
    filter = (app) => app[state];
  }
  const displayApps = Object.values(appData).filter(filter);

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

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-6">
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
      <p className="text-lg font-medium">{`${properCase(state)} Apps`}</p>
      {message && <p className="text-sm text-stone-500">{message}</p>}
      {displayApps.length > 0 ? (
        <ListComponent {...{ appData, setAppData, state, displayApps }}>
          <div className="flex flex-col items-center gap-2">
            {displayApps.map((app) => (
              <AppCard key={app.app} app={app} sortable={sortable} />
            ))}
          </div>
        </ListComponent>
      ) : (
        <p>Nothing to see here yet!</p>
      )}
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
          if (app[state] >= overState) {
            newAppData[key] = { ...app, [state]: app[state] + 1 };
          }
        });
      } else {
        //subtract 1 from overApp and everything before it
        Object.entries(appData).forEach(([key, app]) => {
          if (app[state] <= overState) {
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

function AppCard({ app, sortable }) {
  const CardComponent = sortable ? SortableCard : StaticCard;
  return (
    <CardComponent app={app}>
      <div>{app.id.split("@")[0]}</div>
    </CardComponent>
  );
}

function SortableCard({ app, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: app.app });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      className="touch-none" //https://docs.dndkit.com/api-documentation/sensors/pointer#touch-action
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function StaticCard({ children }) {
  return children;
}

export default AppList;

function properCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
