"use client";

import Link from "next/link";
import { ArrowRightLeft, CircleDot, ExternalLink, Mail, Pencil, Phone, SquareCheck, StickyNote, Users } from "lucide-react";
import type { RecordDetail, TimelineItem } from "../../data/detail-types";
import { getEntityMeta } from "../../entities";
import { formatDate } from "../../lib/format";
import { PORTAL_BASE } from "../../nav";
import { Cell, Pill } from "../table/Cell";

const KIND_ICON = { call: Phone, email: Mail, meeting: Users, note: StickyNote, task: SquareCheck, audit: CircleDot } as const;
const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Read-only record view shared by the drawer and the full page. */
export function RecordView({
  detail,
  onEdit,
  onConvert,
  onNavigate,
  showOpenLink = true,
}: {
  detail: RecordDetail;
  onEdit: () => void;
  onConvert?: () => void;
  /** open a related record (drawer); falls back to normal navigation */
  onNavigate?: (entity: string, id: number) => void;
  showOpenLink?: boolean;
}) {
  const meta = getEntityMeta(detail.entity)!;
  const statusField = meta.fields.find((f) => f.key === meta.bulk?.enums?.[0]);
  const statusValue = statusField ? String(detail.row[statusField.key]) : null;
  const fields = meta.fields.filter((f) => !f.primary && f.key !== statusField?.key && f.type !== "tags");
  const tagsField = meta.fields.find((f) => f.type === "tags");
  const tags = (tagsField ? (detail.row[tagsField.key] as string[]) : []) ?? [];

  return (
    <article className="ops-record">
      <header className="ops-record-head">
        <p className="ops-eyebrow">{meta.singular}</p>
        <h2>{detail.title}</h2>
        <div className="ops-record-badges">
          {statusField && statusValue && <Pill option={statusField.options?.find((o) => o.value === statusValue)} value={statusValue} />}
          {tags.length > 0 && tagsField && <Cell field={tagsField} row={detail.row} options={detail.options[tagsField.key]} />}
        </div>
        <div className="ops-record-actions">
          <button type="button" className="ops-btn" onClick={onEdit}>
            <Pencil size={14} /> Edit
          </button>
          {onConvert && (
            <button type="button" className="ops-btn" onClick={onConvert}>
              <ArrowRightLeft size={14} /> Convert lead
            </button>
          )}
          {showOpenLink && (
            <Link className="ops-btn is-ghost" href={`${PORTAL_BASE}/${detail.entity}/${detail.id}`}>
              <ExternalLink size={14} /> Open page
            </Link>
          )}
        </div>
      </header>

      <dl className="ops-fields">
        {fields.map((f) => (
          <div key={f.key} title={f.description}>
            <dt>{f.label}</dt>
            <dd>
              <Cell field={f} row={detail.row} options={detail.options[f.key]} />
            </dd>
          </div>
        ))}
      </dl>

      {detail.sections.map((s) => (
        <section key={s.key} className="ops-related" aria-labelledby={`rel-${s.key}`}>
          <h3 id={`rel-${s.key}`}>
            {s.title} <span className="ops-count">{s.total}</span>
            {s.viewAll && s.total > s.items.length && (
              <Link href={s.viewAll} className="ops-link">
                View all
              </Link>
            )}
          </h3>
          {s.items.length ? (
            <ul>
              {s.items.map((it) => {
                const body = (
                  <>
                    <span className="ops-related-main">
                      <strong>{it.title}</strong>
                      {it.subtitle && <span>{it.subtitle}</span>}
                    </span>
                    {it.meta && <span className="ops-related-meta">{it.meta}</span>}
                    {it.badge && <Pill option={{ value: it.badge.label, label: it.badge.label, color: it.badge.color }} value={it.badge.label} />}
                  </>
                );
                if (!it.href) return <li key={it.id} className="ops-related-item">{body}</li>;
                const [, entity] = it.href.replace(PORTAL_BASE, "").split("/");
                return (
                  <li key={it.id}>
                    <Link
                      href={it.href}
                      className="ops-related-item is-link"
                      onClick={(e) => {
                        if (!onNavigate || e.metaKey || e.ctrlKey || e.shiftKey) return;
                        e.preventDefault();
                        onNavigate(entity, it.id);
                      }}
                    >
                      {body}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ops-null">{s.empty ?? "Nothing here yet"}</p>
          )}
        </section>
      ))}

      <section className="ops-timeline" aria-labelledby="tl-title">
        <h3 id="tl-title">Timeline</h3>
        {detail.timeline.length ? (
          <ol>
            {detail.timeline.map((t) => (
              <TimelineRow key={t.id} item={t} />
            ))}
          </ol>
        ) : (
          <p className="ops-null">No activity yet</p>
        )}
      </section>
    </article>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <li className={`ops-tl is-${item.kind}${item.pending ? " is-pending" : ""}`}>
      <span className="ops-tl-icon" aria-hidden="true">
        <Icon size={13} />
      </span>
      <div>
        <p>{item.title}</p>
        <p className="ops-tl-meta">
          {item.pending && item.due ? <strong>Due {formatDate(item.due)}</strong> : <time dateTime={item.at}>{dateTime.format(new Date(item.at))}</time>}
          {item.actor && ` · ${item.actor}`}
          {item.kind !== "audit" && ` · ${item.kind}`}
        </p>
      </div>
    </li>
  );
}
