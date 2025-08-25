import Papa from "papaparse";
import {
  type LeagueSettings,
  type Player,
  type DraftedPlayer,
  type Position,
  type Roster,
  isValidPosition,
} from "./types.ts";

export function parsePlayersData(csvData: string): Player[] {
  if (!csvData || csvData.trim() === "") {
    throw new Error("CSV file is empty");
  }
  const parseResult = Papa.parse(csvData.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });
  if (parseResult.errors.length > 0) {
    throw new Error(
      `CSV parsing errors: ${parseResult.errors.map((e: any) => e.message).join(", ")}`,
    );
  }
  const data = parseResult.data as Record<string, string>[];
  if (data.length === 0) {
    throw new Error("No valid player data found in CSV");
  }

  const firstRow = data[0]!;
  if (
    !("player" in firstRow) ||
    !("team" in firstRow) ||
    !("pos" in firstRow)
  ) {
    throw new Error(
      "Missing required headers in CSV. Required headers are: player, team, and pos.",
    );
  }

  const positionRanks: Record<Position, number> = {
    QB: 1,
    RB: 1,
    WR: 1,
    TE: 1,
    K: 1,
    DST: 1,
  };

  const players: Player[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i]!;
    const playerName = row.player?.trim();
    if (!playerName) {
      throw new Error(`Missing player on row ${i + 2}`);
    }
    const team = row.team?.trim();
    if (!team) {
      throw new Error(`Missing team on row ${i + 2}`);
    }
    const pos = row.pos?.trim();
    if (!pos) {
      throw new Error(`Missing position on row ${i + 2}`);
    }
    if (!isValidPosition(pos)) {
      throw new Error(
        `Invalid position '${pos}' for player '${playerName}' on row ${i + 2}. Valid positions are: QB, RB, WR, TE, K, DST`,
      );
    }
    const player: Player = {
      player: playerName,
      team,
      pos,
      rank: players.length + 1, // rank is the order in the valid data
      positionRank: positionRanks[pos],
      draftedAt: undefined,
    };
    positionRanks[pos] = (positionRanks[pos] || 0) + 1;
    if (row.icon?.trim()) {
      player.icon = row.icon.trim();
    }
    if (row.notes?.trim()) {
      player.notes = row.notes.trim();
    }
    players.push(player);
  }
  return players;
}

export function playersToCSV(players: Player[]): string {
  const data = players.map((player) => ({
    player: player.player,
    team: player.team,
    pos: player.pos,
    icon: player.icon || "",
    notes: player.notes || "",
  }));
  const csv = Papa.unparse(data, {
    quotes: true, // handle commas in notes
  });
  // Add UTF-8 BOM to ensure Excel recognizes the encoding
  return "\uFEFF" + csv;
}

export function getRoundFromPick(leagueSettings: LeagueSettings, pick: number) {
  return Math.ceil(pick / leagueSettings.teams.length);
}

