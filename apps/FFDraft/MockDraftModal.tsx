import React from "react";
import Modal from "./Modal.tsx";
import type { LeagueSettings, DraftedPlayer } from "./types.ts";
import PlayerList from "./PlayerList.tsx";

//todo styling here is duplicated in RecentTab

export default function MockDraftModal({
  isOpen,
  onClose,
  leagueSettings,
  mockDraftedPlayers,
}: {
  isOpen: boolean;
  onClose: () => void;
  leagueSettings: LeagueSettings;
  mockDraftedPlayers: DraftedPlayer[] | null;
}) {
  if (!mockDraftedPlayers) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mock Draft Picks">
      <PlayerList
        players={mockDraftedPlayers}
        leftContent={(player) => (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
            <span className="text-sm font-bold text-gray-800">
              {player.draftedAt}
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
              <span>Rank {player.rank}</span>
            </div>
          </div>
        )}
        rightContent={(player) => (
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {player.fantasyTeam}
            </div>
            <div className="text-xs text-gray-500">
              Round {Math.ceil(player.draftedAt! / leagueSettings.teams.length)}
            </div>
          </div>
        )}
      />
      <div className="mt-4 flex justify-center">
        <button
          onClick={onClose}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Continue Draft
        </button>
      </div>
    </Modal>
  );
}
