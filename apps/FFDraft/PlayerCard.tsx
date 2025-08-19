import React from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import type { Player } from "./types.ts";

interface PlayerCardProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
}

export default function PlayerCard({
  isOpen,
  onClose,
  player,
}: PlayerCardProps) {
  if (!player) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />

      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="max-w-lg space-y-4 rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-2xl font-bold text-gray-900">
            {player.player}
          </DialogTitle>

          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-500">Team:</span>
                <span className="text-sm text-gray-900">{player.team}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-500">
                  Position:
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${getPositionColor(player.pos)}`}
                >
                  {player.pos}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-500">Rank:</span>
              <span className="text-lg font-bold text-blue-600">
                #{player.rank}
              </span>
            </div>

            {player.icon && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-500">Icon:</span>
                <span className="text-2xl">{player.icon}</span>
              </div>
            )}

            {player.draftedAt && (
              <div className="border-t pt-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-500">
                    Drafted:
                  </span>
                  <span className="text-sm text-gray-900">
                    Pick #{player.draftedAt}
                  </span>
                </div>
                {player.fantasyTeam && (
                  <div className="mt-1 flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">
                      Team:
                    </span>
                    <span className="text-sm text-gray-900">
                      {player.fantasyTeam}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end border-t pt-4">
            <button
              onClick={onClose}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function getPositionColor(position: string): string {
  const colors = {
    QB: "bg-red-100 text-red-800",
    RB: "bg-green-100 text-green-800",
    WR: "bg-blue-100 text-blue-800",
    TE: "bg-yellow-100 text-yellow-800",
    K: "bg-purple-100 text-purple-800",
    DST: "bg-gray-100 text-gray-800",
  };
  return colors[position as keyof typeof colors] || "bg-gray-100 text-gray-800";
}
