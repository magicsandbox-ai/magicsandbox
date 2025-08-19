import React from "react";
import type { FlatRoster, Player } from "./types.ts";
import PlayerList from "./PlayerList.tsx";

function MyTeamTab({
  myFlatRoster,
  onPlayerClick,
}: {
  myFlatRoster: FlatRoster;
  onPlayerClick: (player: Player) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <PlayerList
        players={myFlatRoster}
        leftContent={({ rosterSlot }) => (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
            <span
              className={`${rosterSlot === "BENCH" ? "text-[10px]" : "text-sm"} font-bold text-gray-800`}
            >
              {rosterSlot}
            </span>
          </div>
        )}
        middleContent={({ player }) =>
          player ? (
            <div className="text-sm font-medium text-gray-900">
              {player.player + (player.icon ? " " + player.icon : "")}
            </div>
          ) : (
            <div className="text-sm italic leading-none text-gray-400">
              Empty
            </div>
          )
        }
        rightContent={({ player }) =>
          player ? (
            <div className="text-sm text-gray-600">{player.team}</div>
          ) : null
        }
        onPlayerClick={({ player }) => player && onPlayerClick(player)}
        isClickable={({ player }) => player !== null}
      />
    </div>
  );
}

export default MyTeamTab;
