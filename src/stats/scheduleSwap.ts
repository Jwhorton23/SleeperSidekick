import type { RosterId, Season } from "../data/types";

export interface ScheduleSwapRecord {
  wins: number;
  losses: number;
  ties: number;
}

/**
 * For every (team, scheduleOwner) pair: the record `team` would have if it
 * had faced whoever `scheduleOwner` actually played, week by week, instead
 * of its own real opponents. The diagonal (team === scheduleOwner) is just
 * that team's actual record, since "playing your own schedule" is what
 * really happened.
 */
export function scheduleSwapMatrix(season: Season): Map<RosterId, Map<RosterId, ScheduleSwapRecord>> {
  const ownPointsByWeek: Map<RosterId, number>[] = [];
  const opponentPointsByWeek: Map<RosterId, number>[] = [];

  for (const week of season.weeks) {
    const own = new Map<RosterId, number>();
    const opponent = new Map<RosterId, number>();
    for (const game of week.games) {
      own.set(game.a.rosterId, game.a.points);
      own.set(game.b.rosterId, game.b.points);
      opponent.set(game.a.rosterId, game.b.points);
      opponent.set(game.b.rosterId, game.a.points);
    }
    ownPointsByWeek.push(own);
    opponentPointsByWeek.push(opponent);
  }

  const rosterIds = [...season.teams.keys()];
  const matrix = new Map<RosterId, Map<RosterId, ScheduleSwapRecord>>();

  for (const team of rosterIds) {
    const row = new Map<RosterId, ScheduleSwapRecord>();
    for (const scheduleOwner of rosterIds) {
      let wins = 0;
      let losses = 0;
      let ties = 0;
      for (let w = 0; w < season.weeks.length; w++) {
        const teamPoints = ownPointsByWeek[w].get(team);
        const opponentPoints = opponentPointsByWeek[w].get(scheduleOwner);
        if (teamPoints == null || opponentPoints == null) continue;
        if (teamPoints > opponentPoints) wins++;
        else if (teamPoints < opponentPoints) losses++;
        else ties++;
      }
      row.set(scheduleOwner, { wins, losses, ties });
    }
    matrix.set(team, row);
  }

  return matrix;
}
