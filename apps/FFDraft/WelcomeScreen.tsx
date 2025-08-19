import React from "react";
import type { LeagueSettings } from "./types.ts";

function WelcomeScreen({
  leagueSettings,
  setLeagueSettings,
  getDefaultTeamNames,
  onStartDraft,
}: {
  leagueSettings: LeagueSettings;
  setLeagueSettings: React.Dispatch<React.SetStateAction<LeagueSettings>>;
  getDefaultTeamNames: (numTeams: number) => string[];
  onStartDraft: () => void;
}) {
  const updateTeams = (value: string) => {
    const newTeams = getDefaultTeamNames(parseInt(value)); //todo combine with existing team names
    setLeagueSettings((prev) => ({ ...prev, teams: newTeams }));
  };
  const updateSetting = (key: keyof LeagueSettings, value: string) => {
    setLeagueSettings((prev) => ({ ...prev, [key]: parseInt(value) }));
  };

  const positionSettings: {
    key: keyof LeagueSettings;
    max: number;
  }[] = [
    { key: "QB", max: 3 },
    { key: "RB", max: 6 },
    { key: "WR", max: 6 },
    { key: "TE", max: 3 },
    { key: "FLEX", max: 6 },
    { key: "K", max: 2 },
    { key: "DST", max: 2 },
    { key: "BENCH", max: 12 },
  ];

  return (
    <div className="flex h-screen flex-col justify-center">
      <div className="mx-3 rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-800">
            🏈 Fantasy Draft
          </h1>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-4 text-xl font-semibold text-gray-800">
              League Settings
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Teams
                </label>
                <select
                  value={leagueSettings.teams.length}
                  onChange={(e) => updateTeams(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  {[8, 10, 12, 14, 16].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Your Pick
                </label>
                <select
                  value={leagueSettings.draftPosition}
                  onChange={(e) =>
                    updateSetting("draftPosition", e.target.value)
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from(
                    { length: leagueSettings.teams.length },
                    (_, i) => i + 1,
                  ).map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-medium text-gray-800">
              Roster Positions
            </h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {positionSettings.map(({ key, max }) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="font-medium text-gray-700">{key}</label>
                  <select
                    value={leagueSettings[key]}
                    onChange={(e) => updateSetting(key, e.target.value)}
                    className="w-16 rounded border border-gray-300 px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {Array.from({ length: max + 1 }, (_, i) => i).map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onStartDraft}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors duration-200 hover:bg-blue-700"
          >
            Start Draft
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;
