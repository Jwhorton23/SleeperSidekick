// Raw Sleeper API response shapes. Only src/api and src/data/normalize.ts
// should ever reference these — everything else uses src/data/types.ts.

export interface RawSleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
}

export interface RawSleeperLeague {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  avatar: string | null;
  previous_league_id: string | null;
  status: string;
  roster_positions?: string[];
  settings?: {
    playoff_week_start?: number;
    last_scored_leg?: number;
    playoff_teams?: number;
    waiver_type?: number; // 2 = FAAB bidding; other values are priority-based waivers
  };
}

export interface RawSleeperLeagueUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string } | null;
}

export interface RawSleeperRoster {
  roster_id: number;
  owner_id: string | null;
}

export interface RawSleeperMatchupEntry {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  starters: string[]; // player IDs in slot order matching roster_positions; "0" = empty slot
  players: string[]; // every rostered player that week (starters + bench)
  players_points: Record<string, number>;
}

export interface RawNflState {
  season: string;
  week: number;
  season_type: string;
}

export interface RawWinnersBracketEntry {
  r: number; // round
  m: number; // matchup id within the bracket
  w?: number | null; // winning roster_id, once played
  l?: number | null; // losing roster_id, once played
  t1?: number | null;
  t2?: number | null;
  p?: number | null; // placement this game decides; 1 = the championship game
}

export interface RawSleeperDraft {
  draft_id: string;
  season: string;
  status: string;
  created: number;
}

export interface RawDraftPick {
  round: number;
  pick_no: number;
  player_id: string;
  picked_by: string; // user_id; empty string if the slot went unclaimed (e.g. an orphaned roster)
  roster_id: number;
  metadata?: { position?: string } | null;
}

export interface RawTransaction {
  type: string; // "waiver" | "free_agent" | "trade"
  status: string; // only "complete" transactions actually happened
  roster_ids: number[];
  adds: Record<string, number> | null; // player_id -> roster_id
  settings?: { waiver_bid?: number } | null; // waiver_bid is the FAAB amount spent, for "waiver"-type transactions in an FAAB league
}
