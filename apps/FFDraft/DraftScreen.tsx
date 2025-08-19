import React, { useState } from "react";
import AvailableTab from "./AvailableTab.js";
import RecentTab from "./RecentTab.js";
import MyTeamTab from "./MyTeamTab.js";
import type {
  State,
  LeagueSettings,
  Player,
  DraftedPlayer,
  Roster,
} from "./types.ts";

type TabId = "available" | "recent" | "myTeam";

function DraftScreen({
  state,
  leagueSettings,
  players,
  setPlayers,
  currentPick,
  setCurrentPick,
  onExitDraft,
}: {
  state: State;
  leagueSettings: LeagueSettings;
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  currentPick: number;
  setCurrentPick: React.Dispatch<React.SetStateAction<number>>;
  onExitDraft: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("available");

  const tabs: { id: TabId; label: string }[] = [
    { id: "available", label: "Available" },
    { id: "recent", label: "Recent" },
    { id: "myTeam", label: "My Team" },
  ];

  function getRoundFromPick(pick: number) {
    return Math.ceil(pick / leagueSettings.teams.length);
  }

  function getTeamFromPick(pick: number) {
    const round = getRoundFromPick(pick);
    const pickInRound = ((pick - 1) % leagueSettings.teams.length) + 1;
    // Snake draft: odd rounds go 1→N, even rounds go N→1
    let teamIndex;
    if (round % 2 === 1) {
      teamIndex = pickInRound - 1; // 0-indexed
    } else {
      teamIndex = leagueSettings.teams.length - pickInRound; // 0-indexed
    }
    const team = leagueSettings.teams[teamIndex];
    if (team === undefined) {
      throw new Error("Unexpected error determining team from pick");
    }
    return { teamIndex, team };
  }

  const currentRound = getRoundFromPick(currentPick);
  const { teamIndex: currentTeamIndex, team: currentTeam } =
    getTeamFromPick(currentPick);
  const userIsCurrentTeam =
    currentTeamIndex === leagueSettings.draftPosition - 1;

  const availablePlayers = players.filter(
    (player) => player.draftedAt === undefined,
  );

  const draftedPlayers = players
    .filter((player) => player.draftedAt !== undefined)
    .map((player) => {
      const { team: fantasyTeam } = getTeamFromPick(player.draftedAt!);
      return { ...player, fantasyTeam };
    }) as DraftedPlayer[];

  const recentPlayers = draftedPlayers.sort(
    (a, b) => b.draftedAt - a.draftedAt,
  ); // Most recent first

  const myTeamName = leagueSettings.teams[leagueSettings.draftPosition - 1];
  const myPlayers = draftedPlayers.filter(
    (player) => player.fantasyTeam === myTeamName,
  );
  const myRoster = getRoster(leagueSettings, myPlayers);

  state.getContext = () => {
    //who user has drafted, highly ranked available players by position, and recent picks
    return "Placeholder";
  };

  return (
    <div className="flex min-h-screen flex-col border bg-white shadow-lg">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b px-3 py-3">
        <div className="text-sm font-medium text-gray-900">
          Round {currentRound}, Pick {currentPick}
        </div>
        {userIsCurrentTeam ? (
          <div className="flex items-center space-x-2 rounded-full border border-green-200 bg-green-100 px-2 py-1 text-green-800">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
            <span className="text-sm font-semibold">On the clock!</span>
          </div>
        ) : (
          <div className="text-sm text-gray-600">{currentTeam}</div>
        )}
        <button
          onClick={onExitDraft}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-200"
        >
          Exit Draft
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b bg-white">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center space-x-2 px-4 py-4 text-sm font-medium transition-colors duration-200 ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-600 bg-blue-50 text-blue-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "available" && (
          <AvailableTab
            availablePlayers={availablePlayers}
            setPlayers={setPlayers}
            currentPick={currentPick}
            setCurrentPick={setCurrentPick}
            userIsCurrentTeam={userIsCurrentTeam}
          />
        )}
        {activeTab === "recent" && (
          <RecentTab
            leagueSettings={leagueSettings}
            recentPlayers={recentPlayers}
            setPlayers={setPlayers}
            currentPick={currentPick}
            setCurrentPick={setCurrentPick}
          />
        )}
        {activeTab === "myTeam" && <MyTeamTab myRoster={myRoster} />}
      </div>
    </div>
  );
}

export default DraftScreen;

function getRoster(leagueSettings: LeagueSettings, players: Player[]): Roster {
  const roster: Roster = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    FLEX: [],
    K: [],
    DST: [],
    BENCH: [],
  };
  //assign players
  players.forEach((player) => {
    if (roster[player.pos].length < leagueSettings[player.pos]) {
      roster[player.pos].push(player);
    } else if (
      (player.pos === "RB" || player.pos === "WR" || player.pos === "TE") &&
      roster.FLEX.length < leagueSettings.FLEX
    ) {
      roster.FLEX.push(player);
    } else if (roster.BENCH.length < leagueSettings.BENCH) {
      roster.BENCH.push(player);
    } else {
      throw new Error("Unexpected error: invalid roster");
    }
  });
  //now pad roster with undefined
  Object.keys(roster).forEach((p) => {
    const position = p as keyof Roster;
    while (roster[position].length < leagueSettings[position]) {
      roster[position].push(undefined);
    }
  });
  return roster;
}
