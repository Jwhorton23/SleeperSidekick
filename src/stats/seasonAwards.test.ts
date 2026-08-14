import { describe, expect, it } from "vitest";
import { seasonAwards } from "./seasonAwards";
import type { PlayerMeta, Season } from "../data/types";

function teamWeek(rosterId: number, points: number, starterId: string, bench: { playerId: string; points: number }[] = []) {
  return { rosterId, points, starters: [{ playerId: starterId, points }], bench };
}

const playerIndex = new Map<string, PlayerMeta>(
  ["q1", "q2", "q3", "q4", "bench4"].map((id) => [id, { id, name: id, positions: ["QB"], team: null }]),
);

// 4 teams, single-QB lineups. u4 benches a QB who outscores their starter
// in week 1 (a clear coaching-efficiency mistake); the other three always
// start their only option, so they have zero points left on the bench.
// Scores are set up so u3 is the luckiest team (2-0 actual record despite
// a middling all-play record) and u2 the unluckiest (1-1 actual despite
// the best all-play record).
const season: Season = {
  leagueId: "test",
  name: "Test League",
  season: "2025",
  starterSlots: ["QB"],
  playoffWeekStart: 15,
  playoffTeams: 2,
  teams: new Map([
    [1, { rosterId: 1, ownerId: "u1", name: "Team 1" }],
    [2, { rosterId: 2, ownerId: "u2", name: "Team 2" }],
    [3, { rosterId: 3, ownerId: "u3", name: "Team 3" }],
    [4, { rosterId: 4, ownerId: "u4", name: "Team 4" }],
  ]),
  remainingWeeks: [],
  playoffWeeks: [],
  championRosterId: null,
  draftPicks: [], // no draft data -> "Sharpest GM" should be omitted
  usesFaab: false, // no FAAB -> "Waiver Wire Wizard" should be omitted
  faabSpends: [],
  weeks: [
    {
      week: 1,
      games: [
        { a: teamWeek(1, 150, "q1"), b: teamWeek(2, 100, "q2") },
        { a: teamWeek(3, 90, "q3"), b: teamWeek(4, 80, "q4", [{ playerId: "bench4", points: 150 }]) },
      ],
    },
    {
      week: 2,
      games: [
        { a: teamWeek(1, 90, "q1"), b: teamWeek(3, 100, "q3") },
        { a: teamWeek(2, 120, "q2"), b: teamWeek(4, 70, "q4") },
      ],
    },
  ],
};

describe("seasonAwards", () => {
  it("assigns each award to the correct manager and omits awards with no data", () => {
    const awards = seasonAwards(season, playerIndex);
    const byKey = new Map(awards.map((a) => [a.key, a]));

    expect(byKey.get("sleeps-at-the-wheel")?.userId).toBe("u4");
    expect(byKey.get("luckiest")?.userId).toBe("u3");
    expect(byKey.get("snake-bit")?.userId).toBe("u2");

    // No draft or FAAB data in this season -> these awards shouldn't appear.
    expect(byKey.has("sharpest-gm")).toBe(false);
    expect(byKey.has("waiver-wizard")).toBe(false);
  });
});
