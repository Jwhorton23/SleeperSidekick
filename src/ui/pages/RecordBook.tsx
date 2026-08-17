import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { loadLeagueHistory } from "../../api/client";
import { loadPlayerIndex } from "../../data/players";
import type { LeagueData, PlayerMeta, UserId } from "../../data/types";
import { careerRecords, headToHeadMatrix, type CareerRecord, type HeadToHeadRecord } from "../../stats/careerRecords";
import { careerDraftHitRates, type SeasonDraftPickGrade } from "../../stats/draftGrades";
import { faabEfficiency } from "../../stats/faabEfficiency";
import { seasonAwards } from "../../stats/seasonAwards";
import { StatCard } from "../components/StatCard";
import { ordinal, recordLabel } from "../format";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LeagueData; playerIndex: Map<string, PlayerMeta> };

export function RecordBook() {
  const { leagueId = "" } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    Promise.all([loadLeagueHistory(leagueId), loadPlayerIndex()])
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

  const data = state.status === "ready" ? state.data : null;
  // Both of these walk every game of every season, and four cards need them —
  // compute once here rather than per card.
  const records = useMemo(() => (data ? careerRecords(data) : new Map<UserId, CareerRecord>()), [data]);
  const h2h = useMemo(
    () => (data ? headToHeadMatrix(data) : new Map<UserId, Map<UserId, HeadToHeadRecord>>()),
    [data],
  );

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

  const seasons = [...state.data.seasons].reverse(); // oldest first, for display
  const managerName = (userId: UserId) => state.data.managers.get(userId)?.displayName ?? "Unknown manager";

  return (
    <main className="page">
      <Link to={`/league/${leagueId}`} className="back-link">
        &larr; Back
      </Link>
      <h1>{state.data.seasons[0]?.name ?? "Record Book"}</h1>
      <p className="subtitle">
        {seasons.length === 1 ? seasons[0].season : `${seasons[0].season}–${seasons.at(-1)!.season}`} record book
      </p>

      <SeasonAwardsCard data={state.data} playerIndex={state.playerIndex} managerName={managerName} />
      <CareerPointsCard records={records} managerName={managerName} />
      <ChampionshipsCard records={records} managerName={managerName} />
      <StreaksCard records={records} managerName={managerName} />
      <RivalriesCard h2h={h2h} managerName={managerName} />
      <DraftGradesCard data={state.data} playerIndex={state.playerIndex} managerName={managerName} />
      <FaabEfficiencyCard data={state.data} managerName={managerName} />
    </main>
  );
}

function SeasonAwardsCard({
  data,
  playerIndex,
  managerName,
}: {
  data: LeagueData;
  playerIndex: Map<string, PlayerMeta>;
  managerName: (id: UserId) => string;
}) {
  const latestSeason = data.seasons[0];
  if (!latestSeason || latestSeason.weeks.length === 0) return null;
  const awards = seasonAwards(latestSeason, playerIndex);
  if (awards.length === 0) return null;

  return (
    <StatCard metric="seasonAwards" title={`${latestSeason.season} Season Awards`}>
      <ul className="stat-list">
        {awards.map((award) => (
          <li key={award.key} className="stat-row">
            <span className="stat-row-name">{award.title}</span>
            <span className="stat-row-value">
              {managerName(award.userId)} &middot; {award.detail}
            </span>
          </li>
        ))}
      </ul>
    </StatCard>
  );
}

/** "12th WR taken, finished 3rd among them" — spelling out that the ranking is
 * against the other players at that position taken in the same draft, which is
 * the part of the hit-rate math nobody guesses correctly. */
function pickSummary(entry: SeasonDraftPickGrade, playerIndex: Map<string, PlayerMeta>, showSeason: boolean): string {
  const { pick, positionalDraftRank, positionalFinishRank } = entry.grade;
  const name = playerIndex.get(pick.playerId)?.name ?? "Unknown player";
  const season = showSeason ? ` (${entry.season})` : "";
  return `${name}${season} — ${ordinal(positionalDraftRank)} ${pick.position} taken, finished ${ordinal(positionalFinishRank)} among them`;
}

