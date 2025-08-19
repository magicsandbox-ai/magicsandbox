import React from "react";
import type { Roster, Player } from "./types.ts";

function MyTeamTab({ myRoster }: { myRoster: Roster }) {
  const flatRoster: {
    player: Player | undefined;
    rosterSlot: string;
    slotIndex: number;
  }[] = [];

  Object.entries(myRoster).forEach(([position, players]) => {
    players.forEach((player, index) => {
      flatRoster.push({ player, rosterSlot: position, slotIndex: index });
    });
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-1 overflow-auto p-3">
        {flatRoster.map(({ player, rosterSlot, slotIndex }) => (
          <div
            key={`${rosterSlot}-${slotIndex}`}
            className="flex items-center gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <div className="w-12 rounded bg-gray-200 py-1 text-center text-xs font-bold text-gray-600">
              {rosterSlot}
            </div>
            {player ? (
              <div className="flex grow items-center justify-between text-sm leading-none">
                <div className="font-medium text-gray-900">
                  <span>
                    {player.player}
                    {player.icon && <span>{" " + player.icon}</span>}
                  </span>
                </div>
                <div className="text-gray-600">{player.team}</div>
              </div>
            ) : (
              <div className="text-sm italic leading-none text-gray-400">
                Empty
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MyTeamTab;
