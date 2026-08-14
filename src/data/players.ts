import type { PlayerMeta } from "./types";

let cached: Promise<Map<string, PlayerMeta>> | null = null;

/** Loads public/players.json once per page load; the browser's own HTTP
 * cache handles repeat visits (PLAN.md §7/§8 — this is a static asset,
 * not a Sleeper API call, so it doesn't go through src/api/cache.ts). */
export function loadPlayerIndex(): Promise<Map<string, PlayerMeta>> {
  if (!cached) {
    cached = fetch(`${import.meta.env.BASE_URL}players.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load players.json (${res.status})`);
        return res.json() as Promise<Record<string, PlayerMeta>>;
      })
      .then((raw) => new Map(Object.entries(raw)));
  }
  return cached;
}