function DraftGradesCard({
  data,
  playerIndex,
  managerName,
}: {
  data: LeagueData;
  playerIndex: Map<string, PlayerMeta>;
  managerName: (id: UserId) => string;
}) {
  const rates = [...careerDraftHitRates(data).entries()]
    .filter(([, r]) => r.totalPicks > 0)
    .sort((a, b) => b[1].hitRate - a[1].hitRate);

  if (rates.length === 0) return null;
  const showSeason = data.seasons.length > 1;

  return (
    <StatCard metric="draftGrades">
      <ul className="stat-list">
        {rates.map(([userId, r]) => (
          <li key={userId} className="stat-row">
            <span className="stat-row-name">{managerName(userId)}</span>
            <span className="stat-row-value">
              {r.hits} of {r.totalPicks} picks hit &middot; {Math.round(r.hitRate * 100)}%
            </span>
            {(r.bestPick || r.worstPick) && (
              <details className="row-details">
                <summary>Best and worst pick</summary>
                <div className="row-details-body">
                  {r.bestPick && <span>Best: {pickSummary(r.bestPick, playerIndex, showSeason)}</span>}
                  {r.worstPick && <span>Worst: {pickSummary(r.worstPick, playerIndex, showSeason)}</span>}
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </StatCard>
  );
}

function FaabEfficiencyCard({ data, managerName }: { data: LeagueData; managerName: (id: UserId) => string }) {
  if (!data.seasons.some((s) => s.usesFaab)) return null;

  const totals = new Map<UserId, { spent: number; gained: number }>();
  for (const season of data.seasons) {
    if (!season.usesFaab) continue;
    for (const [rosterId, entry] of faabEfficiency(season)) {
      const ownerId = season.teams.get(rosterId)?.ownerId;
      if (!ownerId) continue;
      const running = totals.get(ownerId) ?? { spent: 0, gained: 0 };
      running.spent += entry.totalSpent;
      running.gained += entry.totalPointsGained;
      totals.set(ownerId, running);
    }
  }

  const rows = [...totals.entries()]
    .filter(([, t]) => t.spent > 0)
    .map(([userId, t]) => ({ userId, ...t, perDollar: t.gained / t.spent }))
    .sort((a, b) => b.perDollar - a.perDollar);

  if (rows.length === 0) return null;

  return (
    <StatCard metric="faabEfficiency">
      <ul className="stat-list">
        {rows.map((row) => (
          <li key={row.userId} className="stat-row">
            <span className="stat-row-name">{managerName(row.userId)}</span>
            <span className="stat-row-value">
              {row.perDollar.toFixed(2)} pts/$ &middot; ${row.spent} spent
            </span>
          </li>
        ))}
      </ul>
    </StatCard>
  );
}

function CareerPointsCard({
  records,
  managerName,
}: {
  records: Map<UserId, CareerRecord>;
  managerName: (id: UserId) => string;
}) {
  const rows = [...records.values()].sort((a, b) => b.careerPoints - a.careerPoints);

  return (
    <StatCard metric="careerPoints">
      <ul className="stat-list">
        {rows.map((r) => (
          <li key={r.userId} className="stat-row">
            <span className="stat-row-name">{managerName(r.userId)}</span>
            <span className="stat-row-value">
              {r.careerPoints.toFixed(1)} pts &middot; {r.seasonsPlayed.length}{" "}
              {r.seasonsPlayed.length === 1 ? "season" : "seasons"}
            </span>
          </li>
        ))}
      </ul>
    </StatCard>
  );
}

function ChampionshipsCard({
  records,
  managerName,
}: {
  records: Map<UserId, CareerRecord>;
  managerName: (id: UserId) => string;
}) {
  const rows = [...records.values()]
    .filter((r) => r.championships.length > 0)
    .sort((a, b) => b.championships.length - a.championships.length);

  if (rows.length === 0) return null;

  return (
    <StatCard metric="championships">
      <ul className="stat-list">
        {rows.map((r) => (
          <li key={r.userId} className="stat-row">
            <span className="stat-row-name">{managerName(r.userId)}</span>
            <span className="stat-row-value">
              {r.championships.length}x &middot; {r.championships.join(", ")}
            </span>
          </li>
        ))}
      </ul>
    </StatCard>
  );
}

function StreaksCard({
  records,
  managerName,
}: {
  records: Map<UserId, CareerRecord>;
  managerName: (id: UserId) => string;
}) {
  const rows = [...records.values()].sort((a, b) => b.longestWinStreak - a.longestWinStreak);

  return (
    <StatCard metric="winStreak">
      <ul className="stat-list">
        {rows.map((r) => (
          <li key={r.userId} className="stat-row">
            <span className="stat-row-name">{managerName(r.userId)}</span>
            <span className="stat-row-value">{r.longestWinStreak} straight wins</span>
          </li>
        ))}
      </ul>
    </StatCard>
  );
}

function RivalriesCard({
  h2h,
  managerName,
}: {
  h2h: Map<UserId, Map<UserId, HeadToHeadRecord>>;
  managerName: (id: UserId) => string;
}) {
  const rows = [...h2h.entries()]
    .map(([userId, opponents]) => {
      let best: ({ opponentId: UserId } & HeadToHeadRecord) | null = null;
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
    <StatCard metric="rivalries">
      <ul className="stat-list">
        {rows.map((row) => (
          <li key={row.userId} className="stat-row">
            <span className="stat-row-name">{managerName(row.userId)}</span>
            <span className="stat-row-value">
              vs {managerName(row.opponentId)}: {recordLabel(row)}
            </span>
          </li>
        ))}
      </ul>
    </StatCard>
  );
}
