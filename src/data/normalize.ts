import type { RawSleeperLeague, RawSleeperUser } from "../api/types";
import type { LeagueSummary, SleeperUser } from "./types";

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
