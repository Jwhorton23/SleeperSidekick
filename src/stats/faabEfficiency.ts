import type { RosterId, Season } from "../data/types";

export interface FaabEfficiencyEntry {
  totalSpent: number;
  totalPointsGained: number;
  pointsPerDollar: number;
}

/**
 * Points scored per FAAB dollar spent. "Points gained" only counts what
 * the acquired player scored for the acquiring roster in weeks *after*
 * the claim — points from before the pickup, or after the player left
 * that roster, aren't this spend's doing.
 *
 * Note: none of the leagues this was verified against actually use FAAB
 * (all are priority-based waivers, settings.waiver_type !== 2), so this
 * has real unit-test coverage but hasn't been checked against a live
 * FAAB league — worth a second look once one is available.
 */
export function faabEfficiency(season: Season): Map<RosterId, FaabEfficiencyEntry> {
  const result = new Map<RosterId, FaabEfficiencyEntry>();
  function ensure(rosterId: RosterId): FaabEfficiencyEntry {
    if (!result.has(rosterId)) result.set(rosterId, { totalSpent: 0, totalPointsGained: 0, pointsPerDollar: 0 });
    return result.get(rosterId)!;
  }

  const allWeeks = [...season.weeks, ...season.playoffWeeks].sort((a, b) => a.week - b.week);

  for (const spend of season.faabSpends) {
    const record = ensure(spend.rosterId);
    record.totalSpent += spend.amount;

    for (const week of allWeeks) {
      if (week.week <= spend.week) continue;
      for (const game of week.games) {
        for (const team of [game.a, game.b]) {
          if (team.rosterId !== spend.rosterId) continue;
          for (const p of [...team.starters, ...team.bench]) {
            if (p.playerId === spend.playerId) record.totalPointsGained += p.points;
          }
        }
      }
    }
  }

  for (const record of result.values()) {
    record.pointsPerDollar = record.totalSpent > 0 ? record.totalPointsGained / record.totalSpent : 0;
  }

  return result;
}
