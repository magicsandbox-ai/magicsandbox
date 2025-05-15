import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Toasts, type ToastsRef } from "@components/Toasts.tsx";
import SideBar from "./SideBar.tsx";
import Info from "./Info.tsx";
import Note from "./Note.tsx";
import DeleteConfirm from "./DeleteConfirm.tsx";
import Search from "./Search.tsx";
import NotesState from "./NotesState.ts";

let notesState: NotesState | undefined;

async function init() {
  const allData = await requestGetAllData();
  const { currentNodeUuid, ...nodes } = allData;
  notesState = new NotesState(nodes, currentNodeUuid);
  createRoot(document.getElementById("root")!).render(<App />);
  return notesState.context(true);
}

function App() {
  const [showSideBar, setShowSideBar] = useState(window.innerWidth > 768);
  const [showInfo, setShowInfo] = useState(false);
  const [deleteUuid, setDeleteUuid] = useState<string | undefined>(undefined);
  const [showSearch, setShowSearch] = useState(false);

  const toastsRef = useRef<ToastsRef | null>(null);

  useEffect(() => {
    if (notesState && toastsRef.current) {
      notesState._toastsRef = toastsRef.current;
    }
  }, []);

  if (!notesState) return;

  let modalComponent;
  if (deleteUuid) {
    modalComponent = (
      <DeleteConfirm
        {...{
          deleteUuid,
          setDeleteUuid,
          notesState,
        }}
      />
    );
  } else if (showSearch) {
    modalComponent = (
      <Search
        {...{
          notesState,
          setShowSearch,
        }}
      />
    );
  } else if (showInfo) {
    modalComponent = <Info setShowInfo={setShowInfo} />;
  }

  return (
    <div
      className="flex h-screen w-screen"
      onClick={(e) => {
        if (
          window.innerWidth <= 768 &&
          showSideBar &&
          e.target instanceof Element &&
          !e.target.closest("nav")
        ) {
          setShowSideBar(false);
        }
      }}
    >
      <SideBar
        {...{
          notesState,
          showSideBar,
          setShowSideBar,
          setShowInfo,
          setDeleteUuid,
          setShowSearch,
        }}
      />
      <Note
        {...{
          notesState,
          showSideBar,
        }}
      />
      {modalComponent}
      <Toasts className="top-2" ref={toastsRef} />
    </div>
  );
}

function context() {
  return notesState!.context();
}

const api = {
  addNote: (...args: Parameters<NotesState["apiAddNote"]>) =>
    notesState!.apiAddNote(...args),
  appendToNote: (...args: Parameters<NotesState["apiAppendToNote"]>) =>
    notesState!.apiAppendToNote(...args),
  replaceNote: (...args: Parameters<NotesState["apiReplaceNote"]>) =>
    notesState!.apiReplaceNote(...args),
  editNote: (...args: Parameters<NotesState["apiEditNote"]>) =>
    notesState!.apiEditNote(...args),
  renameNode: (...args: Parameters<NotesState["apiRenameNode"]>) =>
    notesState!.apiRenameNode(...args),
  moveNodes: (...args: Parameters<NotesState["apiMoveNodes"]>) =>
    notesState!.apiMoveNodes(...args),
  deleteNodes: (...args: Parameters<NotesState["apiDeleteNodes"]>) =>
    notesState!.apiDeleteNodes(...args),
  logNotes: (...args: Parameters<NotesState["apiLogNotes"]>) =>
    notesState!.apiLogNotes(...args),
};

export { init, context, api };
