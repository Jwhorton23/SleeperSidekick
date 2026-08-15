import type { PlayerMeta, RosterId, Season, TeamWeek } from "../data/types";
import { allPlayByWeek } from "./allPlay";
import { coachingEfficiency } from "./coachingEfficiency";

export interface TeamWeekLogEntry {
  week: number;
  points: number;
  opponentRosterId: RosterId | null;
  opponentPoints: number | null;
  result: "W" | "L" | "T" | null;
  margin: number | null;
  /** Points the optimal lineup would have scored, and the gap to what was
   * actually started. */
  optimal: number;
  pointsLeftOnBench: number;
  /** How this week's score fared against the rest of the league: "beat
   * `allPlayWins` of `allPlayGames`". */
  allPlayWins: number;
  allPlayGames: number;
  topStarter: { name: string; points: number } | null;
}

function opponentOf(week: Season["weeks"][number], rosterId: RosterId): TeamWeek | null {
  for (const game of week.games) {
    if (game.a.rosterId === rosterId) return game.b;
    if (game.b.rosterId === rosterId) return game.a;
  }
  return null;
}

function ownEntry(week: Season["weeks"][number], rosterId: RosterId): TeamWeek | null {
  for (const game of week.games) {
    if (game.a.rosterId === rosterId) return game.a;
    if (game.b.rosterId === rosterId) return game.b;
  }
  return null;
}

/**
 * One manager's season, week by week — the matchup result plus the context
 * the box score leaves out: how the score would have fared against the rest
 * of the league that week, and what was left on the bench.
 *
 * A team on a bye (odd league size, or a week it wasn't scheduled) still
 * appears if it posted a score, with a null opponent and result.
 */
export function teamLog(
  season: Season,
  rosterId: RosterId,
  playerIndex: Map<string, PlayerMeta>,
): TeamWeekLogEntry[] {
  const allPlay = allPlayByWeek(season).get(rosterId) ?? [];
  const allPlayByWeekNo = new Map(allPlay.map((entry) => [entry.week, entry]));

  const efficiency = coachingEfficiency(season, playerIndex).get(rosterId) ?? [];
  const efficiencyByWeek = new Map(efficiency.map((entry) => [entry.week, entry]));

  const log: TeamWeekLogEntry[] = [];

  for (const week of season.weeks) {
    const own = ownEntry(week, rosterId);
    if (!own) continue;

    const opponent = opponentOf(week, rosterId);
    const eff = efficiencyByWeek.get(week.week);
    const ap = allPlayByWeekNo.get(week.week);

    const topStarter = own.starters
      .filter((p) => p.playerId !== "0")
      .reduce<{ name: string; points: number } | null>((best, p) => {
        if (best && p.points <= best.points) return best;
        return { name: playerIndex.get(p.playerId)?.name ?? "Unknown player", points: p.points };
      }, null);

    const optimal = eff?.optimal ?? own.points;

    log.push({
      week: week.week,
      points: own.points,
      opponentRosterId: opponent?.rosterId ?? null,
      opponentPoints: opponent?.points ?? null,
      result: opponent ? (own.points > opponent.points ? "W" : own.points < opponent.points ? "L" : "T") : null,
      margin: opponent ? own.points - opponent.points : null,
      optimal,
      pointsLeftOnBench: Math.max(0, optimal - own.points),
      allPlayWins: ap?.wins ?? 0,
      allPlayGames: ap ? ap.wins + ap.losses + ap.ties : 0,
      topStarter,
    });
  }

  return log;
}

/** Total points scored by each roster — the tiebreak standings use, and the
 * one measure of a team that owes nothing to the schedule. */
export function pointsForByRoster(season: Season): Map<RosterId, number> {
  const result = new Map<RosterId, number>();
  for (const rosterId of season.teams.keys()) result.set(rosterId, 0);

  for (const week of season.weeks) {
    for (const game of week.games) {
      for (const team of [game.a, game.b]) {
        result.set(team.rosterId, (result.get(team.rosterId) ?? 0) + team.points);
      }
    }
  }

  return result;
}

export interface TeamSeasonTotals {
  pointsFor: number;
  pointsAgainst: number;
  bestWeek: { week: number; points: number } | null;
  worstWeek: { week: number; points: number } | null;
  pointsLeftOnBench: number;
}

/** Season roll-ups derived from a game log, so the manager page's KPI tiles
 * and its week list can never disagree. */
export function teamSeasonTotals(log: TeamWeekLogEntry[]): TeamSeasonTotals {
  const totals: TeamSeasonTotals = {
    pointsFor: 0,
    pointsAgainst: 0,
    bestWeek: null,
    worstWeek: null,
    pointsLeftOnBench: 0,
  };

  for (const entry of log) {
    totals.pointsFor += entry.points;
    totals.pointsAgainst += entry.opponentPoints ?? 0;
    totals.pointsLeftOnBench += entry.pointsLeftOnBench;

    if (!totals.bestWeek || entry.points > totals.bestWeek.points) {
      totals.bestWeek = { week: entry.week, points: entry.points };
    }
    if (!totals.worstWeek || entry.points < totals.worstWeek.points) {
      totals.worstWeek = { week: entry.week, points: entry.points };
    }
  }

  return totals;
}
