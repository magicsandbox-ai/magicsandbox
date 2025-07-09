import React from "react";
import ModalOverlay from "@components/ModalOverlay.tsx";
import AppList from "./AppList.tsx";
import type { AppData, AssistantRefObject } from "./AssistantState.ts";

export default function AppModal({
  setShowApps,
  appData,
  setAppData,
  assistantRef,
}: {
  setShowApps: (show: boolean) => void;
  appData: AppData;
  setAppData: (appData: AppData) => void;
  assistantRef: AssistantRefObject;
}) {
  return (
    <ModalOverlay
      modal={
        <AppList
          appData={appData}
          setAppData={setAppData}
          assistantRef={assistantRef}
          modal={true}
          setShowApps={setShowApps}
        />
      }
      onClose={() => {
        setShowApps(false);
      }}
      fullScreen={true}
    />
  );
}
