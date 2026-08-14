import type { PlayerMeta, Season, UserId } from "../data/types";
import { coachingEfficiency } from "./coachingEfficiency";
import { careerDraftHitRates } from "./draftGrades";
import { faabEfficiency } from "./faabEfficiency";
import { luckIndex } from "./luckIndex";

export interface SeasonAward {
  key: string;
  title: string;
  userId: UserId;
  detail: string;
}

/** Fun superlatives for a single season, built entirely from stats we
 * already compute elsewhere — this is just picking the extremes and
 * attaching a manager to each. */
export function seasonAwards(season: Season, playerIndex: Map<string, PlayerMeta>): SeasonAward[] {
  const awards: SeasonAward[] = [];
  const ownerOf = (rosterId: number) => season.teams.get(rosterId)?.ownerId;

  const efficiency = coachingEfficiency(season, playerIndex);
  const benchTotals = [...efficiency.entries()].map(([rosterId, weeks]) => ({
    rosterId,
    total: weeks.reduce((sum, w) => sum + Math.max(0, w.optimal - w.actual), 0),
  }));
  if (benchTotals.length > 0) {
    const worst = benchTotals.reduce((a, b) => (b.total > a.total ? b : a));
    const ownerId = ownerOf(worst.rosterId);
    if (ownerId) {
      awards.push({
        key: "sleeps-at-the-wheel",
        title: "Sleeps at the Wheel",
        userId: ownerId,
        detail: `${worst.total.toFixed(1)} points left on the bench this season`,
      });
    }
  }

  const luck = [...luckIndex(season).entries()];
  if (luck.length > 0) {
    const luckiest = luck.reduce((a, b) => (b[1].luck > a[1].luck ? b : a));
    const unluckiest = luck.reduce((a, b) => (b[1].luck < a[1].luck ? b : a));
    const luckyOwner = ownerOf(luckiest[0]);
    const unluckyOwner = ownerOf(unluckiest[0]);
    if (luckyOwner) {
      awards.push({ key: "luckiest", title: "Luckiest Manager", userId: luckyOwner, detail: `+${luckiest[1].luck.toFixed(1)} luck` });
    }
    if (unluckyOwner) {
      awards.push({ key: "snake-bit", title: "Snake Bit", userId: unluckyOwner, detail: `${unluckiest[1].luck.toFixed(1)} luck` });
    }
  }

  // Only meaningful with a handful of picks to actually judge — a manager
  // with one lucky/unlucky pick shouldn't swing a "Sharpest GM" award.
  const hitRates = [...careerDraftHitRates({ managers: new Map(), seasons: [season] }).entries()].filter(
    ([, r]) => r.totalPicks >= 3,
  );
  if (hitRates.length > 0) {
    const best = hitRates.reduce((a, b) => (b[1].hitRate > a[1].hitRate ? b : a));
    awards.push({
      key: "sharpest-gm",
      title: "Sharpest GM",
      userId: best[0],
      detail: `${Math.round(best[1].hitRate * 100)}% hit rate on ${best[1].totalPicks} picks`,
    });
  }

  if (season.usesFaab) {
    const faabEntries = [...faabEfficiency(season).entries()].filter(([, e]) => e.totalSpent > 0);
    if (faabEntries.length > 0) {
      const best = faabEntries.reduce((a, b) => (b[1].pointsPerDollar > a[1].pointsPerDollar ? b : a));
      const ownerId = ownerOf(best[0]);
      if (ownerId) {
        awards.push({
          key: "waiver-wizard",
          title: "Waiver Wire Wizard",
          userId: ownerId,
          detail: `${best[1].pointsPerDollar.toFixed(2)} pts per FAAB $`,
        });
      }
    }
  }

  return awards;
}
