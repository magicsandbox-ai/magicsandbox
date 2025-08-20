import React, { useState, useMemo } from "react";
import type { Player, Position } from "./types.ts";
import PlayerList from "./PlayerList.tsx";

function AvailableTab({
  availablePlayers,
  availablePositions,
  draftPlayer,
  userIsCurrentTeam,
  draftIsComplete,
  onPlayerClick,
}: {
  availablePlayers: Player[];
  availablePositions: Record<Position, boolean>;
  draftPlayer: (player: Player) => void;
  userIsCurrentTeam: boolean;
  draftIsComplete: boolean;
  onPlayerClick: (player: Player) => void;
}) {
  const [positionFilter, setPositionFilter] = useState("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const positions = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];

  const teams = useMemo(() => {
    const uniqueTeams = [
      ...new Set(availablePlayers.map((player) => player.team)),
    ];
    return ["ALL", ...uniqueTeams.sort()];
  }, []);

  // Filter players based on current filters
  const filteredPlayers = useMemo(() => {
    return availablePlayers.filter((player) => {
      const matchesPosition =
        positionFilter === "ALL" || player.pos === positionFilter;
      const matchesTeam = teamFilter === "ALL" || player.team === teamFilter;
      const matchesSearch =
        searchTerm === "" ||
        player.player.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.team.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesPosition && matchesTeam && matchesSearch;
    });
  }, [availablePlayers, positionFilter, teamFilter, searchTerm]);

  return (
    <div className="flex h-full flex-col">
      {/* Filter Controls */}
      <div className="space-y-4 border-b bg-white p-4">
        {/* Search Bar */}
        <div>
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Position and Team Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="min-w-32 flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Position
            </label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-32 flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Team
            </label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600">
          Showing {filteredPlayers.length} of {availablePlayers.length} players
        </div>
      </div>
      <PlayerList
        players={filteredPlayers}
        leftContent={(player) => (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
            <span className="text-sm font-bold text-blue-800">
              {player.rank}
            </span>
          </div>
        )}
        middleContent={(player) => (
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-gray-900">
                {player.player + (player.icon ? " " + player.icon : "")}
              </h3>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                {player.pos}
              </span>
              <span>{player.team}</span>
            </div>
          </div>
        )}
        rightContent={(player) =>
          !draftIsComplete && availablePositions[player.pos] ? (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent modal from opening
                draftPlayer(player);
              }}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors duration-150 ${
                userIsCurrentTeam
                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                  : "bg-blue-100 text-blue-800 hover:bg-blue-200"
              }`}
            >
              {userIsCurrentTeam ? "Draft!" : "Draft"}
            </button>
          ) : null
        }
        onPlayerClick={onPlayerClick}
        emptyState={
          <div className="flex h-32 items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="mb-2 text-2xl">🔍</div>
              <p className="text-sm">No players match your current filters</p>
            </div>
          </div>
        }
      />
    </div>
  );
}

export default AvailableTab;
