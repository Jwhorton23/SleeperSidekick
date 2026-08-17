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

/** A graded pick tagged with the season it was made in, so career views can
 * say "2024" next to it. */
export interface SeasonDraftPickGrade {
  season: string;
  grade: DraftPickGrade;
}

/** How far a pick beat where it was taken. Positive means the player finished
 * ahead of his draft slot; negative means he fell short. */
export function pickRankGain(grade: DraftPickGrade): number {
  return grade.positionalDraftRank - grade.positionalFinishRank;
}

/** Every graded pick each manager has ever made, newest season first. */
export function careerDraftPickGrades(leagueData: LeagueData): Map<UserId, SeasonDraftPickGrade[]> {
  const result = new Map<UserId, SeasonDraftPickGrade[]>();

  for (const season of leagueData.seasons) {
    for (const grade of gradeDraftPicks(season)) {
      if (!grade.pick.pickedByUserId) continue; // unclaimed slot — no manager to credit
      const picks = result.get(grade.pick.pickedByUserId) ?? [];
      picks.push({ season: season.season, grade });
      result.set(grade.pick.pickedByUserId, picks);
    }
  }

  return result;
}

export interface DraftHitRate {
  totalPicks: number;
  hits: number;
  hitRate: number; // 0-1
  /** The picks that moved the number most in each direction, so the rate is
   * checkable against real players rather than taken on faith. */
  bestPick: SeasonDraftPickGrade | null;
  worstPick: SeasonDraftPickGrade | null;
}

/** Career hit rate per manager, across every season's draft in leagueData. */
export function careerDraftHitRates(leagueData: LeagueData): Map<UserId, DraftHitRate> {
  const result = new Map<UserId, DraftHitRate>();

  for (const [userId, picks] of careerDraftPickGrades(leagueData)) {
    let hits = 0;
    let bestPick: SeasonDraftPickGrade | null = null;
    let worstPick: SeasonDraftPickGrade | null = null;

    for (const entry of picks) {
      if (entry.grade.isHit) hits++;
      if (!bestPick || pickRankGain(entry.grade) > pickRankGain(bestPick.grade)) bestPick = entry;
      if (!worstPick || pickRankGain(entry.grade) < pickRankGain(worstPick.grade)) worstPick = entry;
    }

    result.set(userId, {
      totalPicks: picks.length,
      hits,
      hitRate: picks.length > 0 ? hits / picks.length : 0,
      bestPick,
      worstPick,
    });
  }

  return result;
}
