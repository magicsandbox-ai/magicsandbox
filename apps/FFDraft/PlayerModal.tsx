import React from "react";
import Modal from "./Modal.tsx";
import type { Player, Position } from "./types.ts";
import PlayerList from "./PlayerList.tsx";

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  players: Player[];
}

// Helper function to get color based on overall rank
const getRankStyle = (rank: number): React.CSSProperties => {
  const normalizedValue = Math.max(0, Math.min((Math.sqrt(rank) - 1) / 17, 1));
  const hue = (1 - normalizedValue) * 120;
  return {
    backgroundColor: `hsl(${hue}, 70%, 60%)`,
    color: `hsl(${hue}, 90%, 15%)`,
  };
};

// Helper function to get the depth chart for a position
const getPositionDepthChart = (
  players: Player[],
  position: Position,
  maxDepth: number,
) => {
  return players
    .filter((p) => p.pos === position)
    .sort((a, b) => a.rank - b.rank) // Sort by overall rank (better players first)
    .slice(0, maxDepth)
    .map((p, index) => ({
      player: p,
      depthPosition: `${position}${index + 1}`,
    }));
};

export default function PlayerModal({
  isOpen,
  onClose,
  player,
  players,
}: PlayerModalProps) {
  if (!player) return null;

  const nflTeamPlayers = players.filter((p) => p.team === player.team);
  const nflTeamOffense = [
    ...getPositionDepthChart(nflTeamPlayers, "QB", 1),
    ...getPositionDepthChart(nflTeamPlayers, "RB", 3),
    ...getPositionDepthChart(nflTeamPlayers, "WR", 4),
    ...getPositionDepthChart(nflTeamPlayers, "TE", 2),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={player.team + " Offense"}>
      <PlayerList
        players={nflTeamOffense}
        leftContent={({ depthPosition }) => (
          <div className="flex h-8 w-12 flex-shrink-0 items-center justify-center rounded bg-gray-100">
            <span className="text-xs font-bold text-gray-800">
              {depthPosition}
            </span>
          </div>
        )}
        middleContent={({ player: p }) => (
          <div
            className={`flex-1 text-sm ${p.player === player.player ? "font-bold text-gray-900" : "font-medium text-gray-600"}`}
          >
            {p.player + (p.icon ? " " + p.icon : "")}
          </div>
        )}
        rightContent={({ player: p }) => (
          <div
            className="flex h-8 w-24 items-center justify-center rounded text-xs font-bold"
            style={getRankStyle(p.rank)}
          >
            <span>
              {p.pos}
              {p.positionRank} OVR{p.rank}
            </span>
          </div>
        )}
      />
    </Modal>
  );
}
