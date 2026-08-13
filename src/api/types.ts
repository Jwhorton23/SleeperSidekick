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