export function getTeamFromPick(leagueSettings: LeagueSettings, pick: number) {
  const round = getRoundFromPick(leagueSettings, pick);
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

export function getNumRounds(leagueSettings: LeagueSettings) {
  return (
    leagueSettings.QB +
    leagueSettings.RB +
    leagueSettings.WR +
    leagueSettings.TE +
    leagueSettings.FLEX +
    leagueSettings.K +
    leagueSettings.DST +
    leagueSettings.BENCH
  );
}

export function getDraftedPlayers(
  leagueSettings: LeagueSettings,
  players: Player[],
) {
  return players
    .filter((player) => player.draftedAt !== undefined)
    .map((player) => {
      const { teamIndex: fantasyTeamIndex, team: fantasyTeam } =
        getTeamFromPick(leagueSettings, player.draftedAt!);
      return { ...player, fantasyTeamIndex, fantasyTeam };
    }) as DraftedPlayer[];
}

export function getRoster(
  leagueSettings: LeagueSettings,
  players: Player[],
): Roster {
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

export function getAvailablePositions(
  roster: Roster,
): Record<Position, boolean> {
  const availableRosterSlots = Object.fromEntries(
    Object.entries(roster).map(([rosterSlot, players]) => {
      return [rosterSlot, players[players.length - 1] === null];
    }),
  ) as Record<keyof Roster, boolean>;
  return {
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
}

export function mockDraft(
  leagueSettings: LeagueSettings,
  players: Player[],
  currentPick: number,
) {
  const newPlayers = players.map((player) => ({ ...player }));
  let newCurrentPick = currentPick;
  let { teamIndex } = getTeamFromPick(leagueSettings, currentPick);
  const userTeamIndex = leagueSettings.draftPosition - 1;
  while (teamIndex !== userTeamIndex) {
    const selectedPlayer = selectPlayer(leagueSettings, newPlayers, teamIndex);
    if (selectedPlayer) {
      selectedPlayer.draftedAt = newCurrentPick;
    }
    newCurrentPick++;
    ({ teamIndex } = getTeamFromPick(leagueSettings, newCurrentPick));
  }
  return newPlayers;
}

function selectPlayer(
  leagueSettings: LeagueSettings,
  newPlayers: Player[],
  teamIndex: number,
) {
  const teamPlayers = newPlayers.filter((player) => {
    if (player.draftedAt === undefined) return false;
    const { teamIndex: playerTeamIndex } = getTeamFromPick(
      leagueSettings,
      player.draftedAt,
    );
    return playerTeamIndex === teamIndex;
  });
  const roster = getRoster(leagueSettings, teamPlayers);
  const availablePositions = getAvailablePositions(roster);
  const availablePlayers = newPlayers.filter(
    (player) =>
      player.draftedAt === undefined && availablePositions[player.pos],
  );
  const positionCountVsTargets = getPositionCountVsTargets(
    leagueSettings,
    teamPlayers,
  );
  //sort available players accounting for position count vs target - a delta of 1 is worth 10 slots in the rankings
  availablePlayers.sort(
    (a, b) =>
      a.rank +
      10 * positionCountVsTargets[a.pos] -
      (b.rank + 10 * positionCountVsTargets[b.pos]),
  );
  const rand = Math.random(); //add randomness to the selection
  let cumuProb = 0;
  //these constants define a geometric series that sums to 1 in 10 elements
  //probability of selecting the first element is a * r^0 = 0.34
  //second element is a * r^1 = 0.226
  //...
  //tenth element is a * r^10 = 0.009, at which point the cumulative probability exceeds 1
  const a = 0.34;
  const r = 2 / 3;
  for (let i = 0; i < availablePlayers.length; i++) {
    const prob = a * Math.pow(r, i);
    cumuProb += prob;
    if (rand < cumuProb) {
      return availablePlayers[i];
    }
  }
  return availablePlayers[availablePlayers.length - 1];
}

function getPositionCountVsTargets(
  leagueSettings: LeagueSettings,
  teamPlayers: Player[],
) {
  const benchDenom =
    leagueSettings.QB +
    leagueSettings.RB +
    leagueSettings.WR +
    leagueSettings.TE +
    leagueSettings.FLEX;
  //todo this may not actually add up to the correct number of players
  const positionTargets = {
    QB:
      leagueSettings.QB +
      (leagueSettings.QB / benchDenom) * leagueSettings.BENCH * 0.5, //deprioritize QB
    RB:
      leagueSettings.RB +
      leagueSettings.FLEX / 2 +
      ((leagueSettings.RB + leagueSettings.FLEX / 2) / benchDenom) *
        leagueSettings.BENCH *
        1.2, //prioritize RB
    WR:
      leagueSettings.WR +
      leagueSettings.FLEX / 2 +
      ((leagueSettings.WR + leagueSettings.FLEX / 2) / benchDenom) *
        leagueSettings.BENCH *
        1.2, //prioritize WR
    TE:
      leagueSettings.TE +
      (leagueSettings.TE / benchDenom) * leagueSettings.BENCH * 0.5, //deprioritize TE
    K: leagueSettings.K, //don't draft extra Ks
    DST: leagueSettings.DST, //don't draft extra DSTs
  };
  const numRounds = getNumRounds(leagueSettings);
  return Object.fromEntries(
    Object.entries(positionTargets).map(([position, target]) => {
      return [
        position,
        teamPlayers.filter((player) => player.pos === position).length -
          target * (teamPlayers.length / numRounds), //adjust target for where we are in the draft
      ];
    }),
  ) as Record<Position, number>;
}
