import type { RosterId, Season } from "../data/types";

export interface AllPlayRecord {
  wins: number;
  losses: number;
  ties: number;
}

export interface AllPlayWeek extends AllPlayRecord {
  week: number;
}

/** Per-week all-play results: each week, a team "beats" every other team it
 * outscored that week. The week-by-week breakdown is what a single manager's
 * game log needs ("beat 6 of 7 teams and still lost"); {@link allPlay} folds
 * it into the season totals every leaderboard uses. */
export function allPlayByWeek(season: Season): Map<RosterId, AllPlayWeek[]> {
  const result = new Map<RosterId, AllPlayWeek[]>();
  for (const rosterId of season.teams.keys()) {
    result.set(rosterId, []);
  }

  for (const week of season.weeks) {
    const teamWeeks = week.games.flatMap((game) => [game.a, game.b]);
    for (const team of teamWeeks) {
      const weeks = result.get(team.rosterId);
      if (!weeks) continue;
      const entry: AllPlayWeek = { week: week.week, wins: 0, losses: 0, ties: 0 };
      for (const opponent of teamWeeks) {
        if (opponent.rosterId === team.rosterId) continue;
        if (team.points > opponent.points) entry.wins++;
        else if (team.points < opponent.points) entry.losses++;
        else entry.ties++;
      }
      weeks.push(entry);
    }
  }

  return result;
}

/** Each team's record if it had played everyone, every week, instead of just
 * its actual opponent. */
export function allPlay(season: Season): Map<RosterId, AllPlayRecord> {
  const result = new Map<RosterId, AllPlayRecord>();

  for (const [rosterId, weeks] of allPlayByWeek(season)) {
    const record: AllPlayRecord = { wins: 0, losses: 0, ties: 0 };
    for (const week of weeks) {
      record.wins += week.wins;
      record.losses += week.losses;
      record.ties += week.ties;
    }
    result.set(rosterId, record);
  }

  return result;
}

/** Share of all-play games won, counting a tie as half. 0 when nothing has
 * been played yet. */
export function allPlayWinPct(record: AllPlayRecord): number {
  const played = record.wins + record.losses + record.ties;
  return played > 0 ? (record.wins + record.ties * 0.5) / played : 0;
}
