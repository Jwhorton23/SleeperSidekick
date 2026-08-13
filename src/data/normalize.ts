import type {
  RawSleeperLeague,
  RawSleeperLeagueUser,
  RawSleeperMatchupEntry,
  RawSleeperRoster,
  RawSleeperUser,
} from "../api/types";
import type {
  Game,
  LeagueSummary,
  Manager,
  RemainingWeek,
  RosterId,
  Season,
  SleeperUser,
  Team,
  TeamWeek,
  UserId,
  Week,
} from "./types";

export function toSleeperUser(raw: RawSleeperUser): SleeperUser {
  return {
    userId: raw.user_id,
    username: raw.username,
    displayName: raw.display_name ?? raw.username,
    avatar: raw.avatar,
  };
}

export function toLeagueSummary(raw: RawSleeperLeague): LeagueSummary {
  return {
    leagueId: raw.league_id,
    name: raw.name,
    season: raw.season,
    totalRosters: raw.total_rosters,
    avatar: raw.avatar,
    previousLeagueId: raw.previous_league_id,
    status: raw.status,
  };
}

export function buildManagers(users: RawSleeperLeagueUser[]): Map<UserId, Manager> {
  const managers = new Map<UserId, Manager>();
  for (const u of users) {
    managers.set(u.user_id, {
      userId: u.user_id,
      displayName: u.display_name,
      avatar: u.avatar,
    });
  }
  return managers;
}

/** Joins roster_id -> owner_id -> user_id. Rosters with no owner_id (e.g. an
 * abandoned pre-draft slot) are skipped — there's no manager to display. */
export function buildTeams(rosters: RawSleeperRoster[], users: RawSleeperLeagueUser[]): Map<RosterId, Team> {
  const userById = new Map(users.map((u) => [u.user_id, u]));
  const teams = new Map<RosterId, Team>();
  for (const roster of rosters) {
    if (roster.owner_id == null) continue;
    const user = userById.get(roster.owner_id);
    const name = user?.metadata?.team_name || user?.display_name || `Team ${roster.roster_id}`;
    teams.set(roster.roster_id, {
      rosterId: roster.roster_id,
      ownerId: roster.owner_id,
      name,
    });
  }
  return teams;
}

const NON_STARTER_SLOTS = new Set(["BN", "IR", "TAXI"]);

export function toSeason(
  league: RawSleeperLeague,
  teams: Map<RosterId, Team>,
  weeks: Week[] = [],
  remainingWeeks: RemainingWeek[] = [],
): Season {
  return {
    leagueId: league.league_id,
    name: league.name,
    season: league.season,
    starterSlots: (league.roster_positions ?? []).filter((slot) => !NON_STARTER_SLOTS.has(slot)),
    playoffWeekStart: league.settings?.playoff_week_start ?? 15,
    playoffTeams: league.settings?.playoff_teams ?? 4,
    teams,
    weeks,
    remainingWeeks,
  };
}

function toTeamWeek(entry: RawSleeperMatchupEntry): TeamWeek {
  const starterIds = new Set(entry.starters.filter((id) => id !== "0"));
  const pointsFor = (playerId: string) => entry.players_points[playerId] ?? 0;
  return {
    rosterId: entry.roster_id,
    points: entry.points,
    starters: entry.starters.map((playerId) => ({ playerId, points: playerId === "0" ? 0 : pointsFor(playerId) })),
    bench: entry.players.filter((id) => !starterIds.has(id)).map((playerId) => ({ playerId, points: pointsFor(playerId) })),
  };
}

/** Groups matchup entries by matchup_id into head-to-head Games. Entries
 * that don't pair up 1:1 (a bye, a data glitch) are dropped — there's no
 * opponent to compare against, so they can't contribute to any MVP stat. */
export function toWeek(week: number, entries: RawSleeperMatchupEntry[]): Week {
  const byMatchupId = new Map<number, RawSleeperMatchupEntry[]>();
  for (const entry of entries) {
    if (entry.matchup_id == null) continue;
    const group = byMatchupId.get(entry.matchup_id) ?? [];
    group.push(entry);
    byMatchupId.set(entry.matchup_id, group);
  }

  const games: Game[] = [];
  for (const group of byMatchupId.values()) {
    if (group.length !== 2) continue;
    games.push({ a: toTeamWeek(group[0]), b: toTeamWeek(group[1]) });
  }

  return { week, games };
}

/** Same grouping as toWeek, but for a not-yet-played week: only the
 * matchup pairing matters, since there are no scores yet. */
export function toRemainingWeek(week: number, entries: RawSleeperMatchupEntry[]): RemainingWeek {
  const byMatchupId = new Map<number, RawSleeperMatchupEntry[]>();
  for (const entry of entries) {
    if (entry.matchup_id == null) continue;
    const group = byMatchupId.get(entry.matchup_id) ?? [];
    group.push(entry);
    byMatchupId.set(entry.matchup_id, group);
  }

  const matchups: RemainingWeek["matchups"] = [];
  for (const group of byMatchupId.values()) {
    if (group.length !== 2) continue;
    matchups.push({ rosterIdA: group[0].roster_id, rosterIdB: group[1].roster_id });
  }

  return { week, matchups };
}
