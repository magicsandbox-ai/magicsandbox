/*
"lucide-react": "^0.408.0",
*/
import React, { useState } from "react";
import Table from "./Table.js";

function Setting({ setting, settings, setSettings }) {
  let initData, onChange, allowAdd;
  if (typeof setting.value === "string" || typeof setting.value === "number") {
    initData = [{ value: setting.value }];
    onChange = (data) => {
      const value = data[0].value;
      setSettings(
        settings.map((s) => (s.name === setting.name ? { ...s, value } : s)),
      );
    };
    allowAdd = false;
  } else if (setting.value instanceof Set) {
    initData = [{ value: "" }];
    if (setting.value.size > 0) {
      initData = Array.from(setting.value).map((v) => ({ value: v }));
    }
    onChange = (data) => {
      const value = new Set(data.map((d) => d.value));
      setSettings(
        settings.map((s) => (s.name === setting.name ? { ...s, value } : s)),
      );
    };
    allowAdd = true;
  } else {
    //object interpreted as Map
    initData = [{ [setting.columns[0]]: "", [setting.columns[1]]: "" }];
    if (Object.keys(setting.value).length > 0) {
      initData = Object.entries(setting.value).map(([k, v]) => ({
        [setting.columns[0]]: k,
        [setting.columns[1]]: v,
      }));
    }
    onChange = (data) => {
      const value = Object.fromEntries(
        data.map((d) => [d[setting.columns[0]], d[setting.columns[1]]]),
      );
      setSettings(
        settings.map((s) => (s.name === setting.name ? { ...s, value } : s)),
      );
    };
    allowAdd = true;
  }
  return (
    <div className="flex flex-col gap-1">
      <p className="text-lg font-bold">{setting.name}</p>
      <p>{setting.description}</p>
      {setting.customContent}
      <Table initData={initData} onChange={onChange} allowAdd={allowAdd} />
    </div>
  );
}

function InnerSettings({ settings, setSettings, onSave }) {
  const buttonStyle =
    "rounded-md border-2 border-stone-500 bg-stone-200 px-1 py-px font-medium hover:bg-stone-300 w-28";
  return (
    <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-4">
      {settings.map((setting, i) => (
        <React.Fragment key={i}>
          <Setting
            setting={setting}
            settings={settings}
            setSettings={setSettings}
          />
          {i < settings.length - 1 && <hr className="border-stone-300" />}
        </React.Fragment>
      ))}
      <div className="flex justify-center gap-12">
        <button className={buttonStyle} onClick={() => onSave(settings)}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

function Settings({ initSettings, onSave }) {
  const [settings, setSettings] = useState(initSettings);
  return (
    <InnerSettings
      settings={settings}
      setSettings={setSettings}
      onSave={onSave}
    />
  );
}

export default Settings;
