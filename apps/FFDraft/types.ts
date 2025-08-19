export type LeagueSettings = {
  teams: string[];
  draftPosition: number;
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  K: number;
  DST: number;
  BENCH: number;
};

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export function isValidPosition(pos: any): pos is Position {
  return (
    pos === "QB" ||
    pos === "RB" ||
    pos === "WR" ||
    pos === "TE" ||
    pos === "K" ||
    pos === "DST"
  );
}

export type Player = {
  player: string;
  team: string;
  pos: Position;
  rank: number;
  icon?: string;
  draftedAt?: number;
  fantasyTeam?: string;
  customColumns?: Record<string, string>;
};

export type DraftedPlayer = Player & {
  draftedAt: number;
  fantasyTeam: string;
};

export type Roster = {
  QB: (Player | undefined)[];
  RB: (Player | undefined)[];
  WR: (Player | undefined)[];
  TE: (Player | undefined)[];
  FLEX: (Player | undefined)[];
  K: (Player | undefined)[];
  DST: (Player | undefined)[];
  BENCH: (Player | undefined)[];
};

export type State = {
  getContext?: () => string;
};
