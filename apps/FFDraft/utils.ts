import { type Player, type Position, isValidPosition } from "./types.ts";

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
  return rows.join("\n");
}
