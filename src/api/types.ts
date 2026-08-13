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
}

export interface RawNflState {
  season: string;
  week: number;
  season_type: string;
}
