import { describe, expect, it } from "vitest";
import { coachingEfficiency } from "./coachingEfficiency";
import type { PlayerMeta, Season } from "../data/types";

// Real week-1 data for the 2025 Moonshooters league, roster_id 1
// (BC Let's Ride): starters/players/players_points exactly as returned by
// GET /league/1257478324779753472/matchups/1. starters_points there summed
// to 104.32, matching the reported `points`.
//
// Hand-computed optimal: Purdy(QB) + Brown+Henderson(RB/RB) +
// Sutton+Lamb(WR/WR) + Goedert(TE) + Nabers(FLEX) + McLaughlin(K) +
// WAS(DEF) = 116.58 — i.e. 12.26 points better than the lineup started.
const playerIndex = new Map<string, PlayerMeta>([
  ["10229", { id: "10229", name: "Rashee Rice", positions: ["WR"], team: "KC" }],
  ["11632", { id: "11632", name: "Malik Nabers", positions: ["WR"], team: "NYG" }],
  ["12517", { id: "12517", name: "Colston Loveland", positions: ["TE"], team: "CHI" }],
  ["12529", { id: "12529", name: "TreVeyon Henderson", positions: ["RB"], team: "NE" }],
  ["5022", { id: "5022", name: "Dallas Goedert", positions: ["TE"], team: "PHI" }],
  ["5045", { id: "5045", name: "Courtland Sutton", positions: ["WR"], team: "DEN" }],
  ["5849", { id: "5849", name: "Kyler Murray", positions: ["QB"], team: "ARI" }],
  ["6650", { id: "6650", name: "Chase McLaughlin", positions: ["K"], team: "TB" }],
  ["6786", { id: "6786", name: "CeeDee Lamb", positions: ["WR"], team: "DAL" }],
  ["6790", { id: "6790", name: "D'Andre Swift", positions: ["RB"], team: "CHI" }],
  ["6801", { id: "6801", name: "Tee Higgins", positions: ["WR"], team: "CIN" }],
  ["8183", { id: "8183", name: "Brock Purdy", positions: ["QB"], team: "SF" }],
  ["8408", { id: "8408", name: "Jordan Mason", positions: ["RB"], team: "MIN" }],
  ["9224", { id: "9224", name: "Chase Brown", positions: ["RB"], team: "CIN" }],
  ["WAS", { id: "WAS", name: "Washington Commanders", positions: ["DEF"], team: "WAS" }],
]);

const season: Season = {
  leagueId: "1257478324779753472",
  name: "Moonshooters",
  season: "2025",
  starterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"],
  playoffWeekStart: 15,
  teams: new Map([[1, { rosterId: 1, ownerId: "872714529828732928", name: "BC Let's Ride" }]]),
  weeks: [
    {
      week: 1,
      games: [
        {
          a: {
            rosterId: 1,
            points: 104.32,
            starters: [
              { playerId: "5849", points: 18.32 },
              { playerId: "9224", points: 13.1 },
              { playerId: "12529", points: 11.1 },
              { playerId: "6786", points: 18.0 },
              { playerId: "11632", points: 12.1 },
              { playerId: "5022", points: 11.4 },
              { playerId: "6801", points: 6.3 },
              { playerId: "6650", points: 4.0 },
              { playerId: "WAS", points: 10.0 },
            ],
            bench: [
              { playerId: "10229", points: 0.0 },
              { playerId: "12517", points: 3.2 },
              { playerId: "5045", points: 18.1 },
              { playerId: "6790", points: 9.5 },
              { playerId: "8183", points: 18.78 },
              { playerId: "8408", points: 8.5 },
            ],
          },
          // Opponent is irrelevant to this test — coachingEfficiency scores each side independently.
          b: {
            rosterId: 2,
            points: 90,
            starters: [{ playerId: "5045", points: 18.1 }],
            bench: [],
          },
        },
      ],
    },
  ],
};

describe("coachingEfficiency against real 2025 data", () => {
  it("matches the hand-computed optimal for a real team-week", () => {
    const result = coachingEfficiency(season, playerIndex);
    const [week1] = result.get(1)!;

    expect(week1.actual).toBe(104.32);
    expect(week1.optimal).toBeCloseTo(116.58, 1);
    expect(week1.optimal - week1.actual).toBeCloseTo(12.26, 1);
  });
});

