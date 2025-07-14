import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import { Star, MoveVertical } from "lucide-react";
import Tooltip from "./Tooltip.tsx";
import type { App, AssistantRefObject, AppData } from "./AssistantState.ts";

type AppListState = "favorited" | "published" | "recent";

function AppList({
  appData,
  setAppData,
  assistantRef,
  modal = false,
  setShowApps = () => {},
}: {
  appData: AppData;
  setAppData: (appData: AppData) => void;
  assistantRef: AssistantRefObject;
  modal?: boolean;
  setShowApps?: (show: boolean) => void;
}) {
  const [state, setState] = useState<AppListState>("favorited");

  const states: AppListState[] = ["favorited", "published", "recent"];

  let message;
  if (state === "favorited") {
    message = "Your Assistant can open your favorited apps";
  }

  const displayApps = Object.values(appData).filter((app) => app[state]);

  let sort;
  if (state === "recent") {
    //most recent first
    sort = (a: App, b: App) => b[state]! - a[state]!;
  } else {
    //most recent last
    sort = (a: App, b: App) => a[state]! - b[state]!;
  }
  displayApps.sort(sort);

  const sortable = state === "favorited" || state === "published";
  const ListComponent = sortable ? SortableList : StaticList;
  const favoritable =
    state === "favorited" || state === "published" || state === "recent";

  return (
    <div
      className={
        modal
          ? "flex h-[440px] w-[680px] max-w-full justify-center p-3 text-sm md:text-base"
          : "flex justify-center pb-6"
      }
    >
      <div className="flex w-full max-w-lg flex-col items-center">
        <div className="flex w-full justify-evenly">
          {states.map((s) => (
            <AppListButton
              key={s}
              active={s === state}
              onClick={() => setState(s)}
              modal={modal}
            >
              {properCase(s)}
            </AppListButton>
          ))}
        </div>
        <p className="mt-2 text-lg font-medium">{`${properCase(state)} Apps`}</p>
        {message && (
          <p
            className={`text-center text-stone-500 ${
              modal ? "text-xs md:text-sm" : "text-sm"
            }`}
          >
            {message}
          </p>
        )}
        {displayApps.length > 0 ? (
          <ListComponent {...{ appData, setAppData, state, displayApps }}>
            <div
              id="app-list"
              className="mt-3 flex max-w-full flex-col divide-y divide-stone-300 border border-stone-500 bg-stone-50"
            >
              {displayApps.map((app) => (
                <AppCard
                  key={app.app}
                  app={app}
                  sortable={sortable}
                  favoritable={favoritable}
                  assistantRef={assistantRef}
                  modal={modal}
                  setShowApps={setShowApps}
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

function SortableList({
  appData,
  setAppData,
  state,
  displayApps,
  children,
}: {
  appData: AppData;
  setAppData: (appData: AppData) => void;
  state: AppListState;
  displayApps: App[];
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    if (active.id !== over.id) {
      //note that the ids we get from dnd are app.app, not app.id, since that's what we pass in
      const activeApp = appData[active.id];
      const overApp = appData[over.id];
      if (!activeApp || !overApp) return;
      const overState = overApp[state];
      if (!activeApp[state] || !overState) return;
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

function StaticList({ children }: { children: React.ReactNode }) {
  return children;
}

function AppListButton({
  active,
  onClick,
  children,
  modal,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  modal: boolean;
}) {
  return (
    <button
      className={`rounded-md py-px hover:bg-stone-200 ${
        active
          ? "border-2 border-stone-700 bg-stone-200 font-medium"
          : "border border-stone-500 bg-stone-100"
      } ${modal ? "px-0.5 md:w-20" : "w-20"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function AppCard({
  app,
  sortable,
  favoritable,
  assistantRef,
  modal,
  setShowApps,
}: {
  app: App;
  sortable: boolean;
  favoritable: boolean;
  assistantRef: AssistantRefObject;
  modal: boolean;
  setShowApps: (show: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: app.app });

  const style = sortable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    : undefined;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target instanceof HTMLElement &&
      e.target.tagName !== "BUTTON" &&
      !e.target.closest("button")
    ) {
      assistantRef.current.handleApp({ app: app.app });
      if (modal) {
        setShowApps(false);
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-full cursor-pointer items-center gap-1 px-2 py-1 hover:bg-stone-200"
      onClick={handleClick}
    >
      <div className="mx-1 min-w-0 grow text-wrap break-words">{app.app}</div>
      {favoritable && (
        <Tooltip text={app.favorited ? "Unfavorite app" : "Favorite app"}>
          <button
            className="relative"
            onClick={() => assistantRef.current.handleFavorite(app)}
          >
            <Star className={app.favorited ? "fill-yellow-200" : ""} />
            <span className="sr-only">
              {app.favorited ? "Unfavorite app" : "Favorite app"}
            </span>
          </button>
        </Tooltip>
      )}
      {sortable && (
        <Tooltip text="Drag to move">
          <button
            className="relative cursor-grab touch-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <MoveVertical />
            <span className="sr-only">Drag to move</span>
          </button>
        </Tooltip>
      )}
    </div>
  );
}

export default AppList;

function properCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
