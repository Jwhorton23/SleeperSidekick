import type { RosterId, Season } from "../data/types";

export interface PlayoffOddsEntry {
  rosterId: RosterId;
  playoffPct: number; // 0-100
}

export interface PlayoffOddsOptions {
  simulations?: number;
  rng?: () => number; // injectable for deterministic tests; defaults to Math.random
}

interface StandingsState {
  wins: Map<RosterId, number>; // ties count as 0.5
  points: Map<RosterId, number>;
}

function actualStandings(season: Season): { standings: StandingsState; scoreHistory: Map<RosterId, number[]> } {
  const wins = new Map<RosterId, number>();
  const points = new Map<RosterId, number>();
  const scoreHistory = new Map<RosterId, number[]>();
  for (const rosterId of season.teams.keys()) {
    wins.set(rosterId, 0);
    points.set(rosterId, 0);
    scoreHistory.set(rosterId, []);
  }

  for (const week of season.weeks) {
    for (const game of week.games) {
      for (const [team, opponent] of [
        [game.a, game.b],
        [game.b, game.a],
      ] as const) {
        points.set(team.rosterId, (points.get(team.rosterId) ?? 0) + team.points);
        scoreHistory.get(team.rosterId)?.push(team.points);
        if (team.points > opponent.points) wins.set(team.rosterId, (wins.get(team.rosterId) ?? 0) + 1);
        else if (team.points === opponent.points) wins.set(team.rosterId, (wins.get(team.rosterId) ?? 0) + 0.5);
      }
    }
  }

  return { standings: { wins, points }, scoreHistory };
}

function rankTopN(standings: StandingsState, rosterIds: RosterId[], n: number): Set<RosterId> {
  const ranked = [...rosterIds].sort((a, b) => {
    const winDiff = (standings.wins.get(b) ?? 0) - (standings.wins.get(a) ?? 0);
    if (winDiff !== 0) return winDiff;
    return (standings.points.get(b) ?? 0) - (standings.points.get(a) ?? 0);
  });
  return new Set(ranked.slice(0, n));
}

/**
 * Monte Carlo playoff odds: for each simulation, fills in the remaining
 * schedule by bootstrap-resampling each team's own historical weekly
 * scores (its own scoring level and variance, without needing a
 * statistical model), tallies final wins/points with the standard
 * wins-then-points tiebreak, and checks who's in the top `playoffTeams`.
 * Odds are the fraction of simulations each team made it.
 *
 * With no remaining schedule, the season's already decided — this
 * returns each team's actual final standing as 100% or 0%, no
 * simulation needed.
 */
export function simulatePlayoffOdds(season: Season, options: PlayoffOddsOptions = {}): PlayoffOddsEntry[] {
  const simulations = options.simulations ?? 10000;
  const rng = options.rng ?? Math.random;
  const rosterIds = [...season.teams.keys()];
  const { standings, scoreHistory } = actualStandings(season);

  if (season.remainingWeeks.length === 0) {
    const madeIt = rankTopN(standings, rosterIds, season.playoffTeams);
    return rosterIds
      .map((rosterId) => ({ rosterId, playoffPct: madeIt.has(rosterId) ? 100 : 0 }))
      .sort((a, b) => b.playoffPct - a.playoffPct);
  }

  const leaguePooledScores = rosterIds.flatMap((id) => scoreHistory.get(id) ?? []);
  function sampleScore(rosterId: RosterId): number {
    const history = scoreHistory.get(rosterId);
    const pool = history && history.length > 0 ? history : leaguePooledScores;
    if (pool.length === 0) return 0;
    return pool[Math.floor(rng() * pool.length)];
  }

  const playoffCount = new Map<RosterId, number>(rosterIds.map((id) => [id, 0]));

  for (let sim = 0; sim < simulations; sim++) {
    const simWins = new Map(standings.wins);
    const simPoints = new Map(standings.points);

    for (const week of season.remainingWeeks) {
      for (const { rosterIdA, rosterIdB } of week.matchups) {
        const scoreA = sampleScore(rosterIdA);
        const scoreB = sampleScore(rosterIdB);
        simPoints.set(rosterIdA, (simPoints.get(rosterIdA) ?? 0) + scoreA);
        simPoints.set(rosterIdB, (simPoints.get(rosterIdB) ?? 0) + scoreB);
        if (scoreA > scoreB) simWins.set(rosterIdA, (simWins.get(rosterIdA) ?? 0) + 1);
        else if (scoreB > scoreA) simWins.set(rosterIdB, (simWins.get(rosterIdB) ?? 0) + 1);
        else {
          simWins.set(rosterIdA, (simWins.get(rosterIdA) ?? 0) + 0.5);
          simWins.set(rosterIdB, (simWins.get(rosterIdB) ?? 0) + 0.5);
        }
      }
    }

    const madeIt = rankTopN({ wins: simWins, points: simPoints }, rosterIds, season.playoffTeams);
    for (const rosterId of madeIt) {
      playoffCount.set(rosterId, (playoffCount.get(rosterId) ?? 0) + 1);
    }
  }

  return rosterIds
    .map((rosterId) => ({ rosterId, playoffPct: ((playoffCount.get(rosterId) ?? 0) / simulations) * 100 }))
    .sort((a, b) => b.playoffPct - a.playoffPct);
}
