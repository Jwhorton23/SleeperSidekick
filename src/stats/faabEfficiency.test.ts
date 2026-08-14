import { describe, expect, it } from "vitest";
import { faabEfficiency } from "./faabEfficiency";
import type { Season } from "../data/types";

function teamWeek(rosterId: number, playerId: string, points: number) {
  return { rosterId, points, starters: [{ playerId, points }], bench: [] };
}

describe("faabEfficiency", () => {
  it("only counts points scored after the claim, by the acquiring roster", () => {
    const season: Season = {
      leagueId: "test",
      name: "Test League",
      season: "2025",
      starterSlots: [],
      playoffWeekStart: 15,
      playoffTeams: 2,
      teams: new Map([[1, { rosterId: 1, ownerId: "u1", name: "Team 1" }]]),
      remainingWeeks: [],
      championRosterId: null,
      draftPicks: [],
      usesFaab: true,
      // Roster 1 spent $20 on player "P" in week 2.
      faabSpends: [{ playerId: "P", rosterId: 1, amount: 20, week: 2 }],
      weeks: [
        // Week 1 (before the claim): P scores for roster 1 anyway (e.g. a
        // teammate had the same id coincidentally, or P was on waivers —
        // shouldn't count regardless of how it happened, since it predates the spend.
        { week: 1, games: [{ a: teamWeek(1, "P", 999), b: teamWeek(2, "other", 0) }] },
        // Week 2 is the claim week itself — still shouldn't count.
        { week: 2, games: [{ a: teamWeek(1, "P", 500), b: teamWeek(2, "other", 0) }] },
        // Weeks 3 and 4: these are the real payoff.
        { week: 3, games: [{ a: teamWeek(1, "P", 15), b: teamWeek(2, "other", 0) }] },
        { week: 4, games: [{ a: teamWeek(1, "P", 25), b: teamWeek(2, "other", 0) }] },
      ],
      playoffWeeks: [],
    };

    const result = faabEfficiency(season);
    const entry = result.get(1)!;

    expect(entry.totalSpent).toBe(20);
    expect(entry.totalPointsGained).toBe(40); // only weeks 3 + 4
    expect(entry.pointsPerDollar).toBe(2);
  });

  it("stops counting once the player leaves that roster", () => {
    const season: Season = {
      leagueId: "test",
      name: "Test League",
      season: "2025",
      starterSlots: [],
      playoffWeekStart: 15,
      playoffTeams: 2,
      teams: new Map([
        [1, { rosterId: 1, ownerId: "u1", name: "Team 1" }],
        [2, { rosterId: 2, ownerId: "u2", name: "Team 2" }],
      ]),
      remainingWeeks: [],
      championRosterId: null,
      draftPicks: [],
      usesFaab: true,
      faabSpends: [{ playerId: "P", rosterId: 1, amount: 10, week: 1 }],
      weeks: [
        { week: 2, games: [{ a: teamWeek(1, "P", 30), b: teamWeek(2, "other", 0) }] },
        // By week 3, P is on roster 2 instead (traded/dropped+claimed) —
        // roster 1 shouldn't get credit for points scored elsewhere.
        { week: 3, games: [{ a: teamWeek(2, "P", 50), b: teamWeek(1, "other", 0) }] },
      ],
      playoffWeeks: [],
    };

    const result = faabEfficiency(season);
    expect(result.get(1)!.totalPointsGained).toBe(30);
  });
});
