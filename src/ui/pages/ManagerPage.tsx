import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { loadLeagueHistory } from "../../api/client";
import { loadPlayerIndex } from "../../data/players";
import type { LeagueData, PlayerMeta, RosterId, Season, UserId } from "../../data/types";
import { careerRecords, headToHeadMatrix, type HeadToHeadRecord } from "../../stats/careerRecords";
import { careerDraftHitRates } from "../../stats/draftGrades";
import { faabEfficiency } from "../../stats/faabEfficiency";
import { luckIndex } from "../../stats/luckIndex";
import { powerRankings } from "../../stats/powerRankings";
import { teamLog, teamSeasonTotals } from "../../stats/teamLog";
import { MetricInfoModal } from "../components/MetricInfoModal";
import { StatCard } from "../components/StatCard";
import { ordinal, recordLabel, signed } from "../format";
import type { MetricKey } from "../metricInfo";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LeagueData; playerIndex: Map<string, PlayerMeta> };

/** The roster this manager owned in a given season, if they were in it. */
function rosterOf(season: Season, userId: UserId): RosterId | null {
  for (const team of season.teams.values()) {
    if (team.ownerId === userId) return team.rosterId;
  }
  return null;
}

export function ManagerPage() {
  const { leagueId = "", userId = "" } = useParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);

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

  // Seasons this manager actually played in, newest first.
  const seasons = useMemo(() => (data ? data.seasons.filter((s) => rosterOf(s, userId) !== null) : []), [data, userId]);

  const season = useMemo(() => {
    if (seasons.length === 0) return null;
    if (selectedSeason) return seasons.find((s) => s.season === selectedSeason) ?? seasons[0];
    // Default to the newest season that has games in it — in the preseason
    // window the newest season is empty, and an empty page is a bad landing.
    return seasons.find((s) => s.weeks.length > 0) ?? seasons[0];
  }, [seasons, selectedSeason]);

  if (state.status === "loading") {
    return (
      <main className="page">
        <p className="subtitle">Loading manager history&hellip;</p>
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

  const manager = state.data.managers.get(userId);
  if (!manager || !season) {
    return (
      <main className="page">
        <Link to={`/league/${leagueId}`} className="back-link">
          &larr; Back to league
        </Link>
        <p className="error">This manager isn't in any season of this league.</p>
      </main>
    );
  }

  const rosterId = rosterOf(season, userId)!;
  const teamName = season.teams.get(rosterId)?.name ?? manager.displayName;
  const opponentName = (id: RosterId) => season.teams.get(id)?.name ?? `Team ${id}`;
  const managerName = (id: UserId) => state.data.managers.get(id)?.displayName ?? "Unknown manager";

  return (
    <main className="page">
      <Link to={`/league/${leagueId}`} className="back-link">
        &larr; Back to league
      </Link>

      <div className="manager-header">
        {manager.avatar && (
          <img
            className="manager-avatar"
            src={`https://sleepercdn.com/avatars/thumbs/${manager.avatar}`}
            alt=""
            width={48}
            height={48}
          />
        )}
        <div>
          <h1>{manager.displayName}</h1>
          <p className="subtitle" style={{ margin: 0 }}>
            {teamName}
          </p>
        </div>
      </div>

      {seasons.length > 1 && (
        <div className="season-pills">
          {seasons.map((s) => (
            <button
              key={s.season}
              type="button"
              className="season-pill"
              aria-pressed={s.season === season.season}
              onClick={() => setSelectedSeason(s.season)}
            >
              {s.season}
            </button>
          ))}
        </div>
      )}

      <SeasonSection
        season={season}
        rosterId={rosterId}
        playerIndex={state.playerIndex}
        opponentName={opponentName}
        onExplain={setActiveMetric}
      />

      <CareerSection data={state.data} userId={userId} playerIndex={state.playerIndex} managerName={managerName} />

      {activeMetric && <MetricInfoModal metric={activeMetric} onClose={() => setActiveMetric(null)} />}
    </main>
  );
}

function KpiTile({ value, label, metric, onExplain }: { value: string; label: string; metric: MetricKey; onExplain: (m: MetricKey) => void }) {
  return (
    <button type="button" className="kpi-tile" onClick={() => onExplain(metric)}>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
    </button>
  );
}

function SeasonSection({
  season,
  rosterId,
  playerIndex,
  opponentName,
  onExplain,
}: {
  season: Season;
  rosterId: RosterId;
  playerIndex: Map<string, PlayerMeta>;
  opponentName: (id: RosterId) => string;
  onExplain: (metric: MetricKey) => void;
}) {
  const log = useMemo(() => teamLog(season, rosterId, playerIndex), [season, rosterId, playerIndex]);
  const totals = useMemo(() => teamSeasonTotals(log), [log]);
  const luck = useMemo(() => luckIndex(season).get(rosterId), [season, rosterId]);
  const power = useMemo(() => powerRankings(season).find((entry) => entry.rosterId === rosterId), [season, rosterId]);

  if (log.length === 0) {
    return (
      <>
        <h2 className="section-heading">{season.season} season</h2>
        <p className="subtitle">No completed weeks in this season yet.</p>
      </>
    );
  }

  return (
    <>
      <h2 className="section-heading">{season.season} season</h2>

      <div className="kpi-grid">
        {luck && <KpiTile value={recordLabel(luck.record)} label="Record" metric="record" onExplain={onExplain} />}
        <KpiTile value={totals.pointsFor.toFixed(1)} label="Points for" metric="pointsFor" onExplain={onExplain} />
        <KpiTile
          value={totals.pointsAgainst.toFixed(1)}
          label="Points against"
          metric="pointsAgainst"
          onExplain={onExplain}
        />
        {luck && (
          <KpiTile value={recordLabel(luck.allPlayRecord)} label="All-play" metric="allPlay" onExplain={onExplain} />
        )}
        {luck && <KpiTile value={signed(luck.luck)} label="Luck (wins)" metric="luck" onExplain={onExplain} />}
        {power && (
          <KpiTile value={`#${power.rank}`} label={`Power ${signed(power.score)}`} metric="powerRankings" onExplain={onExplain} />
        )}
        <KpiTile
          value={totals.pointsLeftOnBench.toFixed(1)}
          label="Left on bench"
          metric="coachingEfficiency"
          onExplain={onExplain}
        />
        {totals.bestWeek && (
          <KpiTile
            value={totals.bestWeek.points.toFixed(1)}
            label={`Best (wk ${totals.bestWeek.week})`}
            metric="bestWorstWeek"
            onExplain={onExplain}
          />
        )}
        {totals.worstWeek && (
          <KpiTile
            value={totals.worstWeek.points.toFixed(1)}
            label={`Worst (wk ${totals.worstWeek.week})`}
            metric="bestWorstWeek"
            onExplain={onExplain}
          />
        )}
      </div>

      <StatCard metric="weekLog">
        <ul className="stat-list">
          {log.map((entry) => (
            <li key={entry.week} className="stat-row">
              <span className="stat-row-name">
                Week {entry.week}
                {entry.result && (
                  <span className={`stat-row-badge ${entry.result === "L" ? "badge-negative" : "badge-positive"}`}>
                    {" "}
                    {entry.result}
                  </span>
                )}
              </span>
              <span className="stat-row-value">
                {entry.opponentPoints === null || entry.opponentRosterId === null
                  ? `${entry.points.toFixed(1)} · no opponent`
                  : `${entry.points.toFixed(1)}–${entry.opponentPoints.toFixed(1)} vs ${opponentName(entry.opponentRosterId)}`}
              </span>
              <span className="stat-row-note">
                Outscored {entry.allPlayWins} of {entry.allPlayGames} other teams
                {entry.pointsLeftOnBench > 0 && ` · ${entry.pointsLeftOnBench.toFixed(1)} left on bench`}
                {entry.topStarter && ` · top: ${entry.topStarter.name} ${entry.topStarter.points.toFixed(1)}`}
              </span>
            </li>
          ))}
        </ul>
      </StatCard>
    </>
  );
}

function CareerSection({
  data,
  userId,
  playerIndex,
  managerName,
}: {
  data: LeagueData;
  userId: UserId;
  playerIndex: Map<string, PlayerMeta>;
  managerName: (id: UserId) => string;
}) {
  const career = useMemo(() => careerRecords(data).get(userId), [data, userId]);
  const opponents = useMemo(() => headToHeadMatrix(data).get(userId), [data, userId]);
  const draft = useMemo(() => careerDraftHitRates(data).get(userId), [data, userId]);

  const faab = useMemo(() => {
    let spent = 0;
    let gained = 0;
    for (const season of data.seasons) {
      if (!season.usesFaab) continue;
      const rosterId = rosterOf(season, userId);
      if (rosterId === null) continue;
      const entry = faabEfficiency(season).get(rosterId);
      if (!entry) continue;
      spent += entry.totalSpent;
      gained += entry.totalPointsGained;
    }
    return spent > 0 ? { spent, gained, perDollar: gained / spent } : null;
  }, [data, userId]);

  // The all-time W-L isn't stored anywhere — it's the head-to-head row summed
  // across every opponent this manager has ever faced.
  const allTime = useMemo(() => {
    const total: HeadToHeadRecord = { wins: 0, losses: 0, ties: 0 };
    for (const record of opponents?.values() ?? []) {
      total.wins += record.wins;
      total.losses += record.losses;
      total.ties += record.ties;
    }
    return total;
  }, [opponents]);

  if (!career) return null;

  const h2hRows = [...(opponents?.entries() ?? [])].sort(
    (a, b) => b[1].wins - b[1].losses - (a[1].wins - a[1].losses),
  );

  return (
    <>
      <h2 className="section-heading">Career</h2>

      <ul className="stat-list">
        <li className="stat-row">
          <span className="stat-row-name">All-time record</span>
          <span className="stat-row-value">
            {recordLabel(allTime)} across {career.seasonsPlayed.length}{" "}
            {career.seasonsPlayed.length === 1 ? "season" : "seasons"}
          </span>
        </li>
        <li className="stat-row">
          <span className="stat-row-name">Career points</span>
          <span className="stat-row-value">{career.careerPoints.toFixed(1)} pts</span>
        </li>
        <li className="stat-row">
          <span className="stat-row-name">Championships</span>
          <span className="stat-row-value">
            {career.championships.length === 0 ? "None yet" : `${career.championships.length}x · ${career.championships.join(", ")}`}
          </span>
        </li>
        <li className="stat-row">
          <span className="stat-row-name">Longest streaks</span>
          <span className="stat-row-value">
            {career.longestWinStreak} wins &middot; {career.longestLossStreak} losses
          </span>
        </li>
        {draft && draft.totalPicks > 0 && (
          <li className="stat-row">
            <span className="stat-row-name">Draft hit rate</span>
            <span className="stat-row-value">
              {draft.hits} of {draft.totalPicks} picks &middot; {Math.round(draft.hitRate * 100)}%
            </span>
            {draft.bestPick && (
              <span className="stat-row-note">
                Best pick: {playerIndex.get(draft.bestPick.grade.pick.playerId)?.name ?? "Unknown player"} —{" "}
                {ordinal(draft.bestPick.grade.positionalDraftRank)} {draft.bestPick.grade.pick.position} taken, finished{" "}
                {ordinal(draft.bestPick.grade.positionalFinishRank)} among them
              </span>
            )}
          </li>
        )}
        {faab && (
          <li className="stat-row">
            <span className="stat-row-name">FAAB return</span>
            <span className="stat-row-value">
              {faab.perDollar.toFixed(2)} pts/$ &middot; ${faab.spent} spent
            </span>
          </li>
        )}
      </ul>

      {h2hRows.length > 0 && (
        <StatCard metric="headToHead">
          <ul className="stat-list">
            {h2hRows.map(([opponentId, record]) => (
              <li key={opponentId} className="stat-row">
                <span className="stat-row-name">vs {managerName(opponentId)}</span>
                <span className="stat-row-value">{recordLabel(record)}</span>
              </li>
            ))}
          </ul>
        </StatCard>
      )}
    </>
  );
}
