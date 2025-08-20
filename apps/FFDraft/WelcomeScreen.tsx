import React, { useRef, useState } from "react";
import type { LeagueSettings, Player, DraftType, SavedDraft } from "./types.ts";
import { parsePlayersData, playersToCSV } from "./utils.ts";
import SavedDraftsModal from "./SavedDraftsModal.tsx";

function WelcomeScreen({
  leagueSettings,
  setLeagueSettings,
  getDefaultTeamNames,
  players,
  setPlayers,
  onStartDraft,
  onResumeDraft,
}: {
  leagueSettings: LeagueSettings;
  setLeagueSettings: React.Dispatch<React.SetStateAction<LeagueSettings>>;
  getDefaultTeamNames: (numTeams: number) => string[];
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  onStartDraft: (type: DraftType) => void;
  onResumeDraft: (draft: SavedDraft) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<
    { text: string; type: "error" | "success" } | undefined
  >(undefined);
  const [showSavedDrafts, setShowSavedDrafts] = useState(false);

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

  const loadButtonClass =
    "flex-1 rounded-md border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100";

  return (
    <div className="flex min-h-screen flex-col justify-center">
      <div className="mx-3 rounded-xl bg-white p-6 shadow-lg">
        <h1 className="mb-6 text-center text-3xl font-bold text-gray-800">
          🏈 Fantasy Draft
        </h1>
        <div className="space-y-4">
          <div className="flex gap-4">
            <button onClick={handleDownload} className={loadButtonClass}>
              Download Rankings
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={loadButtonClass}
            >
              Upload Rankings
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          {message && (
            <div
              className={`text-sm font-medium ${message.type === "error" ? "text-red-700" : "text-green-700"}`}
            >
              {message.text}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Teams
              </label>
              <select
                value={leagueSettings.teams.length}
                onChange={(e) => updateTeams(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
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
                onChange={(e) => updateSetting("draftPosition", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
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
          <div className="grid grid-cols-2 gap-4 text-sm">
            {positionSettings.map(({ key, max }) => (
              <div key={key} className="flex items-center justify-between">
                <label className="font-medium text-gray-700">{key}</label>
                <select
                  value={leagueSettings[key]}
                  onChange={(e) => updateSetting(key, e.target.value)}
                  className="w-16 rounded border border-gray-300 px-2 py-1"
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
          <div className="mt-6 space-y-3">
            <button
              onClick={() => onStartDraft("real")}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors duration-200 hover:bg-blue-700"
            >
              Start Draft
            </button>
            <button
              onClick={() => onStartDraft("mock")}
              className="w-full rounded-lg border-2 border-blue-600 bg-blue-50 px-4 py-3 font-semibold text-blue-600 transition-colors duration-200 hover:bg-blue-100"
            >
              Start Mock Draft
            </button>
            <button
              onClick={() => setShowSavedDrafts(true)}
              className="w-full rounded-lg border-2 border-gray-300 bg-gray-50 px-4 py-3 font-semibold text-gray-600 transition-colors duration-200 hover:bg-gray-100"
            >
              Resume Draft
            </button>
          </div>
        </div>
      </div>
      <SavedDraftsModal
        isOpen={showSavedDrafts}
        onClose={() => setShowSavedDrafts(false)}
        onResumeDraft={(draft) => {
          setShowSavedDrafts(false);
          onResumeDraft(draft);
        }}
      />
    </div>
  );
}

export default WelcomeScreen;
