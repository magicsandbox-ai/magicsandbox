import React from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { X } from "lucide-react";
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
  team: string,
  position: Position,
  maxDepth: number,
) => {
  return players
    .filter((p) => p.team === team && p.pos === position)
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

  // Compute full NFL team offense depth chart
  const nflTeamOffense = React.useMemo(() => {
    const team = player.team;
    const offense = [
      ...getPositionDepthChart(players, team, "QB", 1),
      ...getPositionDepthChart(players, team, "RB", 3),
      ...getPositionDepthChart(players, team, "WR", 4),
      ...getPositionDepthChart(players, team, "TE", 2),
    ];
    return offense;
  }, [players, player.team]);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b p-3">
            <DialogTitle className="text-xl font-bold text-gray-900">
              {player.team} Offense
            </DialogTitle>
            <button
              onClick={onClose}
              className="self-start text-gray-400 transition-colors hover:text-gray-600"
            >
              <X />
              <span className="sr-only">Close</span>
            </button>
          </div>
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
        </DialogPanel>
      </div>
    </Dialog>
  );
}
