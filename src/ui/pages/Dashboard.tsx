import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { loadLeagueData } from "../../api/client";
import type { LeagueData } from "../../data/types";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: LeagueData };

export function Dashboard() {
  const { leagueId = "" } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    loadLeagueData(leagueId)
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

  return (
    <main className="page">
      <Link to="/" className="back-link">
        &larr; Back
      </Link>
      <h1>{season.name}</h1>
      <p className="subtitle">{season.season} season &middot; {teams.length} teams</p>

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
    </main>
  );
}
