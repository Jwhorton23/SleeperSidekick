import { useState, type ReactNode } from "react";
import { METRIC_INFO, type MetricKey } from "../metricInfo";
import { MetricInfoModal } from "./MetricInfoModal";

/** The ⓘ affordance on its own, for places that aren't a card heading
 * (KPI tiles, section headers). Owns the modal it opens. */
export function InfoButton({ metric, label }: { metric: MetricKey; label?: string }) {
  const [open, setOpen] = useState(false);
  const info = METRIC_INFO[metric];

  return (
    <>
      <button
        type="button"
        className="info-button"
        onClick={() => setOpen(true)}
        aria-label={label ?? `What does ${info.title} mean?`}
      >
        i
      </button>
      {open && <MetricInfoModal metric={metric} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The shared shell every stat card uses: heading, the ⓘ that explains the
 * number, and the gray subtitle. Title and subtitle default to the glossary
 * entry so the card and its explanation can never drift apart; pass them
 * explicitly only when a card needs season-specific wording.
 */
export function StatCard({
  metric,
  title,
  subtitle,
  children,
}: {
  metric: MetricKey;
  title?: string;
  subtitle?: string | null;
  children: ReactNode;
}) {
  const info = METRIC_INFO[metric];

  return (
    <section className="stat-card">
      <div className="stat-card-header">
        <h2>{title ?? info.title}</h2>
        <InfoButton metric={metric} />
      </div>
      {subtitle !== null && <p className="stat-card-subtitle">{subtitle ?? info.subtitle}</p>}
      {children}
    </section>
  );
}
