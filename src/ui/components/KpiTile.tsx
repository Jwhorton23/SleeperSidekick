import { useState } from "react";
import { ordinal } from "../format";
import type { MetricKey } from "../metricInfo";
import { MetricInfoModal } from "./MetricInfoModal";

/**
 * One number with its name under it, tappable for the explanation.
 *
 * The tile owns its own modal so a page can drop tiles anywhere without
 * threading "which metric is open" state down to them — the dashboard
 * renders a grid of these per team.
 *
 * `rank` is this team's place in the league on the same number, shown next to
 * the label. The per-team cards replaced the league-wide sorted lists, so the
 * rank is what still answers "is that any good?".
 */
export function KpiTile({
  value,
  label,
  metric,
  rank,
}: {
  value: string;
  label: string;
  metric: MetricKey;
  rank?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="kpi-tile" onClick={() => setOpen(true)}>
        <span className="kpi-value">{value}</span>
        <span className="kpi-label">
          {label}
          {rank !== undefined && <span className="kpi-rank">{ordinal(rank)}</span>}
        </span>
      </button>
      {open && <MetricInfoModal metric={metric} onClose={() => setOpen(false)} />}
    </>
  );
}
