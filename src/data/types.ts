// The shared data contract (PLAN.md §4). Everything in src/stats and src/ui
// downstream of normalize.ts operates on these types — never on raw Sleeper
// API payloads.

// ---- identity ----
export type UserId = string; // stable; usernames are mutable, never key on them
export type RosterId = number; // stable within one season's league only

export interface Manager {
  userId: UserId;
  displayName: string;
  avatar: string | null;
}

// ---- league picker (lightweight, before a season's full data is loaded) ----
export interface SleeperUser {
  userId: UserId;
  username: string;
  displayName: string;
  avatar: string | null;
}

export interface LeagueSummary {
  leagueId: string;
  name: string;
  season: string;
  totalRosters: number;
  avatar: string | null;
  previousLeagueId: string | null;
  status: string;
}

// ---- the full model (Season/Week data arrives starting M2) ----
export interface LeagueData {
  managers: Map<UserId, Manager>;
  seasons: Season[]; // newest first
}

export interface Season {
  leagueId: string;
  name: string; // league display name, e.g. "Moonshooters"
  season: string;
  starterSlots: Slot[]; // roster_positions minus BN/IR/TAXI, order preserved
  playoffWeekStart: number;
  playoffTeams: number; // how many teams make the playoff bracket
  teams: Map<RosterId, Team>;
  weeks: Week[]; // completed regular-season weeks, ascending
  remainingWeeks: RemainingWeek[]; // scheduled-but-unplayed regular-season weeks, ascending
  playoffWeeks: Week[]; // completed playoff-bracket weeks, ascending — only populated by the multi-season history loader (M6), empty otherwise
  championRosterId: RosterId | null; // winner of the championship game (winners_bracket placement 1); null unless loaded via history
}

/** A future week's matchup pairings — the schedule is known in advance,
 * scores aren't. Used for Monte Carlo playoff-odds simulation. */
export interface RemainingWeek {
  week: number;
  matchups: { rosterIdA: RosterId; rosterIdB: RosterId }[];
}

export interface Team {
  rosterId: RosterId;
  ownerId: UserId;
  name: string;
}

export interface Week {
  week: number;
  games: Game[];
}

export interface Game {
  a: TeamWeek;
  b: TeamWeek;
}

export interface TeamWeek {
  rosterId: RosterId;
  points: number;
  starters: { playerId: string; points: number }[];
  bench: { playerId: string; points: number }[];
}

// ---- player lookup (from public/players.json, loaded once) ----
export interface PlayerMeta {
  id: string;
  name: string;
  positions: string[];
  team: string | null;
}

export type Slot =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "K"
  | "DEF"
  | "FLEX"
  | "SUPER_FLEX"
  | "WRRB_FLEX"
  | "REC_FLEX"
  | string;
