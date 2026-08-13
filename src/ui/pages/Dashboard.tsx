import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { loadLeagueData } from "../../api/client";
import { loadPlayerIndex } from "../../data/players";
import type { LeagueData, PlayerMeta, RosterId, Season } from "../../data/types";
import { allPlay } from "../../stats/allPlay";
import { coachingEfficiency } from "../../stats/coachingEfficiency";
import { luckIndex } from "../../stats/luckIndex";
import { weeklyHighlights } from "../../stats/weeklyHighlights";

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
  const teams = [...season.teams.values()].sort((a, b) => a.name.localeCompare(b.name));
  const teamName = (rosterId: RosterId) => season.teams.get(rosterId)?.name ?? `Team ${rosterId}`;

  return (
    <main className="page">
      <Link to="/" className="back-link">
        &larr; Back
      </Link>
      <h1>{season.name}</h1>
      <p className="subtitle">
        {season.season} season &middot; {teams.length} teams
      </p>

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

      {season.weeks.length === 0 ? (
        <p className="subtitle">No completed weeks yet this season — stats will show up once games have been played.</p>
      ) : (
        <>
          <LuckCard season={season} teamName={teamName} />
          <CoachingEfficiencyCard season={season} playerIndex={state.playerIndex} teamName={teamName} />
          <HighlightsCard season={season} teamName={teamName} />
        </>
      )}
    </main>
  );
}

function LuckCard({ season, teamName }: { season: Season; teamName: (id: RosterId) => string }) {
  const allPlayRecords = allPlay(season);
  const luck = luckIndex(season);
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
