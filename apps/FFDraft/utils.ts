import {
  type LeagueSettings,
  type Player,
  type DraftedPlayer,
  type Position,
  type Roster,
  isValidPosition,
} from "./types.ts";

export function parsePlayersData(csvData: string): Player[] {
  const lines = csvData.trim().split("\n");
  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }
  const headers = lines[0]!.split(",");
  let playerIndex: number | undefined;
  let teamIndex: number | undefined;
  let posIndex: number | undefined;
  let iconIndex: number | undefined;
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]!.trim().toLowerCase();
    if (header === "player") {
      playerIndex = i;
    } else if (header === "team") {
      teamIndex = i;
    } else if (header === "pos") {
      posIndex = i;
    } else if (header === "icon") {
      iconIndex = i;
    }
  }
  if (
    playerIndex === undefined ||
    teamIndex === undefined ||
    posIndex === undefined
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
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") {
      continue; // Skip empty lines
    }
    const values = line.split(",");
    const playerName = values[playerIndex]?.trim();
    if (!playerName) {
      throw new Error(`Missing player on line ${i + 1}`);
    }
    const team = values[teamIndex]?.trim();
    if (!team) {
      throw new Error(`Missing team on line ${i + 1}`);
    }
    const pos = values[posIndex]?.trim();
    if (!pos) {
      throw new Error(`Missing position on line ${i + 1}`);
    }
    if (!isValidPosition(pos)) {
      throw new Error(
        `Invalid position '${pos}' for player '${playerName}' on line ${i + 1}. Valid positions are: QB, RB, WR, TE, K, DST`,
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
    if (iconIndex !== undefined) {
      player.icon = values[iconIndex]?.trim();
    }
    players.push(player);
  }
  if (players.length === 0) {
    throw new Error("No valid player data found in CSV");
  }
  return players;
}

export function playersToCSV(players: Player[]): string {
  const headers = ["player", "team", "pos", "icon"];
  const rows = [headers.join(",")];
  for (const player of players) {
    const row = [player.player, player.team, player.pos, player.icon || ""];
    rows.push(row.join(","));
  }
  // Add UTF-8 BOM to ensure Excel recognizes the encoding
  return "\uFEFF" + rows.join("\n");
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
    const availablePlayers = newPlayers.filter(
      (player) => player.draftedAt === undefined,
    );
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
    const bestAvailablePlayer = availablePlayers.find((player) => {
      return availablePositions[player.pos];
    });
    if (bestAvailablePlayer) {
      bestAvailablePlayer.draftedAt = newCurrentPick;
    }
    newCurrentPick++;
    ({ teamIndex } = getTeamFromPick(leagueSettings, newCurrentPick));
  }
  return newPlayers;
}
