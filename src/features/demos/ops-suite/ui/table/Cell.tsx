import { formatDate, formatINR } from "../../lib/format";
import type { FieldMeta, Option } from "../../filters/types";

const numFmt = new Intl.NumberFormat("en-IN");

export function Pill({ option, value }: { option?: Option; value: string }) {
  return (
    <span className="ops-pill">
      {option?.color && <span className="ops-pill-dot" style={{ background: option.color }} aria-hidden="true" />}
      {option?.label ?? value}
    </span>
  );
}

/** Renders one cell value according to its field type. */
export function Cell({ field, row, options }: { field: FieldMeta; row: Record<string, unknown>; options?: Option[] }) {
  const v = row[field.key];
  if (v === null || v === undefined || v === "") return <span className="ops-null">—</span>;
  switch (field.type) {
    case "money": {
      const n = Number(v);
      return (
        <span title={formatINR(n, { paise: true })} className={n === 0 ? "ops-zero" : undefined}>
          {formatINR(n, { compact: true })}
        </span>
      );
    }
    case "number":
      return (
        <span className={Number(v) === 0 ? "ops-zero" : undefined}>
          {numFmt.format(Number(v))}
          {field.unit && <span className="ops-unit"> {field.unit}</span>}
        </span>
      );
    case "date":
      return <span title={String(v instanceof Date ? v.toISOString() : v)}>{formatDate(v as Date | string)}</span>;
    case "enum": {
      const o = (field.options ?? options)?.find((x) => x.value === String(v));
      return <Pill option={o} value={String(v)} />;
    }
    case "relation":
      return <span>{String(field.labelKey ? (row[field.labelKey] ?? v) : v)}</span>;
    case "tags": {
      const list = v as string[];
      if (!list.length) return <span className="ops-null">—</span>;
      return (
        <span className="ops-tags">
          {list.map((t) => {
            const o = options?.find((x) => x.value === t);
            return (
              <span key={t} className="ops-tag" style={o?.color ? { ["--tag" as string]: o.color } : undefined}>
                {t}
              </span>
            );
          })}
        </span>
      );
    }
    case "boolean":
      return <span>{v ? "Yes" : "No"}</span>;
    default:
      return field.primary ? <span className="ops-primary">{String(v)}</span> : <span>{String(v)}</span>;
  }
}
