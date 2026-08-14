import type { Game, TeamWeek, Week } from "../data/types";

export interface WeeklyHighlights {
  blowout: Game;
  closest: Game;
  highestScoringLoser: TeamWeek | null;
}

function margin(game: Game): number {
  return Math.abs(game.a.points - game.b.points);
}

function loser(game: Game): TeamWeek | null {
  if (game.a.points < game.b.points) return game.a;
  if (game.b.points < game.a.points) return game.b;
  return null; // tie — no loser
}

export function weeklyHighlights(week: Week): WeeklyHighlights | null {
  if (week.games.length === 0) return null;

  let blowout = week.games[0];
  let closest = week.games[0];
  let highestScoringLoser: TeamWeek | null = null;

  for (const game of week.games) {
    if (margin(game) > margin(blowout)) blowout = game;
    if (margin(game) < margin(closest)) closest = game;

    const gameLoser = loser(game);
    if (gameLoser && (!highestScoringLoser || gameLoser.points > highestScoringLoser.points)) {
      highestScoringLoser = gameLoser;
    }
  }

  return { blowout, closest, highestScoringLoser };
}
