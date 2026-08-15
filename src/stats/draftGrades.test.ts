import { describe, expect, it } from "vitest";
import { careerDraftHitRates, careerDraftPickGrades, gradeDraftPicks, pickRankGain } from "./draftGrades";
import type { LeagueData, Season } from "../data/types";

// Four RBs drafted in order A, B, C, D (picks 1-4), but B and D outscored
// the players taken ahead of them — a classic "reached too early" pattern.
// Finish order by points: B(150) > D(120) > A(100) > C(80).
const season: Season = {
  leagueId: "test",
  name: "Test League",
  season: "2025",
  starterSlots: [],
  playoffWeekStart: 15,
  playoffTeams: 2,
  teams: new Map([
    [1, { rosterId: 1, ownerId: "u1", name: "Team 1" }],
    [2, { rosterId: 2, ownerId: "u3", name: "Team 3" }],
  ]),
  remainingWeeks: [],
  playoffWeeks: [],
  championRosterId: null,
  usesFaab: false,
  faabSpends: [],
  draftPicks: [
    { round: 1, pickNo: 1, playerId: "A", position: "RB", pickedByUserId: "u1" },
    { round: 1, pickNo: 2, playerId: "B", position: "RB", pickedByUserId: "u2" },
    { round: 1, pickNo: 3, playerId: "C", position: "RB", pickedByUserId: "u3" },
    { round: 1, pickNo: 4, playerId: "D", position: "RB", pickedByUserId: "u4" },
  ],
  weeks: [
    {
      week: 1,
      games: [
        {
          a: {
            rosterId: 1,
            points: 250,
            starters: [
              { playerId: "A", points: 100 },
              { playerId: "B", points: 150 },
            ],
            bench: [],
          },
          b: {
            rosterId: 2,
            points: 200,
            starters: [
              { playerId: "C", points: 80 },
              { playerId: "D", points: 120 },
            ],
            bench: [],
          },
        },
      ],
    },
  ],
};

describe("gradeDraftPicks", () => {
  it("grades each pick against same-position draft peers by season points", () => {
    const grades = gradeDraftPicks(season);
    const byPlayer = new Map(grades.map((g) => [g.pick.playerId, g]));

    expect(byPlayer.get("A")!.isHit).toBe(false); // drafted 1st RB, finished 3rd
    expect(byPlayer.get("B")!.isHit).toBe(true); // drafted 2nd RB, finished 1st
    expect(byPlayer.get("C")!.isHit).toBe(false); // drafted 3rd RB, finished 4th
    expect(byPlayer.get("D")!.isHit).toBe(true); // drafted 4th RB, finished 2nd

    expect(byPlayer.get("B")!.positionalFinishRank).toBe(1);
    expect(byPlayer.get("A")!.positionalFinishRank).toBe(3);
  });
});

describe("careerDraftHitRates", () => {
  it("aggregates hit rate per manager across seasons", () => {
    const leagueData: LeagueData = {
      managers: new Map(),
      seasons: [season],
    };
    const rates = careerDraftHitRates(leagueData);

    expect(rates.get("u1")).toMatchObject({ totalPicks: 1, hits: 0, hitRate: 0 });
    expect(rates.get("u2")).toMatchObject({ totalPicks: 1, hits: 1, hitRate: 1 });
    expect(rates.get("u3")).toMatchObject({ totalPicks: 1, hits: 0, hitRate: 0 });
    expect(rates.get("u4")).toMatchObject({ totalPicks: 1, hits: 1, hitRate: 1 });
  });

  it("sums picks across every season a manager drafted in", () => {
    // Same four picks in a second season, but u1 now owns every slot.
    const secondSeason: Season = {
      ...season,
      season: "2024",
      draftPicks: season.draftPicks.map((pick) => ({ ...pick, pickedByUserId: "u1" })),
    };
    const rates = careerDraftHitRates({ managers: new Map(), seasons: [season, secondSeason] });

    // 1 pick in 2025 (a miss) + 4 picks in 2024 (B and D hit).
    expect(rates.get("u1")).toMatchObject({ totalPicks: 5, hits: 2 });
    expect(rates.get("u1")!.hitRate).toBeCloseTo(2 / 5);
    expect(rates.get("u2")).toMatchObject({ totalPicks: 1, hits: 1 });
  });

  it("reports the picks that beat and missed their draft slot by the most", () => {
    const allOneManager: Season = {
      ...season,
      draftPicks: season.draftPicks.map((pick) => ({ ...pick, pickedByUserId: "u1" })),
    };
    const rate = careerDraftHitRates({ managers: new Map(), seasons: [allOneManager] }).get("u1")!;

    // D was the 4th RB taken and finished 2nd: a gain of 2, the best swing.
    expect(rate.bestPick!.grade.pick.playerId).toBe("D");
    expect(pickRankGain(rate.bestPick!.grade)).toBe(2);
    expect(rate.bestPick!.season).toBe("2025");

    // A was taken 1st and finished 3rd: a loss of 2, the worst.
    expect(rate.worstPick!.grade.pick.playerId).toBe("A");
    expect(pickRankGain(rate.worstPick!.grade)).toBe(-2);
  });

  it("leaves best/worst null for a manager with no picks", () => {
    const rates = careerDraftHitRates({ managers: new Map(), seasons: [] });
    expect(rates.size).toBe(0);
  });
});

describe("careerDraftPickGrades", () => {
  it("groups every graded pick under the manager who made it", () => {
    const picks = careerDraftPickGrades({ managers: new Map(), seasons: [season] });

    expect(picks.get("u1")!.map((p) => p.grade.pick.playerId)).toEqual(["A"]);
    expect(picks.get("u4")![0].grade.isHit).toBe(true);
    expect(picks.get("u4")![0].season).toBe("2025");
  });

  it("skips picks with no manager attached", () => {
    const unclaimed: Season = {
      ...season,
      draftPicks: [{ round: 1, pickNo: 1, playerId: "A", position: "RB", pickedByUserId: "" }],
    };
    const picks = careerDraftPickGrades({ managers: new Map(), seasons: [unclaimed] });
    expect(picks.size).toBe(0);
  });
});
