import React, { useRef, useState } from "react";
import type { LeagueSettings, Player } from "./types.ts";
import { parsePlayersData, playersToCSV } from "./utils.ts";

function WelcomeScreen({
  leagueSettings,
  setLeagueSettings,
  getDefaultTeamNames,
  players,
  setPlayers,
  onStartDraft,
}: {
  leagueSettings: LeagueSettings;
  setLeagueSettings: React.Dispatch<React.SetStateAction<LeagueSettings>>;
  getDefaultTeamNames: (numTeams: number) => string[];
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  onStartDraft: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<
    { text: string; type: "error" | "success" } | undefined
  >(undefined);

  const updateTeams = (value: string) => {
    const newTeams = getDefaultTeamNames(parseInt(value)); //todo combine with existing team names
    setLeagueSettings((prev) => ({ ...prev, teams: newTeams }));
  };
  const updateSetting = (key: keyof LeagueSettings, value: string) => {
    setLeagueSettings((prev) => ({ ...prev, [key]: parseInt(value) }));
  };

  const handleDownload = async () => {
    try {
      await requestDownload("rankings.csv", playersToCSV(players));
    } catch (err) {
      console.error(err);
      setMessage({ text: "Failed to download rankings", type: "error" });
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rankingsCSV = await file.text();
      const newPlayers = parsePlayersData(rankingsCSV);
      setPlayers(newPlayers);
      setMessage({
        text: `Successfully loaded ${newPlayers.length} players from rankings CSV`,
        type: "success",
      });
    } catch (err) {
      console.error(err);
      setMessage({
        text:
          err instanceof Error
            ? err.message
            : "Unexpected error reading rankings CSV",
        type: "error",
      });
    } finally {
      event.target.value = "";
    }
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
    <div className="flex min-h-screen flex-col justify-center">
      <div className="mx-3 rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-800">
            🏈 Fantasy Draft
          </h1>
        </div>
        <div className="space-y-6">
          <div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  Download Rankings CSV
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 rounded-md border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  Upload Rankings CSV
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
          {message && (
            <div
              className={`text-sm font-medium ${message.type === "error" ? "text-red-700" : "text-green-700"}`}
            >
              {message.text}
            </div>
          )}
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
