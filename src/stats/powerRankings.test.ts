import { describe, expect, it } from "vitest";
import { powerRankings } from "./powerRankings";
import type { Season } from "../data/types";

function teamWeek(rosterId: number, points: number) {
  return { rosterId, points, starters: [], bench: [] };
}

describe("powerRankings", () => {
  it("ranks recent blowouts above identical-margin blowouts from early in the season", () => {
    // Team 1 crushed team 3 in week 1 then faded (lost close in week 2).
    // Team 2 struggled in week 1 then crushed team 4 in week 2 by the same
    // margin team 1 won by. Same season-long point totals for 1 vs 2, but
    // team 2's strong performance is more recent, so it should rank higher.
    const season: Season = {
      leagueId: "test",
      name: "Test League",
      season: "2025",
      starterSlots: [],
      playoffWeekStart: 15,
      playoffTeams: 4,
      teams: new Map([
        [1, { rosterId: 1, ownerId: "u1", name: "Team 1" }],
        [2, { rosterId: 2, ownerId: "u2", name: "Team 2" }],
        [3, { rosterId: 3, ownerId: "u3", name: "Team 3" }],
        [4, { rosterId: 4, ownerId: "u4", name: "Team 4" }],
      ]),
      remainingWeeks: [],
      weeks: [
        {
          week: 1,
          games: [
            { a: teamWeek(1, 150), b: teamWeek(3, 100) }, // team 1 wins by 50
            { a: teamWeek(2, 90), b: teamWeek(4, 100) }, // team 2 loses by 10
          ],
        },
        {
          week: 2,
          games: [
            { a: teamWeek(1, 95), b: teamWeek(4, 100) }, // team 1 loses by 5
            { a: teamWeek(2, 150), b: teamWeek(3, 100) }, // team 2 wins by 50
          ],
        },
      ],
    };

    const rankings = powerRankings(season);
    const team1 = rankings.find((r) => r.rosterId === 1)!;
    const team2 = rankings.find((r) => r.rosterId === 2)!;

    expect(team2.rank).toBeLessThan(team1.rank);
    expect(team2.score).toBeGreaterThan(team1.score);
  });

  it("assigns ranks 1..N with no gaps or ties in rank order", () => {
    const season: Season = {
      leagueId: "test",
      name: "Test League",
      season: "2025",
      starterSlots: [],
      playoffWeekStart: 15,
      playoffTeams: 4,
      teams: new Map([
        [1, { rosterId: 1, ownerId: "u1", name: "Team 1" }],
        [2, { rosterId: 2, ownerId: "u2", name: "Team 2" }],
      ]),
      remainingWeeks: [],
      weeks: [{ week: 1, games: [{ a: teamWeek(1, 120), b: teamWeek(2, 100) }] }],
    };

    const rankings = powerRankings(season);
    expect(rankings.map((r) => r.rank)).toEqual([1, 2]);
    expect(rankings[0].rosterId).toBe(1);
  });
});
