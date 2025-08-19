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
  FlatRoster,
  Position,
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

  function getPickInRound(pick: number) {
    return ((pick - 1) % leagueSettings.teams.length) + 1;
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
  const currentPickInRound = getPickInRound(currentPick);
  const { teamIndex: currentTeamIndex, team: currentTeam } =
    getTeamFromPick(currentPick);
  const userIsCurrentTeam =
    currentTeamIndex === leagueSettings.draftPosition - 1;

  const numRounds =
    leagueSettings.QB +
    leagueSettings.RB +
    leagueSettings.WR +
    leagueSettings.TE +
    leagueSettings.FLEX +
    leagueSettings.K +
    leagueSettings.DST +
    leagueSettings.BENCH;
  const numPicks = numRounds * leagueSettings.teams.length;
  const draftIsComplete = currentPick > numPicks;

  const availablePlayers = players.filter(
    (player) => player.draftedAt === undefined,
  );

  const draftedPlayers = players
    .filter((player) => player.draftedAt !== undefined)
    .map((player) => {
      const { teamIndex: fantasyTeamIndex, team: fantasyTeam } =
        getTeamFromPick(player.draftedAt!);
      return { ...player, fantasyTeamIndex, fantasyTeam };
    }) as DraftedPlayer[];

  const currentPlayers = draftedPlayers.filter(
    (player) => player.fantasyTeamIndex === currentTeamIndex,
  );
  const currentRoster = getRoster(leagueSettings, currentPlayers);
  const availableRosterSlots = Object.fromEntries(
    Object.entries(currentRoster).map(([rosterSlot, players]) => {
      return [rosterSlot, players[players.length - 1] === null];
    }),
  ) as Record<keyof Roster, boolean>;
  const availablePositions: Record<Position, boolean> = {
    QB: availableRosterSlots.QB || availableRosterSlots.BENCH,
    RB:
      availableRosterSlots.RB ||
      availableRosterSlots.BENCH ||
      availableRosterSlots.FLEX,
    WR:
      availableRosterSlots.WR ||
      availableRosterSlots.BENCH ||
      availableRosterSlots.FLEX,
    TE:
      availableRosterSlots.TE ||
      availableRosterSlots.BENCH ||
      availableRosterSlots.FLEX,
    K: availableRosterSlots.K || availableRosterSlots.BENCH,
    DST: availableRosterSlots.DST || availableRosterSlots.BENCH,
  };

  const recentPlayers = draftedPlayers.sort(
    (a, b) => b.draftedAt - a.draftedAt,
  ); // Most recent first

  const myPlayers = draftedPlayers.filter(
    (player) => player.fantasyTeamIndex === leagueSettings.draftPosition - 1,
  );
  const myRoster = getRoster(leagueSettings, myPlayers);
  const myFlatRoster: FlatRoster[] = [];
  Object.entries(myRoster).forEach(([position, players]) => {
    players.forEach((player) => {
      myFlatRoster.push({ player, rosterSlot: position as keyof Roster });
    });
  });

  state.getContext = () => {
    const pluralize = (n: number) => (n === 1 ? "" : "s");
    const getUserPickInRound = (round: number) => {
      if (round % 2 === 1) {
        return leagueSettings.draftPosition;
      } else {
        return leagueSettings.teams.length - leagueSettings.draftPosition + 1;
      }
    };
    const userPickInCurrentRound = getUserPickInRound(currentRound);
    const userPickInNextRound = getUserPickInRound(currentRound + 1);
    let userNextPickContext: string;
    if (userIsCurrentTeam) {
      userNextPickContext = "The user is on the clock!";
    } else if (userPickInCurrentRound > currentPickInRound) {
      userNextPickContext = `The user's next pick is round ${currentRound}, pick ${userPickInCurrentRound}.`;
    } else if (currentRound + 1 > numRounds) {
      userNextPickContext = "The user's draft is complete!";
    } else {
      userNextPickContext = `The user's next pick is round ${currentRound + 1}, pick ${userPickInNextRound}.`;
    }
    const getPlayerAndIcon = (player: Player) => {
      return player.player + (player.icon ? ` ${player.icon}` : "");
    };
    const topAvailablePlayers = [];
    const positionCounts: Record<Position, number> = {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      K: 0,
      DST: 0,
    };
    let i = 0;
    while (
      topAvailablePlayers.length < 20 ||
      Object.values(positionCounts).some((count) => count < 5)
    ) {
      const player = availablePlayers[i]!;
      if (i < 20 || positionCounts[player.pos] < 5) {
        topAvailablePlayers.push(player);
        positionCounts[player.pos]++;
      }
      i++;
    }
    return `League settings:

- ${leagueSettings.teams.length} team${pluralize(leagueSettings.teams.length)}
- ${leagueSettings.QB} QB${pluralize(leagueSettings.QB)}
- ${leagueSettings.RB} RB${pluralize(leagueSettings.RB)}
- ${leagueSettings.WR} WR${pluralize(leagueSettings.WR)}
- ${leagueSettings.TE} TE${pluralize(leagueSettings.TE)}
- ${leagueSettings.FLEX} FLEX${pluralize(leagueSettings.FLEX)}
- ${leagueSettings.K} K${pluralize(leagueSettings.K)}
- ${leagueSettings.DST} DST${pluralize(leagueSettings.DST)}
- ${leagueSettings.BENCH} BENCH slot${pluralize(leagueSettings.BENCH)}

The current pick is round ${currentRound}, pick ${currentPickInRound}.

${userNextPickContext}

User's roster:

${myFlatRoster
  .map(({ player, rosterSlot }) => {
    if (player) {
      return `- ${rosterSlot}:  ${getPlayerAndIcon(player)} (${player.team})`;
    } else {
      return `- ${rosterSlot}: Empty`;
    }
  })
  .join("\n")}

Recent picks:

${recentPlayers
  .slice(0, leagueSettings.teams.length)
  .map((player) => {
    return `- Pick ${player.draftedAt}: ${getPlayerAndIcon(player)} (${player.team} ${player.pos})`;
  })
  .join("\n")}

Top available players - this list includes the top 20 players as well as at least 5 players from each position:

${topAvailablePlayers
  .map((player) => {
    return `- Rank ${player.rank}: ${getPlayerAndIcon(player)} (${player.team} ${player.pos})`;
  })
  .join("\n")}`;
  };

  let statusBar: React.ReactNode;
  if (draftIsComplete) {
    statusBar = (
      <div className="text-sm font-medium text-gray-900">Draft complete!</div>
    );
  } else if (userIsCurrentTeam) {
    statusBar = (
      <div className="flex items-center space-x-2 rounded-full border border-green-200 bg-green-100 px-2 py-1 text-green-800">
        <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
        <span className="text-sm font-semibold">On the clock!</span>
      </div>
    );
  } else {
    statusBar = <div className="text-sm text-gray-600">{currentTeam}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col border bg-white shadow-lg">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b px-3 py-3">
        {!draftIsComplete && (
          <div className="text-sm font-medium text-gray-900">
            Round {currentRound}, Pick {currentPickInRound}
          </div>
        )}
        {statusBar}
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
            availablePositions={availablePositions}
            setPlayers={setPlayers}
            currentPick={currentPick}
            setCurrentPick={setCurrentPick}
            userIsCurrentTeam={userIsCurrentTeam}
            draftIsComplete={draftIsComplete}
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
        {activeTab === "myTeam" && <MyTeamTab myFlatRoster={myFlatRoster} />}
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
      roster[position].push(null);
    }
  });
  return roster;
}
