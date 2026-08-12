import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getNflState, getUserLeagues, resolveUsername } from "../../api/client";
import type { LeagueSummary } from "../../data/types";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; season: string; leagues: LeagueSummary[] };

export function LeaguePicker() {
  const { username = "" } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    async function load() {
      try {
        const user = await resolveUsername(username);
        if (!user) {
          if (!cancelled) setState({ status: "not-found" });
          return;
        }
        const { season } = await getNflState();
        const leagues = await getUserLeagues(user.userId, season);
        if (!cancelled) setState({ status: "ready", season, leagues });
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", message: err instanceof Error ? err.message : "Something went wrong." });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [username]);

  return (
    <main className="page">
      <Link to="/" className="back-link">
        &larr; Back
      </Link>
      <h1>{username}'s leagues</h1>

      {state.status === "loading" && <p className="subtitle">Loading leagues&hellip;</p>}

      {state.status === "not-found" && (
        <p className="error">No Sleeper user found for &ldquo;{username}&rdquo;. Check the spelling and try again.</p>
      )}

      {state.status === "error" && <p className="error">{state.message}</p>}

      {state.status === "ready" && state.leagues.length === 0 && (
        <p className="subtitle">No {state.season} leagues found for this user.</p>
      )}

      {state.status === "ready" && state.leagues.length > 0 && (
        <ul className="league-list">
          {state.leagues.map((league) => (
            <li key={league.leagueId}>
              <Link to={`/league/${league.leagueId}`} className="league-card league-card-link">
                <span className="league-name">{league.name}</span>
                <span className="league-meta">
                  {league.totalRosters} teams &middot; {league.season}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
