import { describe, expect, it } from "vitest";
import { rankBy, teamSummaries, type TeamSummary } from "./teamSummary";
import type { Season } from "../data/types";

function teamWeek(rosterId: number, points: number) {
  return { rosterId, points, starters: [], bench: [] };
}

/** Four teams, two weeks. Team 1 wins both, team 4 loses both. */
function season(): Season {
  return {
    leagueId: "test",
    name: "Test League",
    season: "2025",
    starterSlots: [],
    playoffWeekStart: 15,
    playoffTeams: 4,
    playoffWeeks: [],
    championRosterId: null,
    draftPicks: [],
    usesFaab: false,
    faabSpends: [],
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
          { a: teamWeek(1, 150), b: teamWeek(4, 100) },
          { a: teamWeek(2, 120), b: teamWeek(3, 110) },
        ],
      },
      {
        week: 2,
        games: [
          { a: teamWeek(1, 130), b: teamWeek(3, 125) },
          { a: teamWeek(2, 90), b: teamWeek(4, 95) },
        ],
      },
    ],
  };
}

describe("teamSummaries", () => {
  it("returns teams in power-ranking order, strongest first", () => {
    const summaries = teamSummaries(season(), new Map());

    expect(summaries.map((s) => s.powerRank)).toEqual([1, 2, 3, 4]);
    // Team 1 won both games, so it leads; team 4's only win was by 5.
    expect(summaries[0].rosterId).toBe(1);
  });

  it("totals points for and against from both sides of every game", () => {
    const summaries = teamSummaries(season(), new Map());
    const team1 = summaries.find((s) => s.rosterId === 1)!;

    expect(team1.pointsFor).toBe(280); // 150 + 130
    expect(team1.pointsAgainst).toBe(225); // 100 + 125
    expect(team1.record).toEqual({ wins: 2, losses: 0, ties: 0 });
  });

  it("picks the high and low week off the same log the totals come from", () => {
    const summaries = teamSummaries(season(), new Map());
    const team4 = summaries.find((s) => s.rosterId === 4)!;

    expect(team4.bestWeek).toEqual({ week: 1, points: 100 });
    expect(team4.worstWeek).toEqual({ week: 2, points: 95 });
  });

  it("reports the schedule swing as the kindest and cruelest win totals", () => {
    const summaries = teamSummaries(season(), new Map());

    for (const summary of summaries) {
      expect(summary.bestScheduleWins).toBeGreaterThanOrEqual(summary.worstScheduleWins);
      expect(summary.bestScheduleWins).toBeLessThanOrEqual(summary.gamesPlayed);
    }
  });

  it("has no weeks to summarize before the season starts", () => {
    const preseason = { ...season(), weeks: [] };
    const summaries = teamSummaries(preseason, new Map());

    expect(summaries).toHaveLength(4);
    expect(summaries.every((s) => s.gamesPlayed === 0 && s.bestWeek === null)).toBe(true);
  });
});

describe("rankBy", () => {
  const rows = [
    { rosterId: 1, pointsFor: 300 },
    { rosterId: 2, pointsFor: 200 },
    { rosterId: 3, pointsFor: 300 },
    { rosterId: 4, pointsFor: 100 },
  ] as TeamSummary[];

  it("ranks the highest value first by default", () => {
    const ranks = rankBy(rows, (s) => s.pointsFor);
    expect(ranks.get(4)).toBe(4);
  });

  it("ranks the lowest value first when lower is better", () => {
    const ranks = rankBy(rows, (s) => s.pointsFor, false);
    expect(ranks.get(4)).toBe(1);
  });

  it("gives tied teams the same place and skips the gap after them", () => {
    const ranks = rankBy(rows, (s) => s.pointsFor);

    expect(ranks.get(1)).toBe(1);
    expect(ranks.get(3)).toBe(1);
    // Two teams sit in first, so the next one down is third, not second.
    expect(ranks.get(2)).toBe(3);
    expect(ranks.get(4)).toBe(4);
  });
});
