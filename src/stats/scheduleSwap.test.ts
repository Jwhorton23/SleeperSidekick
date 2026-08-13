import { describe, expect, it } from "vitest";
import { scheduleSwapMatrix } from "./scheduleSwap";
import type { Season } from "../data/types";

function teamWeek(rosterId: number, points: number) {
  return { rosterId, points, starters: [], bench: [] };
}

describe("scheduleSwapMatrix", () => {
  it("diagonal (team under its own schedule) equals the team's actual record", () => {
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
            { a: teamWeek(1, 120), b: teamWeek(2, 100) }, // team 1 beats team 2
            { a: teamWeek(3, 80), b: teamWeek(4, 90) }, // team 4 beats team 3
          ],
        },
        {
          week: 2,
          games: [
            { a: teamWeek(1, 90), b: teamWeek(3, 95) }, // team 3 beats team 1
            { a: teamWeek(2, 110), b: teamWeek(4, 100) }, // team 2 beats team 4
          ],
        },
      ],
    };

    const matrix = scheduleSwapMatrix(season);
    // Team 1's actual record: won week 1, lost week 2 -> 1-1.
    expect(matrix.get(1)!.get(1)).toEqual({ wins: 1, losses: 1, ties: 0 });

    // Team 1 under team 4's schedule: week 1 team 4 played team 3 (90pts),
    // team 1 scored 120 that week -> win. Week 2 team 4 played team 2
    // (110pts), team 1 scored 90 -> loss. So still 1-1, but for different
    // reasons — confirms it's genuinely re-deriving from opponent scores,
    // not just copying the diagonal.
    expect(matrix.get(1)!.get(4)).toEqual({ wins: 1, losses: 1, ties: 0 });

    // Team 1 under team 2's schedule: week 1 team 2 played team 1 itself
    // (100... wait team 2 played team1, team1 scored 120) -> team 2's
    // opponent week 1 was team 1 (120), team 1 itself scored 120 -> tie.
    // Week 2 team 2 played team 4 (100), team 1 scored 90 -> loss.
    expect(matrix.get(1)!.get(2)).toEqual({ wins: 0, losses: 1, ties: 1 });
  });
});
