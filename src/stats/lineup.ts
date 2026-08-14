import type { Slot } from "../data/types";

const ELIGIBILITY: Record<string, ReadonlySet<string>> = {
  QB: new Set(["QB"]),
  RB: new Set(["RB"]),
  WR: new Set(["WR"]),
  TE: new Set(["TE"]),
  K: new Set(["K"]),
  DEF: new Set(["DEF"]),
  FLEX: new Set(["RB", "WR", "TE"]),
  SUPER_FLEX: new Set(["QB", "RB", "WR", "TE"]),
  WRRB_FLEX: new Set(["RB", "WR"]),
  REC_FLEX: new Set(["WR", "TE"]),
};

export interface LineupCandidate {
  playerId: string;
  points: number;
  positions: string[];
}

/**
 * Exact optimal lineup total via subset-DP (an assignment problem: each
 * slot gets at most one player, each player fills at most one slot,
 * maximize total points). A naive slot-by-slot backtracking search is
 * O(candidates!) and blows up well within a 16-man bench; this DP is
 * O(slots * 2^candidates), which is fast for realistic roster sizes
 * (comfortably under a few million ops for a 16-man roster).
 */
export function optimalLineupPoints(starterSlots: Slot[], candidates: LineupCandidate[]): number {
  const eligibleMaskForSlot = starterSlots.map((slot) => {
    const eligible = ELIGIBILITY[slot] ?? new Set([slot]);
    let mask = 0;
    candidates.forEach((c, i) => {
      if (c.positions.some((p) => eligible.has(p))) mask |= 1 << i;
    });
    return mask;
  });

  // dp maps "set of players used" -> max points achievable with that set.
  let dp = new Map<number, number>([[0, 0]]);

  for (const slotMask of eligibleMaskForSlot) {
    const next = new Map<number, number>();
    for (const [usedMask, total] of dp) {
      // Leave the slot empty (not enough eligible players left).
      const keep = next.get(usedMask);
      if (keep === undefined || keep < total) next.set(usedMask, total);

      let remaining = slotMask & ~usedMask;
      while (remaining !== 0) {
        const bit = remaining & -remaining;
        const i = Math.log2(bit) | 0;
        remaining ^= bit;

        const newMask = usedMask | bit;
        const newTotal = total + candidates[i].points;
        const existing = next.get(newMask);
        if (existing === undefined || existing < newTotal) next.set(newMask, newTotal);
      }
    }
    dp = next;
  }

  let best = 0;
  for (const total of dp.values()) best = Math.max(best, total);
  return best;
}
