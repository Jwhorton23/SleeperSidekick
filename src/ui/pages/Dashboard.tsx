import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { loadLeagueData } from "../../api/client";
import { loadPlayerIndex } from "../../data/players";
import type { LeagueData, PlayerMeta, RosterId, Season } from "../../data/types";
import { coachingEfficiency } from "../../stats/coachingEfficiency";
import { luckIndex } from "../../stats/luckIndex";
import type { LuckIndexEntry } from "../../stats/luckIndex";
import { powerRankings } from "../../stats/powerRankings";
import { scheduleSwapMatrix } from "../../stats/scheduleSwap";
import { pointsForByRoster } from "../../stats/teamLog";
import { weeklyHighlights } from "../../stats/weeklyHighlights";
import type { PlayoffOddsWorkerRequest, PlayoffOddsWorkerResponse } from "../../workers/playoffOdds.worker";
import { StatCard } from "../components/StatCard";

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
  // (the team list's sort order, the all-play and luck cards) don't each
  // recompute it.
  const luck = hasWeeks ? luckIndex(season) : new Map<RosterId, LuckIndexEntry>();
  const pointsFor = hasWeeks ? pointsForByRoster(season) : new Map<RosterId, number>();
  const teams = [...season.teams.values()].sort((a, b) => {
    const winDiff = (luck.get(b.rosterId)?.actualWins ?? 0) - (luck.get(a.rosterId)?.actualWins ?? 0);
    if (winDiff !== 0) return winDiff;
    // Points for is the league's own tiebreak; without it equal-win teams fall
    // back to roster-id order, which looks arbitrary.
    return (pointsFor.get(b.rosterId) ?? 0) - (pointsFor.get(a.rosterId) ?? 0);
  });

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
          const entry = luck.get(team.rosterId);
          return (
            <li key={team.rosterId}>
              <Link to={`/league/${leagueId}/manager/${team.ownerId}`} className="league-card league-card-link">
                <span className="league-name">{team.name}</span>
                <span className="league-meta">
                  {manager?.displayName ?? "Unknown manager"}
                  {entry && ` · ${entry.record.wins}-${entry.record.losses}${entry.record.ties > 0 ? `-${entry.record.ties}` : ""}`}
                </span>
              </Link>
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
          <AllPlayCard season={season} luck={luck} teamName={teamName} />
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
    <StatCard metric="playoffOdds">
      {!results ? (
        <p className="stat-card-subtitle">Simulating&hellip;</p>
      ) : (
        <ul className="stat-list">
          {results.map((entry) => (
            <li key={entry.rosterId} className="stat-row">
              <span className="stat-row-name">{teamName(entry.rosterId)}</span>
              <span className="stat-row-value">{entry.playoffPct.toFixed(1)}% to make the playoffs</span>
            </li>
          ))}
        </ul>
      )}
    </StatCard>
  );
}

function PowerRankingsCard({ season, teamName }: { season: Season; teamName: (id: RosterId) => string }) {
  const rankings = powerRankings(season); // already sorted 1 (strongest) first

  return (
    <StatCard metric="powerRankings">
      <ul className="stat-list">
        {rankings.map((entry) => (
          <li key={entry.rosterId} className="stat-row">
            <span className="stat-row-name">
              #{entry.rank} {teamName(entry.rosterId)}
            </span>
            <span className="stat-row-value">
              {entry.score > 0 ? "+" : ""}
              {entry.score.toFixed(1)} pts/game
            </span>
          </li>
        ))}
      </ul>
    </StatCard>
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
    <StatCard metric="scheduleSwap">
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
    </StatCard>
  );
}

function AllPlayCard({
  season,
  luck,
  teamName,
}: {
  season: Season;
  luck: Map<RosterId, LuckIndexEntry>;
  teamName: (id: RosterId) => string;
}) {
  // Sorted by the number the row actually shows — the all-play record — so the
  // order needs no explaining.
  const rows = [...season.teams.keys()].sort((a, b) => (luck.get(b)?.allPlayWinPct ?? 0) - (luck.get(a)?.allPlayWinPct ?? 0));

  return (
    <StatCard metric="allPlay">
      <ul className="stat-list">
        {rows.map((rosterId) => {
          const entry = luck.get(rosterId);
          if (!entry) return null;
          const { wins, losses, ties } = entry.allPlayRecord;
          return (
            <li key={rosterId} className="stat-row">
              <span className="stat-row-name">{teamName(rosterId)}</span>
              <span className="stat-row-value">
                {wins}-{losses}
                {ties > 0 ? `-${ties}` : ""} all-play &middot; beat {Math.round(entry.allPlayWinPct * 100)}% of the league
              </span>
            </li>
          );
        })}
      </ul>
    </StatCard>
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
  const rows = [...season.teams.keys()].sort((a, b) => (luck.get(b)?.luck ?? 0) - (luck.get(a)?.luck ?? 0));

  return (
    <StatCard metric="luck">
      <ul className="stat-list">
        {rows.map((rosterId, i) => {
          const entry = luck.get(rosterId);
          if (!entry) return null;
          const luckLabel = `${entry.luck > 0 ? "+" : ""}${entry.luck.toFixed(1)}`;
          // Naming the two ends makes the sort self-evident without opening
          // the explainer.
          const tag = i === 0 ? "luckiest" : i === rows.length - 1 ? "unluckiest" : null;
          return (
            <li key={rosterId} className="stat-row">
              <span className="stat-row-name">
                {teamName(rosterId)} {tag && <span className="stat-row-tag">({tag})</span>}
              </span>
              <span className="stat-row-value">
                {entry.record.wins}-{entry.record.losses}
                {entry.record.ties > 0 ? `-${entry.record.ties}` : ""} vs {entry.expectedWins.toFixed(1)} expected
              </span>
              <span className={`stat-row-badge ${entry.luck >= 0 ? "badge-positive" : "badge-negative"}`}>
                {luckLabel} wins
              </span>
            </li>
          );
        })}
      </ul>
    </StatCard>
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
  const totals = [...coachingEfficiency(season, playerIndex).entries()]
    .map(([rosterId, weeks]) => ({
      rosterId,
      pointsLeftOnBench: weeks.reduce((sum, w) => sum + Math.max(0, w.optimal - w.actual), 0),
    }))
    // Fewest points left on the bench first — every card in the app leads with
    // the team doing best on that metric.
    .sort((a, b) => a.pointsLeftOnBench - b.pointsLeftOnBench);

  return (
    <StatCard metric="coachingEfficiency">
      <ul className="stat-list">
        {totals.map(({ rosterId, pointsLeftOnBench }) => (
          <li key={rosterId} className="stat-row">
            <span className="stat-row-name">{teamName(rosterId)}</span>
            <span className="stat-row-value">{pointsLeftOnBench.toFixed(1)} pts left on bench</span>
          </li>
        ))}
      </ul>
    </StatCard>
  );
}

function HighlightsCard({ season, teamName }: { season: Season; teamName: (id: RosterId) => string }) {
  const latestWeek = season.weeks.at(-1);
  const highlights = latestWeek ? weeklyHighlights(latestWeek) : null;
  if (!latestWeek || !highlights) return null;

  return (
    <StatCard metric="weeklyHighlights" title={`Week ${latestWeek.week} Highlights`} subtitle={null}>
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
    </StatCard>
  );
}
