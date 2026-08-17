import { useEffect, useRef } from "react";
import { METRIC_INFO, type MetricKey } from "../metricInfo";

/**
 * Explains one metric in plain English. Built on the native <dialog> element
 * so Esc-to-close, focus trapping and the inert backdrop come from the
 * browser rather than from us.
 */
export function MetricInfoModal({ metric, onClose }: { metric: MetricKey; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const info = METRIC_INFO[metric];

  // Read through a ref so the effect below can run once on mount without
  // caring that callers pass a fresh arrow function every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    // React doesn't route <dialog>'s native `close` event through its
    // synthetic system, so an Esc press would dismiss the dialog while our
    // state still believed it was open — leaving the ⓘ button dead until
    // something else forced a re-render. Listen for it directly.
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener("close", handleClose);

    // Only the listener needs undoing: React removes the element on unmount,
    // which drops it out of the top layer on its own. Calling close() here
    // instead would queue a close event that StrictMode's remount picks up,
    // slamming the dialog shut the instant it opens.
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  // Clicks land on the <dialog> itself only when they hit the backdrop —
  // anything inside the content box is caught by that element instead.
  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === ref.current) onClose();
  }

  return (
    <dialog className="metric-info" ref={ref} onClick={handleClick} aria-labelledby="metric-info-title">
      <div className="metric-info-body">
        <div className="metric-info-header">
          <h3 id="metric-info-title">{info.title}</h3>
          <button type="button" className="metric-info-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <p className="metric-info-lede">{info.subtitle}</p>

        <h4>How it's calculated</h4>
        <ul>
          {info.howItWorks.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <h4>How to read it</h4>
        <p>{info.readingIt}</p>

        <p className="metric-info-counts">{info.counts}</p>
      </div>
    </dialog>
  );
}
