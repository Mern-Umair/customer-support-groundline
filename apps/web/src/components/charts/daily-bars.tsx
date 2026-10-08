import type { DailyCount } from "@/lib/insights";

/**
 * Single-series bar chart (conversations per day) in plain SVG, server-rendered.
 * Follows the dataviz rules: one hue for one series (no legend needed), thin bars with
 * 4px rounded data-ends on the baseline, 2px gaps, recessive axis, a native hover
 * tooltip per bar, and a table view for accessibility.
 */
export function DailyBars({ data, label = "Conversations per day" }: { data: DailyCount[]; label?: string }) {
  const width = 640;
  const height = 140;
  const padLeft = 28;
  const padBottom = 20;
  const padTop = 8;
  const max = Math.max(1, ...data.map((d) => d.conversations));
  const plotW = width - padLeft - 4;
  const plotH = height - padBottom - padTop;
  const gap = 2;
  const barW = Math.max(2, plotW / data.length - gap);
  const ticks = max <= 4 ? [0, max] : [0, Math.ceil(max / 2), max];

  return (
    <figure className="m-0">
      <figcaption className="text-xs text-fg-muted">{label}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-auto w-full" role="img" aria-label={`${label}, last ${data.length} days`}>
        {ticks.map((t) => {
          const y = padTop + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padLeft} x2={width - 4} y1={y} y2={y} stroke="currentColor" className="text-border" strokeWidth={1} />
              <text x={padLeft - 6} y={y + 3} textAnchor="end" className="fill-fg-subtle" fontSize={10}>
                {t}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.conversations / max) * plotH;
          const x = padLeft + i * (barW + gap);
          const y = padTop + plotH - h;
          const r = Math.min(4, barW / 2, h);
          const path = h === 0 ? "" : `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`;
          return (
            <g key={d.day}>
              {/* Hit target larger than the mark. */}
              <rect x={x - gap / 2} y={padTop} width={barW + gap} height={plotH} fill="transparent">
                <title>{`${d.day}: ${d.conversations} conversation${d.conversations === 1 ? "" : "s"}${d.handoffs ? `, ${d.handoffs} handed to a human` : ""}`}</title>
              </rect>
              {path ? <path d={path} className="fill-accent" /> : null}
            </g>
          );
        })}
        {data.map((d, i) =>
          i === 0 || i === data.length - 1 || i % 7 === 0 ? (
            <text key={`l-${d.day}`} x={padLeft + i * (barW + gap) + barW / 2} y={height - 6} textAnchor="middle" className="fill-fg-subtle" fontSize={10}>
              {d.day.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
      <details className="mt-1">
        <summary className="cursor-pointer text-[11px] text-fg-subtle">Table view</summary>
        <table className="mt-1 w-full text-xs">
          <thead>
            <tr className="text-left text-fg-muted">
              <th className="py-0.5 font-medium">Day</th>
              <th className="py-0.5 font-medium">Conversations</th>
              <th className="py-0.5 font-medium">Handoffs</th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((d) => d.conversations || d.handoffs)
              .map((d) => (
                <tr key={d.day}>
                  <td className="py-0.5">{d.day}</td>
                  <td className="py-0.5 tabular-nums">{d.conversations}</td>
                  <td className="py-0.5 tabular-nums">{d.handoffs}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
