import type { RawSleeperLeague, RawSleeperLeagueUser, RawSleeperRoster, RawSleeperUser } from "../api/types";
import type { LeagueSummary, Manager, RosterId, Season, SleeperUser, Team, UserId } from "./types";

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

export function toSeason(league: RawSleeperLeague, teams: Map<RosterId, Team>): Season {
  return {
    leagueId: league.league_id,
    name: league.name,
    season: league.season,
    starterSlots: (league.roster_positions ?? []).filter((slot) => !NON_STARTER_SLOTS.has(slot)),
    playoffWeekStart: league.settings?.playoff_week_start ?? 15,
    teams,
    weeks: [],
  };
}
