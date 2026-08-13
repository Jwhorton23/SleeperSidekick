import { describe, expect, it } from "vitest";
import { optimalLineupPoints } from "./lineup";
import type { LineupCandidate } from "./lineup";

describe("optimalLineupPoints", () => {
  it("fills a simple single-position slot with the highest scorer", () => {
    const candidates: LineupCandidate[] = [
      { playerId: "a", points: 10, positions: ["QB"] },
      { playerId: "b", points: 25, positions: ["QB"] },
    ];
    expect(optimalLineupPoints(["QB"], candidates)).toBe(25);
  });

  it("assigns FLEX-eligible players to maximize total, not greedily", () => {
    // A greedy fill (RB slot first, taking the best RB) would strand the
    // second RB on the bench even though FLEX could hold it instead.
    const candidates: LineupCandidate[] = [
      { playerId: "rb1", points: 20, positions: ["RB"] },
      { playerId: "rb2", points: 18, positions: ["RB"] },
      { playerId: "wr1", points: 15, positions: ["WR"] },
    ];
    expect(optimalLineupPoints(["RB", "FLEX"], candidates)).toBe(20 + 18);
  });

  it("handles SUPER_FLEX by allowing a second QB to start over a lesser skill player", () => {
    const candidates: LineupCandidate[] = [
      { playerId: "qb1", points: 30, positions: ["QB"] },
      { playerId: "qb2", points: 22, positions: ["QB"] },
      { playerId: "wr1", points: 12, positions: ["WR"] },
    ];
    expect(optimalLineupPoints(["QB", "SUPER_FLEX"], candidates)).toBe(30 + 22);
  });

  it("leaves a slot empty when no eligible player exists", () => {
    const candidates: LineupCandidate[] = [{ playerId: "wr1", points: 12, positions: ["WR"] }];
    expect(optimalLineupPoints(["QB", "WR"], candidates)).toBe(12);
  });

  it("never double-books a multi-eligible player across two slots", () => {
    const candidates: LineupCandidate[] = [{ playerId: "rb1", points: 20, positions: ["RB"] }];
    // Only one real player, but two slots that could both accept them.
    expect(optimalLineupPoints(["RB", "FLEX"], candidates)).toBe(20);
  });
});
