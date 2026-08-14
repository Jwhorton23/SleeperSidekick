import { describe, expect, it } from "vitest";
import { careerRecords, headToHeadMatrix } from "./careerRecords";
import type { LeagueData, Season } from "../data/types";

function teamWeek(rosterId: number, points: number) {
  return { rosterId, points, starters: [], bench: [] };
}

// Deliberately swaps roster_id assignments between seasons (roster 1 is u1
// in 2024 but u2 in 2025) — this is realistic (Sleeper reassigns roster_id
// each season) and catches any code that resolves owners with a stale or
// season-agnostic mapping instead of each season's own teams map.
const season2024: Season = {
  leagueId: "L2024",
  name: "Test League",
  season: "2024",
  starterSlots: [],
  playoffWeekStart: 15,
  playoffTeams: 2,
  teams: new Map([
    [1, { rosterId: 1, ownerId: "u1", name: "Team A" }],
    [2, { rosterId: 2, ownerId: "u2", name: "Team B" }],
  ]),
  weeks: [
    { week: 1, games: [{ a: teamWeek(1, 120), b: teamWeek(2, 100) }] },
    { week: 2, games: [{ a: teamWeek(1, 110), b: teamWeek(2, 100) }] },
  ],
  remainingWeeks: [],
  playoffWeeks: [],
  championRosterId: 1, // u1 won the 2024 title
  draftPicks: [],
  usesFaab: false,
  faabSpends: [],
};

const season2025: Season = {
  leagueId: "L2025",
  name: "Test League",
  season: "2025",
  starterSlots: [],
  playoffWeekStart: 15,
  playoffTeams: 2,
  teams: new Map([
    [1, { rosterId: 1, ownerId: "u2", name: "Team A" }], // roster 1 is now u2
    [2, { rosterId: 2, ownerId: "u1", name: "Team B" }], // roster 2 is now u1
  ]),
  weeks: [
    { week: 1, games: [{ a: teamWeek(2, 130), b: teamWeek(1, 100) }] }, // u1 beats u2 again
    { week: 2, games: [{ a: teamWeek(2, 90), b: teamWeek(1, 120) }] }, // u2 beats u1
  ],
  remainingWeeks: [],
  playoffWeeks: [],
  championRosterId: 1, // roster 1 this season is u2 — tests season-scoped resolution
  draftPicks: [],
  usesFaab: false,
  faabSpends: [],
};

const leagueData: LeagueData = {
  managers: new Map([
    ["u1", { userId: "u1", displayName: "Manager One", avatar: null }],
    ["u2", { userId: "u2", displayName: "Manager Two", avatar: null }],
  ]),
  seasons: [season2025, season2024], // newest first, per the contract
};

describe("careerRecords", () => {
  it("aggregates career points, seasons played, and championships with season-scoped roster resolution", () => {
    const records = careerRecords(leagueData);
    const u1 = records.get("u1")!;
    const u2 = records.get("u2")!;

    expect(u1.careerPoints).toBeCloseTo(120 + 110 + 130 + 90, 5);
    expect(u2.careerPoints).toBeCloseTo(100 + 100 + 100 + 120, 5);

    expect(u1.seasonsPlayed).toEqual(["2024", "2025"]);
    expect(u2.seasonsPlayed).toEqual(["2024", "2025"]);

    // 2024's champion (roster 1) was u1; 2025's champion (also roster 1,
    // but reassigned) was u2 — proves the resolution isn't using a stale mapping.
    expect(u1.championships).toEqual(["2024"]);
    expect(u2.championships).toEqual(["2025"]);
  });

  it("tracks win/loss streaks continuously across a season boundary", () => {
    const records = careerRecords(leagueData);
    const u1 = records.get("u1")!;
    const u2 = records.get("u2")!;

    // u1 wins 2024wk1, 2024wk2, 2025wk1 (three straight across the season
    // boundary) before losing 2025wk2.
    expect(u1.longestWinStreak).toBe(3);
    expect(u1.longestLossStreak).toBe(1);

    // u2 mirrors this: three straight losses, then a win.
    expect(u2.longestLossStreak).toBe(3);
    expect(u2.longestWinStreak).toBe(1);
  });
});

describe("headToHeadMatrix", () => {
  it("aggregates head-to-head record across all seasons, keyed by manager not roster", () => {
    const matrix = headToHeadMatrix(leagueData);

    expect(matrix.get("u1")!.get("u2")).toEqual({ wins: 3, losses: 1, ties: 0 });
    expect(matrix.get("u2")!.get("u1")).toEqual({ wins: 1, losses: 3, ties: 0 });
  });
});
