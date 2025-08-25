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
  positionRank: number;
  icon?: string;
  notes?: string;
  draftedAt?: number;
  customColumns?: Record<string, string>;
};

export type DraftedPlayer = Player & {
  draftedAt: number;
  fantasyTeamIndex: number;
  fantasyTeam: string;
};

export type Roster = {
  QB: (Player | null)[];
  RB: (Player | null)[];
  WR: (Player | null)[];
  TE: (Player | null)[];
  FLEX: (Player | null)[];
  K: (Player | null)[];
  DST: (Player | null)[];
  BENCH: (Player | null)[];
};

export type FlatRoster = {
  player: Player | null;
  rosterSlot: keyof Roster;
}[];

export type DraftType = "real" | "mock";

export type State = {
  getContext?: () => string;
};

export type SavedDraft = {
  draftId: string;
  draftType: DraftType;
  leagueSettings: LeagueSettings;
  players: Player[];
  currentPick: number;
  lastModified: number;
};
