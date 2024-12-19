/* global requestPutData */

import React from "react";
import Settings from "@components/Settings.js";

function AssistantSettings({ assistantRef, setModal, addToast }) {
  const initSettings = [
    {
      key: "trust",
      name: "Trust",
      description: "Trusted Apps or Authors",
      value: assistantRef.current.settingsRef.current.trust,
    },
    {
      key: "bangs",
      name: "Bangs",
      description: "Shortcuts to load Magic Apps",
      value: assistantRef.current.settingsRef.current.bangs,
      columns: ["Bang", "Magic App"],
    },
  ];

  function onClose() {
    setModal("");
  }

  async function handleSave(settings) {
    try {
      const newSettings = Object.fromEntries(
        settings.map(({ key, value }) => [key, value]),
      );
      await requestPutData(
        "magicsandbox.Assistant",
        "settings",
        Object.fromEntries(
          Object.entries(newSettings).map(([key, value]) => [
            key,
            value instanceof Set ? Array.from(value) : value, //need to serialize sets
          ]),
        ),
      );
      assistantRef.current.settingsRef.current = {
        ...assistantRef.current.settingsRef.current,
        ...newSettings,
      };
      addToast("Settings updated", "success");
      onClose();
    } catch (error) {
      console.error(error);
      addToast("Unexpected error updating settings", "error");
    }
  }

  return (
    <Settings
      initSettings={initSettings}
      onClose={onClose}
      onSave={handleSave}
    />
  );
}

export default AssistantSettings;
