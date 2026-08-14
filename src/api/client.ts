import { cached, TTL } from "./cache";
import type {
  RawNflState,
  RawSleeperLeague,
  RawSleeperLeagueUser,
  RawSleeperMatchupEntry,
  RawSleeperRoster,
  RawSleeperUser,
} from "./types";
import { buildManagers, buildTeams, toLeagueSummary, toSeason, toSleeperUser, toWeek } from "../data/normalize";
import type { LeagueData, LeagueSummary, SleeperUser, Week } from "../data/types";

const BASE_URL = "https://api.sleeper.app/v1";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Sleeper API request failed (${res.status}) for ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Sleeper returns HTTP 200 with a JSON `null` body for an unknown username — not a 404. */
export async function resolveUsername(username: string): Promise<SleeperUser | null> {
  const key = `sleeper:user:${username.toLowerCase()}`;
  const raw = await cached<RawSleeperUser | null>(key, TTL.MUTABLE, () =>
    fetchJson<RawSleeperUser | null>(`/user/${encodeURIComponent(username)}`),
  );
  return raw ? toSleeperUser(raw) : null;
}

export async function getUserLeagues(userId: string, season: string): Promise<LeagueSummary[]> {
  const key = `sleeper:leagues:${userId}:${season}`;
  const raw = await cached<RawSleeperLeague[]>(key, TTL.MUTABLE, () =>
    fetchJson<RawSleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`),
  );
  return raw.map(toLeagueSummary);
}

export async function getNflState(): Promise<RawNflState> {
  return cached<RawNflState>("sleeper:state", TTL.MUTABLE, () => fetchJson<RawNflState>("/state/nfl"));
}

async function fetchRawLeague(leagueId: string): Promise<RawSleeperLeague> {
  const key = `sleeper:${leagueId}:league`;
  return cached<RawSleeperLeague>(key, TTL.MUTABLE, () => fetchJson<RawSleeperLeague>(`/league/${leagueId}`));
}

/**
 * A "pre_draft" league has no data for its own season yet (e.g. the 2026
 * league before kickoff). Walk previous_league_id until we hit a season
 * that's actually been played, so the dashboard always has something to show.
 */
async function resolveActiveSeasonLeague(leagueId: string): Promise<RawSleeperLeague> {
  let league = await fetchRawLeague(leagueId);
  const visited = new Set<string>();
  while (league.status === "pre_draft" && league.previous_league_id && !visited.has(league.league_id)) {
    visited.add(league.league_id);
    league = await fetchRawLeague(league.previous_league_id);
  }
  return league;
}

async function getLeagueUsers(leagueId: string): Promise<RawSleeperLeagueUser[]> {
  const key = `sleeper:${leagueId}:users`;
  return cached<RawSleeperLeagueUser[]>(key, TTL.MUTABLE, () =>
    fetchJson<RawSleeperLeagueUser[]>(`/league/${leagueId}/users`),
  );
}

async function getLeagueRosters(leagueId: string): Promise<RawSleeperRoster[]> {
  const key = `sleeper:${leagueId}:rosters`;
  return cached<RawSleeperRoster[]>(key, TTL.MUTABLE, () =>
    fetchJson<RawSleeperRoster[]>(`/league/${leagueId}/rosters`),
  );
}

/** Regular-season weeks that have been scored, per PLAN.md's "regular
 * season weeks only" rule for the MVP stats — playoff/consolation weeks
 * would otherwise pollute all-play/luck/coaching-efficiency numbers. */
function regularSeasonWeeksPlayed(league: RawSleeperLeague): number[] {
  const playoffStart = league.settings?.playoff_week_start ?? 15;
  const lastScored = league.settings?.last_scored_leg ?? playoffStart - 1;
  const lastRegularWeek = Math.max(0, Math.min(playoffStart - 1, lastScored));
  return Array.from({ length: lastRegularWeek }, (_, i) => i + 1);
}

async function getLeagueMatchups(leagueId: string, week: number, isLatestScoredWeek: boolean): Promise<RawSleeperMatchupEntry[]> {
  const key = `sleeper:${leagueId}:matchups:${week}`;
  const ttl = isLatestScoredWeek ? TTL.SEMI_STABLE : TTL.IMMUTABLE;
  return cached<RawSleeperMatchupEntry[]>(key, ttl, () =>
    fetchJson<RawSleeperMatchupEntry[]>(`/league/${leagueId}/matchups/${week}`),
  );
}

async function loadWeeks(league: RawSleeperLeague): Promise<Week[]> {
  const weekNumbers = regularSeasonWeeksPlayed(league);
  const lastWeek = weekNumbers.at(-1);
  const entriesByWeek = await Promise.all(
    weekNumbers.map((week) => getLeagueMatchups(league.league_id, week, week === lastWeek)),
  );
  return weekNumbers.map((week, i) => toWeek(week, entriesByWeek[i]));
}

export async function loadLeagueData(leagueId: string): Promise<LeagueData> {
  const activeLeague = await resolveActiveSeasonLeague(leagueId);
  const [rawUsers, rawRosters, weeks] = await Promise.all([
    getLeagueUsers(activeLeague.league_id),
    getLeagueRosters(activeLeague.league_id),
    loadWeeks(activeLeague),
  ]);
  const managers = buildManagers(rawUsers);
  const teams = buildTeams(rawRosters, rawUsers);
  const season = toSeason(activeLeague, teams, weeks);
  return { managers, seasons: [season] };
}
