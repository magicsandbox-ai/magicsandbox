import React from "react";
import type { LeagueSettings, Player, DraftedPlayer } from "./types.ts";

function RecentTab({
  leagueSettings,
  recentPlayers,
  setPlayers,
  currentPick,
  setCurrentPick,
}: {
  leagueSettings: LeagueSettings;
  recentPlayers: DraftedPlayer[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  currentPick: number;
  setCurrentPick: React.Dispatch<React.SetStateAction<number>>;
}) {
  if (recentPlayers.length === 0) {
    return (
      <div className="h-full p-4">
        <div className="flex h-full items-center justify-center bg-white p-6">
          <div className="text-center text-gray-500">
            <h3 className="mb-2 text-lg font-medium">Recent Picks</h3>
            <p className="text-sm">Recently drafted players will appear here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with Undo button */}
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Recent Picks</h2>

          <button
            onClick={() => {
              const lastPick = currentPick - 1;
              setPlayers((prev) =>
                prev.map((player) =>
                  player.draftedAt === lastPick
                    ? { ...player, draftedAt: undefined }
                    : player,
                ),
              );
              setCurrentPick(lastPick);
            }}
            className="rounded bg-red-100 px-3 py-2 text-sm font-medium text-red-700 transition-colors duration-150 hover:bg-red-200"
          >
            Undo Last Pick
          </button>
        </div>
      </div>

      {/* Recent picks list */}
      <div className="flex-1 overflow-auto">
        <div className="divide-y divide-gray-200">
          {recentPlayers.map((player) => (
            <div
              key={`${player.player}-${player.draftedAt}`}
              className="px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <span className="text-sm font-bold text-gray-800">
                      {player.draftedAt}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        {player.player}
                      </h3>
                      {player.icon && (
                        <span className="text-lg">{player.icon}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                        {player.pos}
                      </span>
                      <span>{player.team}</span>
                      <span>Rank {player.rank}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {player.fantasyTeam}
                  </div>
                  <div className="text-xs text-gray-500">
                    Round{" "}
                    {Math.ceil(player.draftedAt / leagueSettings.teams.length)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RecentTab;
