// localStorage-backed cache with TTL tiers (PLAN.md §8). Key format:
// sleeper:<resource>:<params> for user-scoped lookups,
// sleeper:<leagueId>:<resource>:<week> once league data (M2+) is involved.

export const TTL = {
  MUTABLE: 10 * 60 * 1000, // /state, /user, /leagues, current-week matchups
  SEMI_STABLE: 24 * 60 * 60 * 1000, // most recent completed week
  IMMUTABLE: Number.POSITIVE_INFINITY, // matchups for weeks <= current - 2
} as const;

interface CacheEntry<T> {
  fetchedAt: number;
  data: T;
}

function readEntry<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writeEntry<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { fetchedAt: Date.now(), data };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable (e.g. private browsing) — degrade to no cache.
  }
}

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = readEntry<T>(key);
  if (entry && Date.now() - entry.fetchedAt < ttlMs) {
    return entry.data;
  }
  const data = await fetcher();
  writeEntry(key, data);
  return data;
}
