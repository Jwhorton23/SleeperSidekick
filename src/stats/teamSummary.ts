import type { PlayerMeta, RosterId, Season } from "../data/types";
import type { AllPlayRecord } from "./allPlay";
import { coachingEfficiency } from "./coachingEfficiency";
import { luckIndex } from "./luckIndex";
import { powerRankings } from "./powerRankings";
import { scheduleSwapMatrix } from "./scheduleSwap";

/**
 * Every season number the league dashboard shows about one team, in one
 * object.
 *
 * The dashboard used to render a card per metric, each one walking the
 * season again to sort its own list. Assembling all of it here means the
 * league-wide stat functions run exactly once per season, and a team's
 * numbers can't disagree between the card that lists it and the card that
 * ranks it. Adding a stat mid-season is a field here plus a tile in
 * `TEAM_KPIS`, not a new pass over the schedule.
 */
export interface TeamSummary {
  rosterId: RosterId;
  powerRank: number;
  powerScore: number;
  record: { wins: number; losses: number; ties: number };
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  allPlayRecord: AllPlayRecord;
  allPlayWinPct: number;
  /** Actual wins minus the wins the scoring predicted. */
  luck: number;
  expectedWins: number;
  pointsLeftOnBench: number;
  bestWeek: { week: number; points: number } | null;
  worstWeek: { week: number; points: number } | null;
  /** Wins this team would have under the league's kindest and cruelest
   * schedule — the spread the schedule alone is worth. */
  bestScheduleWins: number;
  worstScheduleWins: number;
}

/**
 * One pass over the season per league-wide stat, then a summary per team.
 * Sorted strongest power ranking first, so the caller's team list *is* the
 * power rankings.
 */
export function teamSummaries(season: Season, playerIndex: Map<string, PlayerMeta>): TeamSummary[] {
  const luck = luckIndex(season);
  const power = powerRankings(season);
  const swap = scheduleSwapMatrix(season);
  const efficiency = coachingEfficiency(season, playerIndex);

  const pointsFor = new Map<RosterId, number>();
  const pointsAgainst = new Map<RosterId, number>();
  const bestWeek = new Map<RosterId, { week: number; points: number }>();
  const worstWeek = new Map<RosterId, { week: number; points: number }>();

  for (const week of season.weeks) {
    for (const game of week.games) {
      for (const [team, opponent] of [
        [game.a, game.b],
        [game.b, game.a],
      ] as const) {
        const id = team.rosterId;
        pointsFor.set(id, (pointsFor.get(id) ?? 0) + team.points);
        pointsAgainst.set(id, (pointsAgainst.get(id) ?? 0) + opponent.points);

        const best = bestWeek.get(id);
        if (!best || team.points > best.points) bestWeek.set(id, { week: week.week, points: team.points });
        const worst = worstWeek.get(id);
        if (!worst || team.points < worst.points) worstWeek.set(id, { week: week.week, points: team.points });
      }
    }
  }

  return power.map((entry) => {
    const rosterId = entry.rosterId;
    const luckEntry = luck.get(rosterId);
    const record = luckEntry?.record ?? { wins: 0, losses: 0, ties: 0 };

    const swapRecords = [...(swap.get(rosterId)?.values() ?? [])];
    const scheduleWins = swapRecords.map((r) => r.wins);

    return {
      rosterId,
      powerRank: entry.rank,
      powerScore: entry.score,
      record,
      gamesPlayed: record.wins + record.losses + record.ties,
      pointsFor: pointsFor.get(rosterId) ?? 0,
      pointsAgainst: pointsAgainst.get(rosterId) ?? 0,
      allPlayRecord: luckEntry?.allPlayRecord ?? { wins: 0, losses: 0, ties: 0 },
      allPlayWinPct: luckEntry?.allPlayWinPct ?? 0,
      luck: luckEntry?.luck ?? 0,
      expectedWins: luckEntry?.expectedWins ?? 0,
      pointsLeftOnBench: (efficiency.get(rosterId) ?? []).reduce((sum, w) => sum + Math.max(0, w.optimal - w.actual), 0),
      bestWeek: bestWeek.get(rosterId) ?? null,
      worstWeek: worstWeek.get(rosterId) ?? null,
      bestScheduleWins: scheduleWins.length > 0 ? Math.max(...scheduleWins) : 0,
      worstScheduleWins: scheduleWins.length > 0 ? Math.min(...scheduleWins) : 0,
    };
  });
}

/**
 * Where each team places on one number, 1 = best. Teams that tie share the
 * place, and the next team down skips the gap — two firsts are followed by a
 * third, the way standings read.
 *
 * The per-team cards replaced the league-wide sorted lists, so this is what
 * keeps "is that a good number?" answerable without scrolling every card.
 */
export function rankBy(
  summaries: TeamSummary[],
  value: (summary: TeamSummary) => number,
  higherIsBetter = true,
): Map<RosterId, number> {
  const sorted = [...summaries].sort((a, b) => (higherIsBetter ? value(b) - value(a) : value(a) - value(b)));

  const ranks = new Map<RosterId, number>();
  let place = 0;
  let previous: number | null = null;

  sorted.forEach((summary, index) => {
    const current = value(summary);
    if (previous === null || current !== previous) place = index + 1;
    ranks.set(summary.rosterId, place);
    previous = current;
  });

  return ranks;
}