// Real week-1 data for the 2025 "2QB" (superflex) league, roster_id 1:
// GET /league/1257417786867601409/matchups/1. This manager started both
// rostered QBs (Lamar Jackson in QB, Brock Purdy in SUPER_FLEX) and, as it
// turns out, the literal optimal lineup — actual (149.04) equals optimal,
// a clean boundary case confirming SUPER_FLEX eligibility and that the
// solver never reports a lower "optimal" than what was actually scored.
const superflexPlayerIndex = new Map<string, PlayerMeta>([
  ["10229", { id: "10229", name: "Rashee Rice", positions: ["WR"], team: "KC" }],
  ["11604", { id: "11604", name: "Brock Bowers", positions: ["TE"], team: "LV" }],
  ["12501", { id: "12501", name: "Matthew Golden", positions: ["WR"], team: "GB" }],
  ["4137", { id: "4137", name: "James Conner", positions: ["RB"], team: "ARI" }],
  ["4881", { id: "4881", name: "Lamar Jackson", positions: ["QB"], team: "BAL" }],
  ["5846", { id: "5846", name: "DK Metcalf", positions: ["WR"], team: "PIT" }],
  ["5850", { id: "5850", name: "Josh Jacobs", positions: ["RB"], team: "GB" }],
  ["6650", { id: "6650", name: "Chase McLaughlin", positions: ["K"], team: "TB" }],
  ["6783", { id: "6783", name: "Jerry Jeudy", positions: ["WR"], team: "CLE" }],
  ["6790", { id: "6790", name: "D'Andre Swift", positions: ["RB"], team: "CHI" }],
  ["6813", { id: "6813", name: "Jonathan Taylor", positions: ["RB"], team: "IND" }],
  ["8137", { id: "8137", name: "George Pickens", positions: ["WR"], team: "DAL" }],
  ["8183", { id: "8183", name: "Brock Purdy", positions: ["QB"], team: "SF" }],
  ["9493", { id: "9493", name: "Puka Nacua", positions: ["WR"], team: "LAR" }],
  ["ARI", { id: "ARI", name: "Arizona Cardinals", positions: ["DEF"], team: "ARI" }],
]);

const superflexSeason: Season = {
  leagueId: "1257417786867601409",
  name: "2QB",
  season: "2025",
  starterSlots: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX", "K", "DEF"],
  playoffWeekStart: 15,
  teams: new Map([[1, { rosterId: 1, ownerId: "unknown", name: "Roster 1" }]]),
  weeks: [
    {
      week: 1,
      games: [
        {
          a: {
            rosterId: 1,
            points: 149.04,
            starters: [
              { playerId: "4881", points: 29.36 },
              { playerId: "5850", points: 14.0 },
              { playerId: "6813", points: 12.8 },
              { playerId: "9493", points: 23.1 },
              { playerId: "5846", points: 12.3 },
              { playerId: "11604", points: 15.3 },
              { playerId: "4137", points: 14.4 },
              { playerId: "8183", points: 18.78 },
              { playerId: "6650", points: 4.0 },
              { playerId: "ARI", points: 5.0 },
            ],
            bench: [
              { playerId: "10229", points: 0.0 },
              { playerId: "12501", points: 3.6 },
              { playerId: "6783", points: 11.6 },
              { playerId: "6790", points: 9.5 },
              { playerId: "8137", points: 6.0 },
            ],
          },
          b: {
            rosterId: 2,
            points: 112.66,
            starters: [{ playerId: "10229", points: 0.0 }],
            bench: [],
          },
        },
      ],
    },
  ],
};

describe("coachingEfficiency SUPER_FLEX against real 2025 data", () => {
  it("uses both rostered QBs and matches actual exactly when the lineup was already optimal", () => {
    const result = coachingEfficiency(superflexSeason, superflexPlayerIndex);
    const [week1] = result.get(1)!;

    expect(week1.actual).toBe(149.04);
    expect(week1.optimal).toBeCloseTo(149.04, 1);
  });
});
