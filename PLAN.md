# PLAN.md — Sleeper League Analytics Web App

## 1. CORS finding and architecture decision

**Verified empirically on 2026-08-12.** A `GET https://api.sleeper.app/v1/state/nfl` with a browser `Origin: http://localhost:5173` header returns `access-control-allow-origin: *`, and an `OPTIONS` preflight to `/v1/user/<name>` returns `access-control-allow-origin: *`, `access-control-allow-methods: GET,...`, `access-control-max-age: 1728000`. CORS is fully permissive across the API.

**Decision: pure static SPA, all Sleeper fetches happen client-side in the browser. No proxy, no server.** This is the simplest architecture that satisfies every constraint: single-command local dev, free static hosting later, no secrets, no backend to maintain.

Supporting measurements:
- `/players/nfl` is ~2.6 MB — confirmed too large for the browser. It becomes a build-time-trimmed static asset (see §7).
- Sleeper responses come through Cloudflare with `s-maxage=60, stale-while-revalidate=180`, so even our uncached requests are usually CDN hits.
- `/state/nfl` currently reports season `2026`, `season_type: "pre"` — the 2026 season has **no matchup data yet**. We develop and validate against the 2025 seasons reachable via `previous_league_id` (verified: all 5 of Havok21's leagues have one). This forces the multi-season data layer to work on day one, which PROMPT.md asks for anyway.

**Cold-load request budget** (worst case, 18-week season):
`/state/nfl` (1) + `/user/<name>` (1) + `/user/<id>/leagues/nfl/<season>` (1) + on league select: `/league/<id>` (1) + `/users` (1) + `/rosters` (1) + `/matchups/<w>` × completed weeks (≤18) ≈ **24 requests, each 1–50 KB**, plus the trimmed players asset (~100 KB gzipped, HTTP-cached). Total well under 1 MB — fine on mobile data, and after first visit the cache (§8) reduces a warm load to ~4 requests. Rate limit (1000/min) is never a concern at this volume.

**Escape hatch if Sleeper ever tightens CORS:** all network calls go through one module (`src/api/client.ts`). Swapping its base URL to a Cloudflare Worker proxy is a one-file change; nothing else in the app knows where data comes from.

## 2. Stack

**Vite + React + TypeScript.**

- **Vite**: one `npm run dev` command, instant reload, static `dist/` output that deploys to any static host unchanged. Yes, it's a build step — justified because TypeScript is doing real work here: the shared data model (§4) is the contract both developers code against, and the lineup optimizer is exactly the kind of code that types keep honest.
- **React**: the most boring choice; both devs know it; a stat dashboard is naturally component-shaped.
- **react-router with `HashRouter`**: URLs like `#/league/1389377…/` work on any static host with zero server config and are directly shareable in the group chat — someone can link straight to a league dashboard.
- **Vitest**: unit tests for the stat functions only. The lineup optimizer with FLEX/superflex is the bug farm; it gets tests against committed real-league fixtures. No UI/e2e testing in MVP.
- **Plain CSS** (custom properties, mobile-first). No Tailwind, no component library, no chart library in MVP — highlights and stats render as cards and ranked lists, which read better on a phone than charts anyway.

Total runtime dependencies: `react`, `react-dom`, `react-router`. Dev: `vite`, `typescript`, `vitest`.

## 3. Repo structure

```
/
├── PLAN.md, PROMPT.md, README.md
├── index.html                 # Vite entry
├── package.json, vite.config.ts, tsconfig.json
├── public/
│   └── players.json           # trimmed player lookup, generated + committed (see §7)
├── scripts/
│   └── build-players.mjs      # node script: fetch /players/nfl, trim, write public/players.json
├── src/
│   ├── api/                   # thin fetch wrappers over Sleeper + cache layer; ONLY place that talks to the network
│   ├── data/                  # types.ts (the shared contract) + normalize.ts (raw payloads → LeagueData)
│   ├── stats/                 # pure functions LeagueData → numbers; one file per stat, each with a .test.ts
│   ├── ui/                    # pages (Home, LeaguePicker, Dashboard) and stat cards
│   ├── workers/               # (Phase 2) Web Worker for Monte Carlo
│   └── main.tsx
└── src/fixtures/              # committed JSON snapshots of a real 2025 league, powering tests + offline dev
```

## 4. Data layer design (the contract)

Everything downstream of `normalize.ts` is a pure function over these types. Nothing outside `src/api` + `src/data` ever sees a raw Sleeper payload.

```ts
// ---- identity ----
type UserId = string;      // stable; usernames are mutable, never key on them
type RosterId = number;    // stable within one season's league only

interface Manager {        // a human, stable across seasons
  userId: UserId;
  displayName: string;
  avatar: string | null;
}

// ---- the model ----
interface LeagueData {
  managers: Map<UserId, Manager>;
  seasons: Season[];       // newest first; MVP loads seasons[0] (or the 2025 season pre-kickoff);
}                          // Phase 3 walks previous_league_id to fill the rest — same shape, zero refactor

interface Season {
  leagueId: string;
  season: string;                  // "2025"
  starterSlots: Slot[];            // roster_positions minus BN/IR/TAXI, order preserved
  playoffWeekStart: number;        // settings.playoff_week_start; stats only count weeks before this
  teams: Map<RosterId, Team>;
  weeks: Week[];                   // completed weeks only, ascending
}

interface Team {
  rosterId: RosterId;
  ownerId: UserId;                 // join to managers
  name: string;                    // team name from users.metadata, else displayName
}

interface Week {
  week: number;
  games: Game[];                   // entries sharing a matchup_id, paired
}

interface Game { a: TeamWeek; b: TeamWeek; }   // orientation arbitrary

interface TeamWeek {
  rosterId: RosterId;
  points: number;                            // official total
  starters: { playerId: string; points: number }[];  // index-aligned with starterSlots; empty slot = playerId "0"
  bench:    { playerId: string; points: number }[];  // players − starters
}

// ---- player lookup (from trimmed players.json, loaded once) ----
interface PlayerMeta {
  id: string;
  name: string;                    // "J. Chase" style short name
  positions: string[];             // fantasy_positions — drives slot eligibility
  team: string | null;
}

type Slot = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "FLEX" | "SUPER_FLEX" | "WRRB_FLEX" | "REC_FLEX" | string;
```

**Raw → normalized mapping:**

| Raw source | Becomes | Notes |
| --- | --- | --- |
| `/league/<id>` | `Season.starterSlots`, `playoffWeekStart`, `previous_league_id` for the chain | drop `BN`/`IR`/`TAXI` from `roster_positions` |
| `/league/<id>/users` | `Manager` entries + team names | `metadata.team_name` fallback to `display_name` |
| `/league/<id>/rosters` | `Team` (`roster_id` → `owner_id`) | records shown by Sleeper are recomputable; we don't store them |
| `/matchups/<w>` | `Week` → `Game` → `TeamWeek` | group entries by `matchup_id`; per-player points from `players_points`; bench = `players` − `starters` (verified all fields present in live 2025 data) |
| `/players/nfl` (trimmed) | `Map<string, PlayerMeta>` | static asset, not part of `LeagueData` |
| `/state/nfl` | current season + week | determines "completed weeks"; never hardcoded |

**Stat function signatures (the second half of the contract):**

```ts
coachingEfficiency(season: Season): Map<RosterId, { week: number; actual: number; optimal: number }[]>
allPlay(season: Season): Map<RosterId, { wins: number; losses: number; ties: number }>
luckIndex(season: Season): Map<RosterId, { actualWins: number; expectedWins: number; luck: number }>
weeklyHighlights(week: Week): { blowout: Game; closest: Game; highestScoringLoser: TeamWeek }
```

**Optimal lineup algorithm** (heart of coaching efficiency): eligibility map `FLEX = {RB,WR,TE}`, `SUPER_FLEX = {QB,RB,WR,TE}`, `WRRB_FLEX = {RB,WR}`, `REC_FLEX = {WR,TE}`, base positions = themselves. Order slots most-restrictive-first, then run an exact backtracking assignment maximizing total points (≤10 slots × ≤16 players — trivially fast, and exact matters because greedy can fail when flex sets overlap). Edge cases handled explicitly: `"0"` placeholder for empty starter slots, players with 0/missing `players_points`, multi-position players. The **"2QB" league is superflex** — it becomes a fixture so the SUPER_FLEX path is tested against reality. Definitions: **all-play** = each week, a team beats every team it outscored (ties 0.5); **luck** = actual wins − (all-play win% × games played). Regular-season weeks only (`week < playoffWeekStart`) — otherwise playoff/consolation matchups pollute the stats.

## 5. Phased milestones (each ends runnable)

- **M0 — skeleton on screen** (day one, §9): fresh clone → page renders at localhost.
- **M1 — username to leagues, on a phone**: enter `Havok21` → your 5 leagues listed, mobile layout. API client + cache underneath. *Check: works in a phone-sized viewport, and a bogus username shows a friendly error.*
- **M2 — data layer proven**: pick a league → dashboard shell shows managers/teams with names resolved through the `roster_id → owner_id → user_id` chain, for the **2025** season. Fixtures snapshotted into `src/fixtures/`. *Check: names match what Sleeper's app shows for last season.*
- **M3 — the four MVP stats** (= shippable MVP): coaching efficiency, all-play, luck index, weekly highlights as mobile cards. *Check: numbers sanity-checked against real 2025 leagues — e.g. bench-points-left per team per week should almost always be 0–40, never 200.*
- **M4 (Phase 2) — power rankings + schedule swap matrix.**
- **M5 (Phase 2) — playoff odds**: Monte Carlo in a Web Worker (`src/workers/`), so 10k sims never block scrolling.
- **M6 (Phase 3) — record book**: walk the full `previous_league_id` chain; all-time head-to-head, career points, streaks, titles.
- **M7 (Phase 3) — draft hit rate, FAAB efficiency, report cards.**

## 6. Two-developer split

**PR #1 is the contract**: `src/data/types.ts` + the stat signatures above + `src/fixtures/` snapshots, reviewed by both devs before parallel work starts. After that:

| | Dev A (plumbing + shell) | Dev B (stats + cards) |
| --- | --- | --- |
| M1 | `src/api` client + cache, Home/LeaguePicker pages, routing | `scripts/build-players.mjs`, `normalize.ts` against fixtures |
| M2–M3 | Dashboard shell, wiring live data into stat cards | `src/stats/*` pure functions + tests — **needs no network, only fixtures** |

The fixtures are what keep the two lanes independent: Dev B writes and tests every stat against committed JSON without touching the API layer, and the pieces meet at the typed boundary. Interfaces to agree up front: (1) the types file, (2) stat signatures, (3) cache key format `sleeper:<leagueId>:<resource>:<week>` so both sides invalidate consistently.

## 7. Local dev setup

Prerequisite: **Node.js 20+ LTS — currently not installed on the primary dev machine** (verified). Install first:

```bash
winget install OpenJS.NodeJS.LTS
```

Then (fresh clone to running app):

```bash
git clone <repo> && cd SleeperSidekick
npm install
npm run players     # runs scripts/build-players.mjs → fetches /players/nfl, trims to {id, name, positions, team}
                    # for fantasy-relevant positions, writes public/players.json (~2.6 MB → ~300–400 KB raw)
npm run dev         # Vite dev server → http://localhost:5173
```

`public/players.json` is **committed**, so `npm run players` is optional for a fresh clone — the second dev runs `npm install && npm run dev` and is working. Regenerate weekly-ish during the season (roster moves change team/status fields); it's a 5-second script run. `npm test` runs the Vitest stat suite.

## 8. Caching strategy

One wrapper in `src/api/cache.ts` over `localStorage`, keyed `sleeper:<leagueId>:<resource>:<week>`, storing `{fetchedAt, data}`:

- **Immutable** (matchups for weeks ≤ current−2): cache forever.
- **Semi-stable** (most recent completed week): 24 h TTL — Sleeper applies stat corrections into midweek.
- **Mutable** (`/state`, `/user`, `/leagues`, `/league`, `/users`, `/rosters`, current-week matchups): 10 min TTL.
- `players.json`: normal HTTP caching, it's a static asset.

Result: a returning visitor mid-season refetches ~4 small requests instead of ~24. Full-season matchup data for a 12-teamer is ~300 KB — comfortably inside localStorage's ~5 MB. Multi-season history in Phase 3 may want IndexedDB; the cache wrapper's interface (`get/set/withTTL`) is written so swapping the backend touches one file.

## 9. Day-one checklist (before any Sleeper code)

1. Install Node LTS (command in §7) — verify `node --version` ≥ 20.
2. `git init`, create GitHub repo, push `main` with PLAN.md/PROMPT.md.
3. `npm create vite@latest . -- --template react-ts`, `npm install`.
4. Delete demo content; add hash routing with a Home page that renders a title and a username input (non-functional).
5. Add `npm run players` script stub + empty `src/{api,data,stats,ui}` directories with placeholder files so the structure is real.
6. `npm run dev` → page renders at `http://localhost:5173`. Commit. Both devs confirm the same result from a fresh clone.

## 10. Deferred (deliberately) and the decisions keeping it cheap

- **Hosting**: later — but note the app is 100% static, so deploying to Cloudflare Pages is "connect repo, build command `npm run build`, output `dist/`". Nothing to change.
- **Scheduled players refresh**: manual script for now; becomes a scheduled GitHub Action later that commits a fresh `players.json` — this is *why* the file is committed rather than gitignored.
- **CI**: none; `npm test` locally + PR review. Vitest is CI-ready when wanted.
- **No SSR, no accounts, no database** — permanently out, not just deferred.

## 11. Risks, open questions, and pushback

1. **"Usable in the group chat by week 1" contradicts "local first" harder than PROMPT.md acknowledges.** A localhost app can't be opened from a group-chat link. Since the app is static, hosting is ~an hour of work — but plan to do that hour around the end of MVP (M3), not "later." Budget: MVP done in ~2 weeks, deploy in week 3, buffer before kickoff.
2. **2026 has no data until kickoff.** Mitigated: build against 2025 seasons via `previous_league_id` (all of Havok21's leagues have one). Bonus: multi-season plumbing is exercised from day one instead of being a Phase 3 bolt-on. The dashboard needs a season selector anyway for the preseason window.
3. **Stat corrections** midweek can change "completed" weeks — handled with the 24 h TTL tier, worth remembering if numbers look off by a fraction on a Tuesday.
4. **Lineup-optimizer edge cases** are the main correctness risk: superflex (the 2QB league), multi-position players, empty starter slots, missing points. Mitigated by exact (not greedy) assignment + fixture tests from real leagues.
5. **CORS is Sleeper's policy, not a contract.** Low risk; escape hatch in §1 (single fetch module → proxy swap).
6. **Node.js isn't installed on the primary dev machine yet** — step 1 of day one, not a surprise mid-build.
7. **Open question:** should the dashboard default to the 2025 season until 2026 week 1 completes, or show 2026 with an "awaiting kickoff" state? Recommendation: default to the latest season *with completed weeks*, which handles the rollover automatically.
