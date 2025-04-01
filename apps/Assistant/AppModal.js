import React from "react";
import ModalOverlay from "@components/ModalOverlay.js";
import AppList from "./AppList.js";

export default function AppModal({
  setShowApps,
  appData,
  setAppData,
  assistantRef,
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
