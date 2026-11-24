"use client";

import { useId, useState } from "react";
import Link from "next/link";
import type { Point } from "../../data/dashboard";
import { formatINR } from "../../lib/format";

/**
 * Single-series bar charts in plain HTML (no chart library). One validated series colour (--viz-1),
 * thin marks with 4px rounded data-ends on the baseline, 2px gaps, recessive grid, a hover/focus tooltip
 * per bar, every bar a link to the filtered list, and a data-table toggle for screen readers and exact values.
 */

/** A "nice" axis maximum and tick step for 4 gridlines. */
export function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { max: 1, step: 0.25 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { max: step * ticks, step };
}

function DataTable({ id, title, points, valueLabel }: { id: string; title: string; points: Point[]; valueLabel: string }) {
  return (
    <details className="viz-table">
      <summary>Show data table</summary>
      <table aria-labelledby={id}>
        <caption className="ops-sr">{title}</caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            <th scope="col" className="is-end">
              {valueLabel}
            </th>
            <th scope="col">Detail</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td className="is-end">{formatINR(p.value)}</td>
              <td>{p.detail ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Vertical bars over time, e.g. monthly revenue. */
export function ColumnChart({ title, note, points, valueLabel = "Value" }: { title: string; note?: string; points: Point[]; valueLabel?: string }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const { max, step } = niceScale(Math.max(...points.map((p) => p.value)));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  return (
    <figure className="viz" aria-labelledby={id}>
      <figcaption id={id} className="viz-title">
        {title}
        {note && <span>{note}</span>}
      </figcaption>
      <div className="viz-cols" role="list" onPointerLeave={() => setActive(null)}>
        <div className="viz-grid" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${(t / max) * 100}%` }}>
              <em>{formatINR(t, { compact: true })}</em>
            </span>
          ))}
        </div>
        {points.map((p, i) => {
          const h = (p.value / max) * 100;
          const bar = (
            <span className="viz-col-bar" style={{ height: `${Math.max(h, p.value > 0 ? 1 : 0)}%` }} />
          );
          return (
            <div key={p.label} role="listitem" className={`viz-col${active === i ? " is-active" : ""}`} onPointerEnter={() => setActive(i)}>
              {p.href ? (
                <Link href={p.href} className="viz-hit" aria-label={`${p.label}: ${formatINR(p.value)}${p.detail ? `, ${p.detail}` : ""}`} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
                  {bar}
                </Link>
              ) : (
                <span className="viz-hit">{bar}</span>
              )}
              {active === i && (
                <span className="viz-tip" role="tooltip" style={{ bottom: `calc(${Math.min(h, 88)}% + 0.5rem)` }}>
                  <strong>{formatINR(p.value)}</strong>
                  <span>
                    {p.label.replace("*", "")}
                    {p.detail ? ` · ${p.detail}` : ""}
                  </span>
                </span>
              )}
              <span className="viz-col-label" aria-hidden="true">
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
      <DataTable id={id} title={title} points={points} valueLabel={valueLabel} />
    </figure>
  );
}

/** Horizontal bars for ranked or ordered categories (funnel, aging, top customers), value labelled at the end. */
export function BarList({ title, note, points, valueLabel = "Value" }: { title: string; note?: string; points: Point[]; valueLabel?: string }) {
  const id = useId();
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <figure className="viz" aria-labelledby={id}>
      <figcaption id={id} className="viz-title">
        {title}
        {note && <span>{note}</span>}
      </figcaption>
      <ul className="viz-bars">
        {points.map((p) => {
          const body = (
            <>
              <span className="viz-bar-label">{p.label}</span>
              <span className="viz-bar-track">
                <span className="viz-bar" style={{ width: `${Math.max((p.value / max) * 100, p.value > 0 ? 0.8 : 0)}%` }} />
              </span>
              <span className="viz-bar-value">
                {formatINR(p.value, { compact: true })}
                {p.detail && <em>{p.detail}</em>}
              </span>
            </>
          );
          return (
            <li key={p.label}>
              {p.href ? (
                <Link href={p.href} className="viz-bar-row" title={`${p.label}: ${formatINR(p.value)}${p.detail ? ` · ${p.detail}` : ""}`}>
                  {body}
                </Link>
              ) : (
                <span className="viz-bar-row">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
      <DataTable id={id} title={title} points={points} valueLabel={valueLabel} />
    </figure>
  );
}
