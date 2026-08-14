import type { PlayerMeta, RosterId, Season, TeamWeek } from "../data/types";
import { optimalLineupPoints } from "./lineup";

export interface CoachingEfficiencyWeek {
  week: number;
  actual: number;
  optimal: number;
}

export function coachingEfficiency(
  season: Season,
  playerIndex: Map<string, PlayerMeta>,
): Map<RosterId, CoachingEfficiencyWeek[]> {
  const result = new Map<RosterId, CoachingEfficiencyWeek[]>();

  function record(week: number, teamWeek: TeamWeek) {
    const candidates = [...teamWeek.starters, ...teamWeek.bench]
      .filter((p) => p.playerId !== "0")
      .map((p) => ({ playerId: p.playerId, points: p.points, positions: playerIndex.get(p.playerId)?.positions ?? [] }))
      .filter((c) => c.positions.length > 0);

    const optimal = optimalLineupPoints(season.starterSlots, candidates);
    const entries = result.get(teamWeek.rosterId) ?? [];
    entries.push({ week, actual: teamWeek.points, optimal });
    result.set(teamWeek.rosterId, entries);
  }

  for (const week of season.weeks) {
    for (const game of week.games) {
      record(week.week, game.a);
      record(week.week, game.b);
    }
  }

  return result;
}
