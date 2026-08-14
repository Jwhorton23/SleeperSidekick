import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { loadLeagueData } from "../../api/client";
import { loadPlayerIndex } from "../../data/players";
import type { LeagueData, PlayerMeta, RosterId, Season } from "../../data/types";
import { allPlay } from "../../stats/allPlay";
import { coachingEfficiency } from "../../stats/coachingEfficiency";
import { luckIndex } from "../../stats/luckIndex";
import type { LuckIndexEntry } from "../../stats/luckIndex";
import { powerRankings } from "../../stats/powerRankings";
import { scheduleSwapMatrix } from "../../stats/scheduleSwap";
import { weeklyHighlights } from "../../stats/weeklyHighlights";
import type { PlayoffOddsWorkerRequest, PlayoffOddsWorkerResponse } from "../../workers/playoffOdds.worker";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LeagueData; playerIndex: Map<string, PlayerMeta> };

export function Dashboard() {
  const { leagueId = "" } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    Promise.all([loadLeagueData(leagueId), loadPlayerIndex()])
      .then(([data, playerIndex]) => {
        if (!cancelled) setState({ status: "ready", data, playerIndex });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ status: "error", message: err instanceof Error ? err.message : "Something went wrong." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  if (state.status === "loading") {
    return (
      <main className="page">
        <p className="subtitle">Loading league&hellip;</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="page">
        <p className="error">{state.message}</p>
      </main>
    );
  }

  const season = state.data.seasons[0];
  const teamName = (rosterId: RosterId) => season.teams.get(rosterId)?.name ?? `Team ${rosterId}`;
  const hasWeeks = season.weeks.length > 0;

  // Computed once here and passed down so cards that need the same data
  // (the team list's sort order, the luck card) don't each recompute it.
  const luck = hasWeeks ? luckIndex(season) : new Map<RosterId, LuckIndexEntry>();
  const teams = [...season.teams.values()].sort(
    (a, b) => (luck.get(b.rosterId)?.actualWins ?? 0) - (luck.get(a.rosterId)?.actualWins ?? 0),
  );

  return (
    <main className="page">
      <Link to="/" className="back-link">
        &larr; Back
      </Link>
      <h1>{season.name}</h1>
      <p className="subtitle">
        {season.season} season &middot; {teams.length} teams
      </p>
      <Link to={`/league/${leagueId}/history`} className="record-book-link">
        View multi-season record book &rarr;
      </Link>

      <ul className="league-list">
        {teams.map((team) => {
          const manager = state.data.managers.get(team.ownerId);
          return (
            <li key={team.rosterId} className="league-card">
              <span className="league-name">{team.name}</span>
              <span className="league-meta">{manager?.displayName ?? "Unknown manager"}</span>
            </li>
          );
        })}
      </ul>

      {!hasWeeks ? (
        <p className="subtitle">No completed weeks yet this season — stats will show up once games have been played.</p>
      ) : (
        <>
          <PlayoffOddsCard season={season} teamName={teamName} />
          <PowerRankingsCard season={season} teamName={teamName} />
          <LuckCard season={season} luck={luck} teamName={teamName} />
          <ScheduleSwapCard season={season} teamName={teamName} />
          <CoachingEfficiencyCard season={season} playerIndex={state.playerIndex} teamName={teamName} />
          <HighlightsCard season={season} teamName={teamName} />
        </>
      )}
    </main>
  );
}

function PlayoffOddsCard({ season, teamName }: { season: Season; teamName: (id: RosterId) => string }) {
  const [results, setResults] = useState<PlayoffOddsWorkerResponse | null>(null);

  useEffect(() => {
    setResults(null);
    if (season.remainingWeeks.length === 0) return;

    // Monte Carlo runs on a Web Worker (PLAN.md) — 10,000 simulations
    // would otherwise stall scrolling on a mid-tier phone.
    const worker = new Worker(new URL("../../workers/playoffOdds.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<PlayoffOddsWorkerResponse>) => setResults(event.data);
    const request: PlayoffOddsWorkerRequest = { season };
    worker.postMessage(request);

    return () => worker.terminate();
  }, [season]);

  if (season.remainingWeeks.length === 0) return null;

  return (
    <section className="stat-card">
      <h2>Playoff Odds</h2>
      <p className="stat-card-subtitle">10,000-season Monte Carlo simulation over the remaining schedule.</p>
      {!results ? (
        <p className="stat-card-subtitle">Simulating&hellip;</p>
      ) : (
        <ul className="stat-list">
          {results.map((entry) => (
            <li key={entry.rosterId} className="stat-row">
              <span className="stat-row-name">{teamName(entry.rosterId)}</span>
              <span className="stat-row-value">{entry.playoffPct.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PowerRankingsCard({ season, teamName }: { season: Season; teamName: (id: RosterId) => string }) {
  const rankings = powerRankings(season); // already sorted 1 (strongest) first

  return (
    <section className="stat-card">
      <h2>Power Rankings</h2>
      <p className="stat-card-subtitle">Recency-weighted margin of victory — recent blowouts count more than one from week 1.</p>
      <ul className="stat-list">
        {rankings.map((entry) => (
          <li key={entry.rosterId} className="stat-row">
            <span className="stat-row-name">
              #{entry.rank} {teamName(entry.rosterId)}
            </span>
            <span className="stat-row-value">{entry.score > 0 ? `+${entry.score.toFixed(1)}` : entry.score.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScheduleSwapCard({ season, teamName }: { season: Season; teamName: (id: RosterId) => string }) {
  const matrix = scheduleSwapMatrix(season);
  const rows = [...season.teams.keys()]
    .map((rosterId) => {
      const records = [...matrix.get(rosterId)!.values()];
      const bestWins = Math.max(...records.map((r) => r.wins));
      const worstWins = Math.min(...records.map((r) => r.wins));
      const gamesPlayed = records[0].wins + records[0].losses + records[0].ties;
      return { rosterId, bestWins, worstWins, gamesPlayed };
    })
    .sort((a, b) => b.bestWins - a.bestWins);

  return (
    <section className="stat-card">
      <h2>Schedule Swap</h2>
      <p className="stat-card-subtitle">Best- and worst-case record if this team had played someone else's schedule.</p>
      <ul className="stat-list">
        {rows.map(({ rosterId, bestWins, worstWins, gamesPlayed }) => (
          <li key={rosterId} className="stat-row">
            <span className="stat-row-name">{teamName(rosterId)}</span>
            <span className="stat-row-value">
              {bestWins}-{gamesPlayed - bestWins} easiest &middot; {worstWins}-{gamesPlayed - worstWins} hardest
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LuckCard({
  season,
  luck,
  teamName,
}: {
  season: Season;
  luck: Map<RosterId, LuckIndexEntry>;
  teamName: (id: RosterId) => string;
}) {
  const allPlayRecords = allPlay(season);
  const rows = [...season.teams.keys()].sort((a, b) => (luck.get(b)?.luck ?? 0) - (luck.get(a)?.luck ?? 0));

  return (
    <section className="stat-card">
      <h2>All-Play &amp; Luck</h2>
      <p className="stat-card-subtitle">Record if every team played every team every week, and how that compares to actual wins.</p>
      <ul className="stat-list">
        {rows.map((rosterId) => {
          const record = allPlayRecords.get(rosterId);
          const entry = luck.get(rosterId);
          if (!record || !entry) return null;
          const luckLabel = entry.luck > 0 ? `+${entry.luck.toFixed(1)}` : entry.luck.toFixed(1);
          return (
            <li key={rosterId} className="stat-row">
              <span className="stat-row-name">{teamName(rosterId)}</span>
              <span className="stat-row-value">
                {record.wins}-{record.losses}
                {record.ties > 0 ? `-${record.ties}` : ""} all-play
              </span>
              <span className={`stat-row-badge ${entry.luck >= 0 ? "badge-positive" : "badge-negative"}`}>
                {luckLabel} luck
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CoachingEfficiencyCard({
  season,
  playerIndex,
  teamName,
}: {
  season: Season;
  playerIndex: Map<string, PlayerMeta>;
  teamName: (id: RosterId) => string;
}) {
  const efficiency = coachingEfficiency(season, playerIndex);
  const totals = [...efficiency.entries()]
    .map(([rosterId, weeks]) => ({
      rosterId,
      pointsLeftOnBench: weeks.reduce((sum, w) => sum + Math.max(0, w.optimal - w.actual), 0),
    }))
    .sort((a, b) => b.pointsLeftOnBench - a.pointsLeftOnBench);

  return (
    <section className="stat-card">
      <h2>Coaching Efficiency</h2>
      <p className="stat-card-subtitle">Total points left on the bench this season by starting a suboptimal lineup.</p>
      <ul className="stat-list">
        {totals.map(({ rosterId, pointsLeftOnBench }) => (
          <li key={rosterId} className="stat-row">
            <span className="stat-row-name">{teamName(rosterId)}</span>
            <span className="stat-row-value">{pointsLeftOnBench.toFixed(1)} pts left on bench</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HighlightsCard({ season, teamName }: { season: Season; teamName: (id: RosterId) => string }) {
  const latestWeek = season.weeks.at(-1);
  const highlights = latestWeek ? weeklyHighlights(latestWeek) : null;
  if (!latestWeek || !highlights) return null;

  return (
    <section className="stat-card">
      <h2>Week {latestWeek.week} Highlights</h2>
      <ul className="stat-list">
        <li className="stat-row">
          <span className="stat-row-name">Biggest blowout</span>
          <span className="stat-row-value">
            {teamName(highlights.blowout.a.rosterId)} {highlights.blowout.a.points.toFixed(1)} &ndash;{" "}
            {highlights.blowout.b.points.toFixed(1)} {teamName(highlights.blowout.b.rosterId)}
          </span>
        </li>
        <li className="stat-row">
          <span className="stat-row-name">Closest game</span>
          <span className="stat-row-value">
            {teamName(highlights.closest.a.rosterId)} {highlights.closest.a.points.toFixed(1)} &ndash;{" "}
            {highlights.closest.b.points.toFixed(1)} {teamName(highlights.closest.b.rosterId)}
          </span>
        </li>
        {highlights.highestScoringLoser && (
          <li className="stat-row">
            <span className="stat-row-name">Highest-scoring loser</span>
            <span className="stat-row-value">
              {teamName(highlights.highestScoringLoser.rosterId)} ({highlights.highestScoringLoser.points.toFixed(1)})
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
