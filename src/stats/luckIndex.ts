import type { RosterId, Season } from "../data/types";
import { allPlay, allPlayWinPct, type AllPlayRecord } from "./allPlay";

export interface LuckIndexEntry {
  /** Ties count as half, matching the all-play win% this is measured
   * against — so this can be a fraction. Use {@link record} to display. */
  actualWins: number;
  /** The real W-L-T, as whole games, for display. */
  record: { wins: number; losses: number; ties: number };
  expectedWins: number;
  luck: number;
  /** Carried here so callers that need both — the dashboard shows the
   * all-play card and the luck card side by side — don't walk the season
   * twice. */
  allPlayRecord: AllPlayRecord;
  allPlayWinPct: number;
}

/** Luck = actual head-to-head wins minus expected wins (all-play win% times
 * games played). Positive means a team's record is better than its scoring
 * would predict; negative means it's been getting outscored more than its
 * record shows. */
export function luckIndex(season: Season): Map<RosterId, LuckIndexEntry> {
  const wins = new Map<RosterId, number>();
  const losses = new Map<RosterId, number>();
  const ties = new Map<RosterId, number>();
  for (const rosterId of season.teams.keys()) {
    wins.set(rosterId, 0);
    losses.set(rosterId, 0);
    ties.set(rosterId, 0);
  }

  const bump = (map: Map<RosterId, number>, rosterId: RosterId) => map.set(rosterId, (map.get(rosterId) ?? 0) + 1);

  for (const week of season.weeks) {
    for (const game of week.games) {
      if (game.a.points > game.b.points) {
        bump(wins, game.a.rosterId);
        bump(losses, game.b.rosterId);
      } else if (game.b.points > game.a.points) {
        bump(wins, game.b.rosterId);
        bump(losses, game.a.rosterId);
      } else {
        bump(ties, game.a.rosterId);
        bump(ties, game.b.rosterId);
      }
    }
  }

  const allPlayRecords = allPlay(season);
  const result = new Map<RosterId, LuckIndexEntry>();
  for (const rosterId of season.teams.keys()) {
    const allPlayRecord = allPlayRecords.get(rosterId) ?? { wins: 0, losses: 0, ties: 0 };
    const winPct = allPlayWinPct(allPlayRecord);

    const w = wins.get(rosterId) ?? 0;
    const l = losses.get(rosterId) ?? 0;
    const t = ties.get(rosterId) ?? 0;
    const played = w + l + t;
    // A tie is half a win on both sides, matching how the all-play win
    // percentage it's compared against treats them.
    const actualWins = w + t * 0.5;
    const expectedWins = winPct * played;

    result.set(rosterId, {
      actualWins,
      record: { wins: w, losses: l, ties: t },
      expectedWins,
      luck: actualWins - expectedWins,
      allPlayRecord,
      allPlayWinPct: winPct,
    });
  }

  return result;
}
