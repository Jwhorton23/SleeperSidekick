// Fetches the full Sleeper /players/nfl payload (~2.6 MB gzipped, ~12k
// entries — far too large to fetch from the browser) and trims it to the
// fields the app actually needs, for the fantasy-relevant positions only.
// Writes public/players.json, which is committed and served as a static
// asset (PLAN.md §7).

import { writeFile } from "node:fs/promises";

const STANDARD_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

const res = await fetch("https://api.sleeper.app/v1/players/nfl");
if (!res.ok) {
  throw new Error(`Failed to fetch players/nfl: ${res.status}`);
}
const raw = await res.json();

const trimmed = {};
for (const [id, player] of Object.entries(raw)) {
  const positions = (player.fantasy_positions ?? []).filter((p) => STANDARD_POSITIONS.has(p));
  if (positions.length === 0) continue;
  const name = player.full_name || [player.first_name, player.last_name].filter(Boolean).join(" ") || id;
  trimmed[id] = { id, name, positions, team: player.team ?? null };
}

const outPath = new URL("../public/players.json", import.meta.url);
await writeFile(outPath, JSON.stringify(trimmed));

console.log(`Wrote ${Object.keys(trimmed).length} players to public/players.json`);
