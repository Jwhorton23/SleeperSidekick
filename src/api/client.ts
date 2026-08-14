import { cached, TTL } from "./cache";
import type {
  RawNflState,
  RawSleeperLeague,
  RawSleeperLeagueUser,
  RawSleeperMatchupEntry,
  RawSleeperRoster,
  RawSleeperUser,
  RawWinnersBracketEntry,
} from "./types";
import {
  buildManagers,
  buildTeams,
  championRosterIdFromBracket,
  toLeagueSummary,
  toRemainingWeek,
  toSeason,
  toSleeperUser,
  toWeek,
} from "../data/normalize";
import type { LeagueData, LeagueSummary, Manager, RemainingWeek, Season, SleeperUser, Week } from "../data/types";

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

async function getLeagueMatchups(leagueId: string, week: number, ttl: number): Promise<RawSleeperMatchupEntry[]> {
  const key = `sleeper:${leagueId}:matchups:${week}`;
  return cached<RawSleeperMatchupEntry[]>(key, ttl, () =>
    fetchJson<RawSleeperMatchupEntry[]>(`/league/${leagueId}/matchups/${week}`),
  );
}

async function loadWeeks(league: RawSleeperLeague): Promise<Week[]> {
  const weekNumbers = regularSeasonWeeksPlayed(league);
  const lastWeek = weekNumbers.at(-1);
  const entriesByWeek = await Promise.all(
    weekNumbers.map((week) =>
      getLeagueMatchups(league.league_id, week, week === lastWeek ? TTL.SEMI_STABLE : TTL.IMMUTABLE),
    ),
  );
  return weekNumbers.map((week, i) => toWeek(week, entriesByWeek[i]));
}

/** Regular-season weeks with a schedule but no score yet — the games left
 * to simulate for playoff odds. Sleeper generates the full-season matchup
 * pairing in advance, so these are fetchable (with points=0) before they're
 * played. */
function regularSeasonWeeksRemaining(league: RawSleeperLeague): number[] {
  const playoffStart = league.settings?.playoff_week_start ?? 15;
  const lastScored = league.settings?.last_scored_leg ?? playoffStart - 1;
  const firstRemaining = Math.max(1, lastScored + 1);
  const lastRegularWeek = playoffStart - 1;
  if (firstRemaining > lastRegularWeek) return [];
  return Array.from({ length: lastRegularWeek - firstRemaining + 1 }, (_, i) => firstRemaining + i);
}

async function loadRemainingWeeks(league: RawSleeperLeague): Promise<RemainingWeek[]> {
  const weekNumbers = regularSeasonWeeksRemaining(league);
  const entriesByWeek = await Promise.all(weekNumbers.map((week) => getLeagueMatchups(league.league_id, week, TTL.MUTABLE)));
  return weekNumbers.map((week, i) => toRemainingWeek(week, entriesByWeek[i]));
}

export async function loadLeagueData(leagueId: string): Promise<LeagueData> {
  const activeLeague = await resolveActiveSeasonLeague(leagueId);
  const [rawUsers, rawRosters, weeks, remainingWeeks] = await Promise.all([
    getLeagueUsers(activeLeague.league_id),
    getLeagueRosters(activeLeague.league_id),
    loadWeeks(activeLeague),
    loadRemainingWeeks(activeLeague),
  ]);
  const managers = buildManagers(rawUsers);
  const teams = buildTeams(rawRosters, rawUsers);
  const season = toSeason(activeLeague, teams, weeks, remainingWeeks);
  return { managers, seasons: [season] };
}

async function getWinnersBracket(leagueId: string): Promise<RawWinnersBracketEntry[]> {
  const key = `sleeper:${leagueId}:winners_bracket`;
  return cached<RawWinnersBracketEntry[]>(key, TTL.IMMUTABLE, () =>
    fetchJson<RawWinnersBracketEntry[]>(`/league/${leagueId}/winners_bracket`),
  );
}

/** Every scored week of the season, regular season and playoffs alike —
 * unlike regularSeasonWeeksPlayed, this is for the record book, which
 * cares about complete history, not just the MVP stats' apples-to-apples
 * regular-season comparison. */
function allScoredWeeks(league: RawSleeperLeague): number[] {
  const lastScored = Math.max(0, league.settings?.last_scored_leg ?? 0);
  return Array.from({ length: lastScored }, (_, i) => i + 1);
}

/** Walks previous_league_id all the way back (not just past pre_draft
 * heads like resolveActiveSeasonLeague), collecting every season of this
 * league's history, newest first. */
async function fetchLeagueChain(leagueId: string): Promise<RawSleeperLeague[]> {
  const active = await resolveActiveSeasonLeague(leagueId);
  const chain: RawSleeperLeague[] = [active];
  const visited = new Set([active.league_id]);
  let current = active;
  while (current.previous_league_id && !visited.has(current.previous_league_id)) {
    visited.add(current.previous_league_id);
    current = await fetchRawLeague(current.previous_league_id);
    chain.push(current);
  }
  return chain;
}

async function loadFullSeason(league: RawSleeperLeague): Promise<{ season: Season; rawUsers: RawSleeperLeagueUser[] }> {
  const weekNumbers = allScoredWeeks(league);
  const playoffStart = league.settings?.playoff_week_start ?? 15;

  const [rawUsers, rawRosters, entriesByWeek, bracket] = await Promise.all([
    getLeagueUsers(league.league_id),
    getLeagueRosters(league.league_id),
    Promise.all(weekNumbers.map((week) => getLeagueMatchups(league.league_id, week, TTL.IMMUTABLE))),
    getWinnersBracket(league.league_id),
  ]);

  const teams = buildTeams(rawRosters, rawUsers);
  const regularWeeks: Week[] = [];
  const playoffWeeks: Week[] = [];
  weekNumbers.forEach((week, i) => {
    const parsed = toWeek(week, entriesByWeek[i]);
    if (week < playoffStart) regularWeeks.push(parsed);
    else playoffWeeks.push(parsed);
  });

  const championRosterId = championRosterIdFromBracket(bracket);
  const season = toSeason(league, teams, regularWeeks, [], { playoffWeeks, championRosterId });
  return { season, rawUsers };
}

/**
 * Full multi-season history via the previous_league_id chain (PLAN.md
 * §5 M6). Deliberately separate from loadLeagueData: the Dashboard's
 * per-season stats need to load fast, and most leagues only have one or
 * two prior seasons right now, but this still fetches every week
 * (including playoffs) of every season found, which is meaningfully
 * more data — it's opt-in, not part of the fast path.
 */
export async function loadLeagueHistory(leagueId: string): Promise<LeagueData> {
  const chain = await fetchLeagueChain(leagueId); // newest first
  const loaded = await Promise.all(chain.map(loadFullSeason));

  // Merge managers oldest-to-newest so the most recent display name wins.
  const managers = new Map<string, Manager>();
  for (const { rawUsers } of [...loaded].reverse()) {
    for (const [userId, manager] of buildManagers(rawUsers)) {
      managers.set(userId, manager);
    }
  }

  return { managers, seasons: loaded.map((entry) => entry.season) };
}
