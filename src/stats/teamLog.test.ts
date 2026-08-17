import { describe, expect, it } from "vitest";
import type { PlayerMeta, Season } from "../data/types";
import { allPlayByWeek, allPlay } from "./allPlay";
import { luckIndex } from "./luckIndex";
import { teamLog, teamSeasonTotals } from "./teamLog";

const playerIndex = new Map<string, PlayerMeta>([
  ["qb1", { id: "qb1", name: "J. Allen", positions: ["QB"], team: "BUF" }],
  ["rb1", { id: "rb1", name: "B. Robinson", positions: ["RB"], team: "ATL" }],
  ["rb2", { id: "rb2", name: "K. Walker", positions: ["RB"], team: "SEA" }],
]);

function team(rosterId: number, points: number, starters: { playerId: string; points: number }[] = [], bench: { playerId: string; points: number }[] = []) {
  return { rosterId, points, starters, bench };
}

/**
 * Four teams, two weeks. Roster 1 wins a shootout in week 1, then posts the
 * second-best score in the league in week 2 and still loses — the exact case
 * the week log is meant to make visible.
 */
const season: Season = {
  leagueId: "test",
  name: "Test League",
  season: "2025",
  starterSlots: ["QB", "RB"],
  playoffWeekStart: 15,
  playoffTeams: 2,
  playoffWeeks: [],
  championRosterId: null,
  draftPicks: [],
  usesFaab: false,
  faabSpends: [],
  remainingWeeks: [],
  teams: new Map([
    [1, { rosterId: 1, ownerId: "u1", name: "Team 1" }],
    [2, { rosterId: 2, ownerId: "u2", name: "Team 2" }],
    [3, { rosterId: 3, ownerId: "u3", name: "Team 3" }],
    [4, { rosterId: 4, ownerId: "u4", name: "Team 4" }],
  ]),
  weeks: [
    {
      week: 1,
      games: [
        {
          a: team(1, 120, [
            { playerId: "qb1", points: 30 },
            { playerId: "rb1", points: 90 },
          ]),
          b: team(2, 100),
        },
        { a: team(3, 90), b: team(4, 80) },
      ],
    },
    {
      week: 2,
      games: [
        {
          // Roster 1 scores 110 — beaten only by roster 2's 130 — and loses.
          // 20 points sat on the bench: rb2 (40) outscored starter rb1 (10).
          a: team(
            1,
            110,
            [
              { playerId: "qb1", points: 100 },
              { playerId: "rb1", points: 10 },
            ],
            [{ playerId: "rb2", points: 40 }],
          ),
          b: team(2, 130),
        },
        { a: team(3, 70), b: team(4, 60) },
      ],
    },
  ],
};

describe("allPlayByWeek", () => {
  it("scores each week against every other team playing that week", () => {
    const week2 = allPlayByWeek(season).get(1)![1];
    expect(week2).toEqual({ week: 2, wins: 2, losses: 1, ties: 0 });
  });

  it("folds into the same season totals as allPlay", () => {
    const byWeek = allPlayByWeek(season);
    for (const [rosterId, total] of allPlay(season)) {
      const summed = byWeek.get(rosterId)!.reduce(
        (acc, w) => ({ wins: acc.wins + w.wins, losses: acc.losses + w.losses, ties: acc.ties + w.ties }),
        { wins: 0, losses: 0, ties: 0 },
      );
      expect(summed).toEqual(total);
    }
  });
});

describe("luckIndex", () => {
  it("carries the all-play record so callers don't recompute it", () => {
    const entry = luckIndex(season).get(1)!;
    expect(entry.allPlayRecord).toEqual(allPlay(season).get(1));
    expect(entry.allPlayWinPct).toBeCloseTo(5 / 6); // 3-0 in week 1, 2-1 in week 2
  });

  it("reports the real W-L-T alongside the tie-weighted win count", () => {
    const entry = luckIndex(season).get(1)!;
    expect(entry.record).toEqual({ wins: 1, losses: 1, ties: 0 });
    expect(entry.actualWins).toBe(1);
  });

  it("flags a team whose record trails its scoring as unlucky", () => {
    // Roster 1 beat 5 of 6 all-play opponents but split its two real games.
    const entry = luckIndex(season).get(1)!;
    expect(entry.expectedWins).toBeCloseTo((5 / 6) * 2);
    expect(entry.luck).toBeLessThan(0);
  });
});

describe("teamLog", () => {
  it("pairs each week with its opponent, result and margin", () => {
    const log = teamLog(season, 1, playerIndex);
    expect(log.map((e) => e.week)).toEqual([1, 2]);

    expect(log[0]).toMatchObject({ result: "W", opponentRosterId: 2, opponentPoints: 100, margin: 20 });
    expect(log[1]).toMatchObject({ result: "L", opponentRosterId: 2, opponentPoints: 130, margin: -20 });
  });

  it("records how the score fared against the rest of the league", () => {
    const log = teamLog(season, 1, playerIndex);
    expect(log[0]).toMatchObject({ allPlayWins: 3, allPlayGames: 3 });
    // The loss it should have won: beat two of three other teams.
    expect(log[1]).toMatchObject({ allPlayWins: 2, allPlayGames: 3 });
  });

  it("counts points left on the bench against the optimal lineup", () => {
    const log = teamLog(season, 1, playerIndex);
    expect(log[0].pointsLeftOnBench).toBe(0);
    // Starting rb2 (40) over rb1 (10) would have added 30.
    expect(log[1].optimal).toBe(140);
    expect(log[1].pointsLeftOnBench).toBe(30);
  });

  it("names the week's top starter", () => {
    const log = teamLog(season, 1, playerIndex);
    expect(log[0].topStarter).toEqual({ name: "B. Robinson", points: 90 });
    expect(log[1].topStarter).toEqual({ name: "J. Allen", points: 100 });
  });

  it("returns an empty log for a roster that never played", () => {
    expect(teamLog(season, 99, playerIndex)).toEqual([]);
  });
});

describe("teamSeasonTotals", () => {
  it("sums the log into the season KPIs", () => {
    const totals = teamSeasonTotals(teamLog(season, 1, playerIndex));

    expect(totals.pointsFor).toBe(230);
    expect(totals.pointsAgainst).toBe(230);
    expect(totals.pointsLeftOnBench).toBe(30);
    expect(totals.bestWeek).toEqual({ week: 1, points: 120 });
    expect(totals.worstWeek).toEqual({ week: 2, points: 110 });
  });

  it("leaves best/worst null when there are no completed weeks", () => {
    expect(teamSeasonTotals([])).toMatchObject({ pointsFor: 0, bestWeek: null, worstWeek: null });
  });
});
