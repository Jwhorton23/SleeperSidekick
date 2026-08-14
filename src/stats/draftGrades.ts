import type { DraftPick, LeagueData, Season, UserId } from "../data/types";

export interface DraftPickGrade {
  pick: DraftPick;
  seasonPoints: number;
  positionalDraftRank: number; // e.g. 3rd RB taken in this draft
  positionalFinishRank: number; // e.g. 5th-highest-scoring RB among drafted RBs
  isHit: boolean;
}

/**
 * Grades every pick in a season's draft by comparing draft order to
 * season-long scoring — both restricted to players at the same position
 * *within this draft*, since we don't have external ADP/projection data
 * to compare against. A pick is a "hit" if the player finished at least
 * as well, relative to same-position draft peers, as where they were
 * taken (e.g. the 3rd RB drafted finishing as the 3rd-or-better scoring
 * RB among drafted RBs).
 */
export function gradeDraftPicks(season: Season): DraftPickGrade[] {
  const pointsByPlayer = new Map<string, number>();
  for (const week of [...season.weeks, ...season.playoffWeeks]) {
    for (const game of week.games) {
      for (const team of [game.a, game.b]) {
        for (const p of [...team.starters, ...team.bench]) {
          if (p.playerId === "0") continue;
          pointsByPlayer.set(p.playerId, (pointsByPlayer.get(p.playerId) ?? 0) + p.points);
        }
      }
    }
  }

  const byPosition = new Map<string, DraftPick[]>();
  for (const pick of season.draftPicks) {
    const picks = byPosition.get(pick.position) ?? [];
    picks.push(pick);
    byPosition.set(pick.position, picks);
  }

  const grades: DraftPickGrade[] = [];
  for (const picks of byPosition.values()) {
    const byDraftOrder = [...picks].sort((a, b) => a.pickNo - b.pickNo);
    const byFinish = [...picks].sort((a, b) => (pointsByPlayer.get(b.playerId) ?? 0) - (pointsByPlayer.get(a.playerId) ?? 0));

    const finishRankByPlayer = new Map<string, number>();
    byFinish.forEach((pick, i) => finishRankByPlayer.set(pick.playerId, i + 1));

    byDraftOrder.forEach((pick, i) => {
      const positionalDraftRank = i + 1;
      const positionalFinishRank = finishRankByPlayer.get(pick.playerId)!;
      grades.push({
        pick,
        seasonPoints: pointsByPlayer.get(pick.playerId) ?? 0,
        positionalDraftRank,
        positionalFinishRank,
        isHit: positionalFinishRank <= positionalDraftRank,
      });
    });
  }

  return grades;
}

export interface DraftHitRate {
  totalPicks: number;
  hits: number;
  hitRate: number; // 0-1
}

/** Career hit rate per manager, across every season's draft in leagueData. */
export function careerDraftHitRates(leagueData: LeagueData): Map<UserId, DraftHitRate> {
  const result = new Map<UserId, DraftHitRate>();
  function ensure(userId: UserId): DraftHitRate {
    if (!result.has(userId)) result.set(userId, { totalPicks: 0, hits: 0, hitRate: 0 });
    return result.get(userId)!;
  }

  for (const season of leagueData.seasons) {
    for (const grade of gradeDraftPicks(season)) {
      if (!grade.pick.pickedByUserId) continue; // unclaimed slot — no manager to credit
      const record = ensure(grade.pick.pickedByUserId);
      record.totalPicks++;
      if (grade.isHit) record.hits++;
    }
  }

  for (const record of result.values()) {
    record.hitRate = record.totalPicks > 0 ? record.hits / record.totalPicks : 0;
  }

  return result;
}
