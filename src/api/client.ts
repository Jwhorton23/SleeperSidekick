import { cached, TTL } from "./cache";
import type { RawNflState, RawSleeperLeague, RawSleeperUser } from "./types";
import { toLeagueSummary, toSleeperUser } from "../data/normalize";
import type { LeagueSummary, SleeperUser } from "../data/types";

const BASE_URL = "https://api.sleeper.app/v1";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Sleeper API request failed (${res.status}) for ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Sleeper returns HTTP 200 with a JSON `null` body for an unknown username — not a 404. */
export async function resolveUsername(username: string): Promise<SleeperUser | null> {
  const key = `sleeper:user:${username.toLowerCase()}`;
  const raw = await cached<RawSleeperUser | null>(key, TTL.MUTABLE, () =>
    fetchJson<RawSleeperUser | null>(`/user/${encodeURIComponent(username)}`),
  );
  return raw ? toSleeperUser(raw) : null;
}

export async function getUserLeagues(userId: string, season: string): Promise<LeagueSummary[]> {
  const key = `sleeper:leagues:${userId}:${season}`;
  const raw = await cached<RawSleeperLeague[]>(key, TTL.MUTABLE, () =>
    fetchJson<RawSleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`),
  );
  return raw.map(toLeagueSummary);
}

export async function getNflState(): Promise<RawNflState> {
  return cached<RawNflState>("sleeper:state", TTL.MUTABLE, () => fetchJson<RawNflState>("/state/nfl"));
}
