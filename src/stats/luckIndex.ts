import type { RosterId, Season } from "../data/types";
import { allPlay } from "./allPlay";

export interface LuckIndexEntry {
  actualWins: number;
  expectedWins: number;
  luck: number;
}

/** Luck = actual head-to-head wins minus expected wins (all-play win% times
 * games played). Positive means a team's record is better than its scoring
 * would predict; negative means it's been getting outscored more than its
 * record shows. */
export function luckIndex(season: Season): Map<RosterId, LuckIndexEntry> {
  const actualWins = new Map<RosterId, number>();
  const gamesPlayed = new Map<RosterId, number>();
  for (const rosterId of season.teams.keys()) {
    actualWins.set(rosterId, 0);
    gamesPlayed.set(rosterId, 0);
  }

  for (const week of season.weeks) {
    for (const game of week.games) {
      gamesPlayed.set(game.a.rosterId, (gamesPlayed.get(game.a.rosterId) ?? 0) + 1);
      gamesPlayed.set(game.b.rosterId, (gamesPlayed.get(game.b.rosterId) ?? 0) + 1);

      if (game.a.points > game.b.points) {
        actualWins.set(game.a.rosterId, (actualWins.get(game.a.rosterId) ?? 0) + 1);
      } else if (game.b.points > game.a.points) {
        actualWins.set(game.b.rosterId, (actualWins.get(game.b.rosterId) ?? 0) + 1);
      } else {
        actualWins.set(game.a.rosterId, (actualWins.get(game.a.rosterId) ?? 0) + 0.5);
        actualWins.set(game.b.rosterId, (actualWins.get(game.b.rosterId) ?? 0) + 0.5);
      }
    }
  }

  const allPlayRecords = allPlay(season);
  const result = new Map<RosterId, LuckIndexEntry>();
  for (const rosterId of season.teams.keys()) {
    const record = allPlayRecords.get(rosterId) ?? { wins: 0, losses: 0, ties: 0 };
    const totalAllPlayGames = record.wins + record.losses + record.ties;
    const winPct = totalAllPlayGames > 0 ? (record.wins + record.ties * 0.5) / totalAllPlayGames : 0;
    const played = gamesPlayed.get(rosterId) ?? 0;
    const expectedWins = winPct * played;
    const wins = actualWins.get(rosterId) ?? 0;
    result.set(rosterId, { actualWins: wins, expectedWins, luck: wins - expectedWins });
  }

  return result;
}
