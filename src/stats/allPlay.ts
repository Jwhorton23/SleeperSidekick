import type { RosterId, Season } from "../data/types";

export interface AllPlayRecord {
  wins: number;
  losses: number;
  ties: number;
}

/** Each week, a team "beats" every other team it outscored that week —
 * its record if it had played everyone, not just its actual opponent. */
export function allPlay(season: Season): Map<RosterId, AllPlayRecord> {
  const result = new Map<RosterId, AllPlayRecord>();
  for (const rosterId of season.teams.keys()) {
    result.set(rosterId, { wins: 0, losses: 0, ties: 0 });
  }

  for (const week of season.weeks) {
    const teamWeeks = week.games.flatMap((game) => [game.a, game.b]);
    for (const team of teamWeeks) {
      const record = result.get(team.rosterId);
      if (!record) continue;
      for (const opponent of teamWeeks) {
        if (opponent.rosterId === team.rosterId) continue;
        if (team.points > opponent.points) record.wins++;
        else if (team.points < opponent.points) record.losses++;
        else record.ties++;
      }
    }
  }

  return result;
}
