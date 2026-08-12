# Planning Prompt — Sleeper League Analytics Web App

> Paste everything below the line into Claude Code as your first message in an empty repo.

---

This session has two stages.

**Stage 1 — plan.** Produce a written build plan. Do not write application code during this stage. Stop when the plan is written and wait for me to review it with a collaborator.

**Stage 2 — build.** Once I approve the plan, implement the MVP so I can run and test it on my own machine. Getting it running locally is the goal; deployment comes later.

## What we're building

A web app that surfaces fantasy football analytics that the Sleeper app itself does not compute. A visitor enters their Sleeper **username**, sees a list of every league they're in, picks one, and gets a dashboard of derived stats for that league.

Sleeper's own app already shows standings, rosters, and scores. We are not rebuilding those. Everything we display should be something Sleeper does not give you.

## Audience and constraints

- Two developers, working nights and weekends, using PRs against `main`.
- Real audience is a 10–12 person league that will open this **on a phone, from a link in a group chat**. Mobile-first is not optional.
- NFL season starts in ~3 weeks. We want something usable in the group chat by week 1.
- No login, no user accounts, no database. All data is public.
- **Local first.** The MVP has to run on my machine with a single command and be reachable in a browser at localhost. Do not build for a hosting platform yet.
- GitHub is for source control only right now — branches, PRs, history. No CI, no deploy pipeline, no scheduled Actions in the MVP.
- Nothing in the design should paint us into a corner on hosting. When we do deploy, the target is a free static host (Cloudflare Pages or similar), so avoid anything requiring a persistent server unless the CORS finding below forces it.

## Data source

The Sleeper API: `https://api.sleeper.app/v1/`. Docs at https://docs.sleeper.com.

It is read-only, requires no authentication and no API key, and has no write endpoints of any kind. Guidance is to stay under ~1000 calls/minute.

Endpoints that matter:

| Purpose | Endpoint |
| --- | --- |
| Resolve username → user_id | `/user/<username>` |
| List a user's leagues for a season | `/user/<user_id>/leagues/nfl/<season>` |
| League settings and scoring | `/league/<league_id>` |
| Managers in a league | `/league/<league_id>/users` |
| Rosters, records, points | `/league/<league_id>/rosters` |
| Weekly scores and lineups | `/league/<league_id>/matchups/<week>` |
| Waivers, trades, FAAB bids | `/league/<league_id>/transactions/<week>` |
| Playoff brackets | `/league/<league_id>/winners_bracket`, `/losers_bracket` |
| Draft list and picks | `/league/<league_id>/drafts`, `/draft/<draft_id>/picks` |
| Current NFL week and season | `/state/nfl` |
| All NFL players (large) | `/players/nfl` |

### Known quirks to design around

- **Joins are indirect.** Matchups are keyed by `roster_id`, not by user. To attribute a score to a person: `matchups.roster_id` → `rosters.owner_id` → `users.user_id` → `display_name`.
- **Head-to-head pairing.** Within a given week, the two entries sharing a `matchup_id` are playing each other.
- **Players endpoint is multiple MB.** Never fetch it from the browser. It should be pulled by a scheduled job, trimmed to the fields we actually use, and served as a static asset.
- **Player IDs are opaque strings.** Rosters and matchups return IDs like `"4046"`, resolved via the players file.
- **Usernames are mutable, user_ids are not.** Store and cache on `user_id`.
- **Multi-season history** is a linked list: each league object has a `previous_league_id`. Walk it backward to reach every prior season of the same league.
- **Season rollover.** `/state/nfl` tells you the current season and week; don't hardcode either.

## Architecture question to resolve first

Because the username is user-supplied, we cannot pre-generate every league's data at build time. The likely design is a static site that fetches from Sleeper **client-side** at page load, plus a scheduled job that maintains the trimmed players file.

**Before planning anything else, verify empirically that `api.sleeper.app` returns permissive CORS headers for browser requests.** Actually make the request and check. If CORS is blocked, the whole architecture changes to a serverless proxy and you should plan for that instead. Report which case we're in and why.

Also address:
- Where each computation runs. Heavy work (simulations) should not block the main thread — consider a Web Worker.
- Caching strategy so a returning visitor isn't refetching a full season of matchups on every page view.
- How many requests a cold load costs, and whether that's acceptable on mobile data.

## Feature scope

**MVP (must ship first):**
1. Username entry → league picker → league dashboard.
2. **Coaching efficiency** — matchups return both `starters` and full `players` with `players_points`, so compute the optimal legal lineup versus the lineup actually started, and report points left on the bench. Must respect the league's roster position rules including FLEX and superflex.
3. **All-play record** — each team's record if it had played every other team every week.
4. **Luck index** — actual wins versus all-play expected wins.
5. Weekly highlights: biggest blowout, closest game, highest-scoring loser.

**Phase 2:**
6. Power rankings weighted by recency and margin.
7. Schedule swap matrix — every team's record under every other team's schedule.
8. Playoff odds via Monte Carlo over the remaining schedule.

**Phase 3:**
9. Multi-season record book via the `previous_league_id` chain: all-time head-to-head, career points, streaks, championships.
10. Draft pick hit rate and FAAB efficiency.
11. Manager report cards and season awards.

Design the data layer for multi-season from day one even though history is Phase 3. Do not make it a bolt-on.

## What the plan must contain

1. **CORS finding** and the resulting architecture decision, with reasoning.
2. **Stack recommendation** with justification. Bias toward boring and fast to ship. Flag anything that would need a build step we don't need.
3. **Repo structure** — directory tree with a one-line purpose for each significant directory.
4. **Data layer design** — the normalized shape we hold in memory after fetching, and how the raw Sleeper payloads map into it. This is the most important section; get it right and every stat is a pure function over it.
5. **Phased milestones**, each ending in something I can run locally and actually look at.
6. **Task breakdown within each phase**, explicitly split so two people can work in parallel without stepping on each other. Call out the interfaces they need to agree on up front.
7. **Local dev setup** — exact commands to install and run, what port it serves on, how the trimmed players file gets generated as a one-off script for now, and how a second developer gets to the same working state from a fresh clone.
8. **Day-one checklist** — the smallest set of steps to get a page rendering on localhost from a fresh clone before any Sleeper code is written.
9. **Deferred to later** — a short section noting what we're explicitly not doing yet (hosting, scheduled jobs, CI) and any decisions in the plan that exist to keep those options open.
10. **Risks and open questions**, including anything you think I've gotten wrong above.

## How to work

Ask me clarifying questions before writing the plan if anything is ambiguous. Push back if you think part of this scope is wrong or if the sequencing sets us up badly — I'd rather find out now than in week 4.

Write the plan to `PLAN.md` in the repo root.

Once I approve it and you start building:

- Work on a feature branch, not `main`. Commit in logical chunks with real messages, not one giant dump at the end — my collaborator has to read this history.
- Stop and let me test at each milestone rather than building the whole MVP in one pass.
- Tell me the exact command to run it and what I should expect to see.
- Use my real league data to sanity-check the numbers as you go. If coaching efficiency says someone left 200 points on the bench, that's a bug, not a stat.
