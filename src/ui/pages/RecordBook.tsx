import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { loadLeagueHistory } from "../../api/client";
import type { LeagueData, UserId } from "../../data/types";
import { careerRecords, headToHeadMatrix } from "../../stats/careerRecords";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: LeagueData };

export function RecordBook() {
  const { leagueId = "" } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    loadLeagueHistory(leagueId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
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
        <p className="subtitle">Loading multi-season history&hellip;</p>
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

  const { data } = state;
  const seasons = [...data.seasons].reverse(); // oldest first, for display
  const managerName = (userId: UserId) => data.managers.get(userId)?.displayName ?? "Unknown manager";

  return (
    <main className="page">
      <Link to={`/league/${leagueId}`} className="back-link">
        &larr; Back
      </Link>
      <h1>{data.seasons[0]?.name ?? "Record Book"}</h1>
      <p className="subtitle">
        {seasons.length === 1 ? seasons[0].season : `${seasons[0].season}–${seasons.at(-1)!.season}`} record book
      </p>

      <CareerPointsCard data={data} managerName={managerName} />
      <ChampionshipsCard data={data} managerName={managerName} />
      <StreaksCard data={data} managerName={managerName} />
      <RivalriesCard data={data} managerName={managerName} />
    </main>
  );
}

function CareerPointsCard({ data, managerName }: { data: LeagueData; managerName: (id: UserId) => string }) {
  const records = [...careerRecords(data).values()].sort((a, b) => b.careerPoints - a.careerPoints);

  return (
    <section className="stat-card">
      <h2>Career Points</h2>
      <ul className="stat-list">
        {records.map((r) => (
          <li key={r.userId} className="stat-row">
            <span className="stat-row-name">{managerName(r.userId)}</span>
            <span className="stat-row-value">{r.careerPoints.toFixed(1)} pts</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChampionshipsCard({ data, managerName }: { data: LeagueData; managerName: (id: UserId) => string }) {
  const records = [...careerRecords(data).values()]
    .filter((r) => r.championships.length > 0)
    .sort((a, b) => b.championships.length - a.championships.length);

  if (records.length === 0) return null;

  return (
    <section className="stat-card">
      <h2>Championships</h2>
      <ul className="stat-list">
        {records.map((r) => (
          <li key={r.userId} className="stat-row">
            <span className="stat-row-name">{managerName(r.userId)}</span>
            <span className="stat-row-value">
              {r.championships.length}x &middot; {r.championships.join(", ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StreaksCard({ data, managerName }: { data: LeagueData; managerName: (id: UserId) => string }) {
  const records = [...careerRecords(data).values()].sort((a, b) => b.longestWinStreak - a.longestWinStreak);

  return (
    <section className="stat-card">
      <h2>Longest Win Streak</h2>
      <ul className="stat-list">
        {records.map((r) => (
          <li key={r.userId} className="stat-row">
            <span className="stat-row-name">{managerName(r.userId)}</span>
            <span className="stat-row-value">{r.longestWinStreak} games</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RivalriesCard({ data, managerName }: { data: LeagueData; managerName: (id: UserId) => string }) {
  const matrix = headToHeadMatrix(data);
  const rows = [...matrix.entries()]
    .map(([userId, opponents]) => {
      let best: { opponentId: UserId; wins: number; losses: number; ties: number } | null = null;
      for (const [opponentId, record] of opponents) {
        const diff = record.wins - record.losses;
        const bestDiff = best ? best.wins - best.losses : -Infinity;
        if (!best || diff > bestDiff) best = { opponentId, ...record };
      }
      return best ? { userId, ...best } : null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null && row.wins > row.losses)
    .sort((a, b) => b.wins - b.losses - (a.wins - a.losses));

  if (rows.length === 0) return null;

  return (
    <section className="stat-card">
      <h2>Rivalries</h2>
      <p className="stat-card-subtitle">Each manager's most dominant head-to-head matchup.</p>
      <ul className="stat-list">
        {rows.map((row) => (
          <li key={row.userId} className="stat-row">
            <span className="stat-row-name">{managerName(row.userId)}</span>
            <span className="stat-row-value">
              vs {managerName(row.opponentId)}: {row.wins}-{row.losses}
              {row.ties > 0 ? `-${row.ties}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
