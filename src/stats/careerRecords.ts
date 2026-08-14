import type { LeagueData, RosterId, Season, UserId, Week } from "../data/types";

export interface HeadToHeadRecord {
  wins: number;
  losses: number;
  ties: number;
}

function ensureH2H(matrix: Map<UserId, Map<UserId, HeadToHeadRecord>>, a: UserId, b: UserId): HeadToHeadRecord {
  if (!matrix.has(a)) matrix.set(a, new Map());
  const row = matrix.get(a)!;
  if (!row.has(b)) row.set(b, { wins: 0, losses: 0, ties: 0 });
  return row.get(b)!;
}

/** Every pair of managers who've ever played each other, across every
 * season in leagueData (regular season + playoffs — this is the factual
 * historical record, not the apples-to-apples comparison the MVP stats
 * use). Keyed by userId, which is stable across seasons unlike rosterId. */
export function headToHeadMatrix(leagueData: LeagueData): Map<UserId, Map<UserId, HeadToHeadRecord>> {
  const matrix = new Map<UserId, Map<UserId, HeadToHeadRecord>>();

  for (const season of leagueData.seasons) {
    for (const week of [...season.weeks, ...season.playoffWeeks]) {
      for (const game of week.games) {
        const ownerA = season.teams.get(game.a.rosterId)?.ownerId;
        const ownerB = season.teams.get(game.b.rosterId)?.ownerId;
        if (!ownerA || !ownerB) continue;

        const ab = ensureH2H(matrix, ownerA, ownerB);
        const ba = ensureH2H(matrix, ownerB, ownerA);
        if (game.a.points > game.b.points) {
          ab.wins++;
          ba.losses++;
        } else if (game.b.points > game.a.points) {
          ab.losses++;
          ba.wins++;
        } else {
          ab.ties++;
          ba.ties++;
        }
      }
    }
  }

  return matrix;
}

export interface CareerRecord {
  userId: UserId;
  seasonsPlayed: string[]; // ascending
  careerPoints: number;
  championships: string[]; // seasons won, ascending
  longestWinStreak: number;
  longestLossStreak: number;
}

function ensureCareer(records: Map<UserId, CareerRecord>, userId: UserId): CareerRecord {
  if (!records.has(userId)) {
    records.set(userId, {
      userId,
      seasonsPlayed: [],
      careerPoints: 0,
      championships: [],
      longestWinStreak: 0,
      longestLossStreak: 0,
    });
  }
  return records.get(userId)!;
}

function ownerOf(season: Season, rosterId: RosterId): UserId | undefined {
  return season.teams.get(rosterId)?.ownerId;
}

/** Career totals per manager across every season in leagueData. Streaks
 * are computed chronologically across season boundaries — a streak that
 * ends one season and continues into the next still counts as one streak,
 * since it's the same manager playing consecutive real games. */
export function careerRecords(leagueData: LeagueData): Map<UserId, CareerRecord> {
  const records = new Map<UserId, CareerRecord>();
  const currentStreak = new Map<UserId, { type: "W" | "L"; count: number }>();

  // leagueData.seasons is newest-first (the contract); streaks need oldest-first.
  const chronological = [...leagueData.seasons].reverse();

  for (const season of chronological) {
    const ownersThisSeason = new Set<UserId>();
    for (const team of season.teams.values()) ownersThisSeason.add(team.ownerId);
    for (const ownerId of ownersThisSeason) {
      ensureCareer(records, ownerId).seasonsPlayed.push(season.season);
    }

    if (season.championRosterId != null) {
      const championOwner = ownerOf(season, season.championRosterId);
      if (championOwner) ensureCareer(records, championOwner).championships.push(season.season);
    }

    const allWeeks: Week[] = [...season.weeks, ...season.playoffWeeks].sort((a, b) => a.week - b.week);
    for (const week of allWeeks) {
      for (const game of week.games) {
        for (const [team, opponent] of [
          [game.a, game.b],
          [game.b, game.a],
        ] as const) {
          const ownerId = ownerOf(season, team.rosterId);
          if (!ownerId) continue;

          const record = ensureCareer(records, ownerId);
          record.careerPoints += team.points;

          const outcome = team.points > opponent.points ? "W" : team.points < opponent.points ? "L" : null;
          if (outcome === null) {
            currentStreak.delete(ownerId); // a tie breaks any streak
            continue;
          }

          const streak = currentStreak.get(ownerId);
          const updated: { type: "W" | "L"; count: number } =
            streak && streak.type === outcome ? { type: outcome, count: streak.count + 1 } : { type: outcome, count: 1 };
          currentStreak.set(ownerId, updated);

          if (outcome === "W") record.longestWinStreak = Math.max(record.longestWinStreak, updated.count);
          else record.longestLossStreak = Math.max(record.longestLossStreak, updated.count);
        }
      }
    }
  }

  return records;
}
