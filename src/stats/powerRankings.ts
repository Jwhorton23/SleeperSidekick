import type { RosterId, Season } from "../data/types";

export interface PowerRankingEntry {
  rosterId: RosterId;
  score: number;
  rank: number; // 1 = strongest
}

/**
 * Power score = recency-weighted average head-to-head margin. Each
 * completed week contributes (own points - opponent's points) for that
 * week, weighted by how recent the week is (week 1 gets weight 1, the
 * most recent week gets weight = number of weeks played) — so a team
 * that's been blowing teams out lately outranks one that did the same
 * in week 1 and has since faded, even if their season-long point totals
 * are identical.
 */
export function powerRankings(season: Season): PowerRankingEntry[] {
  const weightedMarginSum = new Map<RosterId, number>();
  const weightSum = new Map<RosterId, number>();

  season.weeks.forEach((week, index) => {
    const weight = index + 1; // oldest completed week = 1, most recent = season.weeks.length
    for (const game of week.games) {
      const margin = game.a.points - game.b.points;
      weightedMarginSum.set(game.a.rosterId, (weightedMarginSum.get(game.a.rosterId) ?? 0) + margin * weight);
      weightSum.set(game.a.rosterId, (weightSum.get(game.a.rosterId) ?? 0) + weight);

      weightedMarginSum.set(game.b.rosterId, (weightedMarginSum.get(game.b.rosterId) ?? 0) - margin * weight);
      weightSum.set(game.b.rosterId, (weightSum.get(game.b.rosterId) ?? 0) + weight);
    }
  });

  const scored = [...season.teams.keys()].map((rosterId) => {
    const weight = weightSum.get(rosterId) ?? 0;
    const score = weight > 0 ? (weightedMarginSum.get(rosterId) ?? 0) / weight : 0;
    return { rosterId, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry, i) => ({ ...entry, rank: i + 1 }));
}
