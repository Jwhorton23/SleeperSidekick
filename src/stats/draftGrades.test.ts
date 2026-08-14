import { describe, expect, it } from "vitest";
import { careerDraftHitRates, gradeDraftPicks } from "./draftGrades";
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

    expect(rates.get("u1")).toEqual({ totalPicks: 1, hits: 0, hitRate: 0 });
    expect(rates.get("u2")).toEqual({ totalPicks: 1, hits: 1, hitRate: 1 });
    expect(rates.get("u3")).toEqual({ totalPicks: 1, hits: 0, hitRate: 0 });
    expect(rates.get("u4")).toEqual({ totalPicks: 1, hits: 1, hitRate: 1 });
  });
});
