import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { loadLeagueData } from "../../api/client";
import { loadPlayerIndex } from "../../data/players";
import type { LeagueData, PlayerMeta, RosterId, Season } from "../../data/types";
import { rankBy, teamSummaries, type TeamSummary } from "../../stats/teamSummary";
import { weeklyHighlights } from "../../stats/weeklyHighlights";
import type { PlayoffOddsWorkerRequest, PlayoffOddsWorkerResponse } from "../../workers/playoffOdds.worker";
import { KpiTile } from "../components/KpiTile";
import { InfoButton, StatCard } from "../components/StatCard";
import { recordLabel, signed } from "../format";
import type { MetricKey } from "../metricInfo";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LeagueData; playerIndex: Map<string, PlayerMeta> };

/** Playoff odds are a Monte Carlo run on a Web Worker (PLAN.md) — 10,000
 * simulations would otherwise stall scrolling on a mid-tier phone. Null until
 * the worker reports back, or when the season has no games left to simulate. */
function usePlayoffOdds(season: Season | null): Map<RosterId, number> | null {
  const [odds, setOdds] = useState<Map<RosterId, number> | null>(null);

  useEffect(() => {
    setOdds(null);
    if (!season || season.remainingWeeks.length === 0) return;

    const worker = new Worker(new URL("../../workers/playoffOdds.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<PlayoffOddsWorkerResponse>) => {
      setOdds(new Map(event.data.map((entry) => [entry.rosterId, entry.playoffPct])));
    };
    const request: PlayoffOddsWorkerRequest = { season };
    worker.postMessage(request);

    return () => worker.terminate();
  }, [season]);

  return odds;
}

/** Each team's place in the league on the numbers where placing tells you
 * something. Kept together so a tile and its rank can't come from different
 * sorts. */
type LeagueRanks = Record<"record" | "pointsFor" | "pointsAgainst" | "allPlay" | "bench", Map<RosterId, number>>;

function leagueRanks(summaries: TeamSummary[]): LeagueRanks {
  return {
    record: rankBy(summaries, (s) => s.record.wins + s.record.ties * 0.5),
    pointsFor: rankBy(summaries, (s) => s.pointsFor),
    // Fewest points against is the good end, same for bench points left behind.
    pointsAgainst: rankBy(summaries, (s) => s.pointsAgainst, false),
    allPlay: rankBy(summaries, (s) => s.allPlayWinPct),
    bench: rankBy(summaries, (s) => s.pointsLeftOnBench, false),
  };
}

interface KpiSpec {
  metric: MetricKey;
  label: string;
  value: string;
  rank?: number;
}

/**
 * The tiles on one team's card, in reading order: how the season is going,
 * then how it was earned, then the outliers.
 *
 * This is the one list to edit when the league wants another number on the
 * landing page mid-season — the data comes from `TeamSummary`, the wording
 * from `METRIC_INFO`, and neither needs a new card.
 */
function teamKpis(summary: TeamSummary, ranks: LeagueRanks, playoffPct: number | undefined): KpiSpec[] {
  const id = summary.rosterId;

  const kpis: KpiSpec[] = [
    { metric: "record", label: "Record", value: recordLabel(summary.record), rank: ranks.record.get(id) },
  ];

  if (playoffPct !== undefined) {
    kpis.push({ metric: "playoffOdds", label: "Playoff odds", value: `${playoffPct.toFixed(1)}%` });
  }

  kpis.push(
    { metric: "allPlay", label: "All-play", value: recordLabel(summary.allPlayRecord), rank: ranks.allPlay.get(id) },
    { metric: "luck", label: "Luck (wins)", value: signed(summary.luck) },
    { metric: "pointsFor", label: "Points for", value: summary.pointsFor.toFixed(1), rank: ranks.pointsFor.get(id) },
    {
      metric: "pointsAgainst",
      label: "Points against",
      value: summary.pointsAgainst.toFixed(1),
      rank: ranks.pointsAgainst.get(id),
    },
    {
      metric: "coachingEfficiency",
      label: "Left on bench",
      value: summary.pointsLeftOnBench.toFixed(1),
      rank: ranks.bench.get(id),
    },
    {
      // The spread rather than the two endpoints: "9–5" next to a 9-5 record
      // reads as another record, when it means best and worst case wins.
      metric: "scheduleSwap",
      label: "Schedule swing",
      value: `${summary.bestScheduleWins - summary.worstScheduleWins} W`,
    },
  );

  if (summary.bestWeek) {
    kpis.push({
      metric: "bestWorstWeek",
      label: `Best (wk ${summary.bestWeek.week})`,
      value: summary.bestWeek.points.toFixed(1),
    });
  }
  if (summary.worstWeek) {
    kpis.push({
      metric: "bestWorstWeek",
      label: `Worst (wk ${summary.worstWeek.week})`,
      value: summary.worstWeek.points.toFixed(1),
    });
  }

  return kpis;
}

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

  const ready = state.status === "ready" ? state : null;
  const season = ready?.data.seasons[0] ?? null;
  const hasWeeks = (season?.weeks.length ?? 0) > 0;

  // Every league-wide stat runs once here and is handed to the team cards, so
  // ten cards don't walk the season ten times.
  const summaries = useMemo(
    () => (season && ready && hasWeeks ? teamSummaries(season, ready.playerIndex) : []),
    [season, ready, hasWeeks],
  );
  const ranks = useMemo(() => leagueRanks(summaries), [summaries]);
  const odds = usePlayoffOdds(season);

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

  if (!season || !ready) {
    return (
      <main className="page">
        <p className="error">This league has no seasons to show.</p>
      </main>
    );
  }

  const teamName = (rosterId: RosterId) => season.teams.get(rosterId)?.name ?? `Team ${rosterId}`;
  const managerName = (rosterId: RosterId) => {
    const ownerId = season.teams.get(rosterId)?.ownerId;
    return (ownerId && ready.data.managers.get(ownerId)?.displayName) || "Unknown manager";
  };

  return (
    <main className="page">
      <Link to="/" className="back-link">
        &larr; Back
      </Link>
      <h1>{season.name}</h1>
      <p className="subtitle">
        {season.season} season &middot; {season.teams.size} teams
      </p>
      <Link to={`/league/${leagueId}/history`} className="record-book-link">
        Record book &amp; league history &rarr;
      </Link>

      {!hasWeeks ? (
        <>
          <p className="subtitle">
            No completed weeks yet this season — each team's numbers show up here once games have been played.
          </p>
          <ul className="league-list">
            {[...season.teams.values()].map((team) => (
              <li key={team.rosterId}>
                <Link to={`/league/${leagueId}/manager/${team.ownerId}`} className="league-card league-card-link">
                  <span className="league-name">{team.name}</span>
                  <span className="league-meta">{managerName(team.rosterId)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="section-heading-row">
            <h2 className="section-heading">Power Rankings</h2>
            <InfoButton metric="powerRankings" />
          </div>
          <p className="stat-card-subtitle">
            Every team, strongest first. Tap any number for what it means and how it&apos;s figured.
          </p>

          <ul className="team-list">
            {summaries.map((summary) => (
              <TeamCard
                key={summary.rosterId}
                summary={summary}
                leagueId={leagueId}
                ownerId={season.teams.get(summary.rosterId)?.ownerId}
                name={teamName(summary.rosterId)}
                manager={managerName(summary.rosterId)}
                ranks={ranks}
                playoffPct={odds?.get(summary.rosterId)}
              />
            ))}
          </ul>

          <HighlightsCard season={season} teamName={teamName} />
        </>
      )}
    </main>
  );
}

function TeamCard({
  summary,
  leagueId,
  ownerId,
  name,
  manager,
  ranks,
  playoffPct,
}: {
  summary: TeamSummary;
  leagueId: string;
  ownerId: string | undefined;
  name: string;
  manager: string;
  ranks: LeagueRanks;
  playoffPct: number | undefined;
}) {
  const kpis = teamKpis(summary, ranks, playoffPct);

  return (
    <li className="team-card">
      <div className="team-card-head">
        <span className="team-rank">#{summary.powerRank}</span>
        <span className="team-identity">
          <span className="team-name">{name}</span>
          {/* Plenty of teams are just named after their manager — printing it
              twice reads as a bug. */}
          {manager !== name && <span className="team-manager">{manager}</span>}
        </span>
        <span className="team-power">
          {signed(summary.powerScore)}
          <span className="team-power-unit">pts/gm</span>
        </span>
      </div>

      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <KpiTile key={kpi.label} metric={kpi.metric} label={kpi.label} value={kpi.value} rank={kpi.rank} />
        ))}
      </div>

      {ownerId && (
        <Link to={`/league/${leagueId}/manager/${ownerId}`} className="team-card-link">
          Week by week &amp; career &rarr;
        </Link>
      )}
    </li>
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
