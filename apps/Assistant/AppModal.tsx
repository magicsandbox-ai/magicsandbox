import React from "react";
import ModalOverlay from "@components/ModalOverlay.tsx";
import AppList from "./AppList.tsx";
import type { AppData, AssistantState } from "./AssistantState.ts";

export default function AppModal({
  setShowApps,
  appData,
  assistantState,
}: {
  setShowApps: (show: boolean) => void;
  appData: AppData;
  assistantState: AssistantState;
}) {
  return (
    <ModalOverlay
      modal={
        <AppList
          appData={appData}
          assistantState={assistantState}
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
