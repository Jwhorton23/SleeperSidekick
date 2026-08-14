import { describe, expect, it } from "vitest";
import { simulatePlayoffOdds } from "./playoffOdds";
import type { Season } from "../data/types";

function teamWeek(rosterId: number, points: number) {
  return { rosterId, points, starters: [], bench: [] };
}

function playedWeek(week: number, aId: number, aPts: number, bId: number, bPts: number) {
  return { week, games: [{ a: teamWeek(aId, aPts), b: teamWeek(bId, bPts) }] };
}

describe("simulatePlayoffOdds", () => {
  it("gives 100% to a mathematically clinched team and 0% to an eliminated one", () => {
    // Team 1 has already won 3 of 3 played games; team 2 has lost all 3.
    // One game remains. Even in the best case for team 2 (it wins) and
    // worst case for team 1 (it loses), team 1 still has >= 3 wins and
    // team 2 has <= 1 — with only one playoff spot, team 1 can never miss
    // it and team 2 can never take it, regardless of how the remaining
    // game's scores are sampled.
    const season: Season = {
      leagueId: "test",
      name: "Test League",
      season: "2025",
      starterSlots: [],
      playoffWeekStart: 15,
      playoffTeams: 1,
      playoffWeeks: [],
      championRosterId: null,
      teams: new Map([
        [1, { rosterId: 1, ownerId: "u1", name: "Team 1" }],
        [2, { rosterId: 2, ownerId: "u2", name: "Team 2" }],
      ]),
      weeks: [playedWeek(1, 1, 150, 2, 100), playedWeek(2, 1, 150, 2, 100), playedWeek(3, 1, 150, 2, 100)],
      remainingWeeks: [{ week: 4, matchups: [{ rosterIdA: 1, rosterIdB: 2 }] }],
    };

    const results = simulatePlayoffOdds(season, { simulations: 500 });
    const team1 = results.find((r) => r.rosterId === 1)!;
    const team2 = results.find((r) => r.rosterId === 2)!;

    expect(team1.playoffPct).toBe(100);
    expect(team2.playoffPct).toBe(0);
  });

  it("with no remaining schedule, returns the actual final standing as a deterministic 100/0 split", () => {
    const season: Season = {
      leagueId: "test",
      name: "Test League",
      season: "2025",
      starterSlots: [],
      playoffWeekStart: 15,
      playoffTeams: 1,
      playoffWeeks: [],
      championRosterId: null,
      teams: new Map([
        [1, { rosterId: 1, ownerId: "u1", name: "Team 1" }],
        [2, { rosterId: 2, ownerId: "u2", name: "Team 2" }],
      ]),
      weeks: [playedWeek(1, 1, 150, 2, 100)],
      remainingWeeks: [],
    };

    const results = simulatePlayoffOdds(season);
    expect(results.find((r) => r.rosterId === 1)!.playoffPct).toBe(100);
    expect(results.find((r) => r.rosterId === 2)!.playoffPct).toBe(0);
  });

  it("across many simulations, playoff percentages sum to playoffTeams * 100 (exactly playoffTeams teams make it every sim)", () => {
    const season: Season = {
      leagueId: "test",
      name: "Test League",
      season: "2025",
      starterSlots: [],
      playoffWeekStart: 15,
      playoffTeams: 2,
      playoffWeeks: [],
      championRosterId: null,
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
            { a: teamWeek(1, 110), b: teamWeek(2, 100) },
            { a: teamWeek(3, 95), b: teamWeek(4, 105) },
          ],
        },
        {
          week: 2,
          games: [
            { a: teamWeek(1, 90), b: teamWeek(3, 100) },
            { a: teamWeek(2, 120), b: teamWeek(4, 80) },
          ],
        },
      ],
      remainingWeeks: [
        {
          week: 3,
          matchups: [
            { rosterIdA: 1, rosterIdB: 4 },
            { rosterIdA: 2, rosterIdB: 3 },
          ],
        },
      ],
    };

    const results = simulatePlayoffOdds(season, { simulations: 2000 });
    const total = results.reduce((sum, r) => sum + r.playoffPct, 0);
    expect(total).toBeCloseTo(200, 0); // playoffTeams(2) * 100
  });
});
