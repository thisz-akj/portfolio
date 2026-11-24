import { formatDate, formatINR } from "../lib/format";
import { DATE_PRESET_LABELS, NULLARY_OPS, OP_LABELS, fieldOf, type Condition, type DatePreset, type EntityMeta, type Option } from "./types";

/** Human-readable text for a filter chip, e.g. "Lifecycle is any of Customer, Churned". */
export function describeCondition(meta: EntityMeta, c: Condition, dynamic: Record<string, Option[]> = {}): { field: string; op: string; value: string } {
  const f = fieldOf(meta, c.field);
  const field = f?.label ?? c.field;
  const op = OP_LABELS[c.op] ?? c.op;
  if (!f || NULLARY_OPS.includes(c.op)) return { field, op, value: "" };
  const options = f.options ?? dynamic[f.key] ?? [];
  const label = (v: string | number) => options.find((o) => o.value === String(v))?.label ?? String(v);
  const one = (v: unknown) =>
    f.type === "money" ? formatINR(Number(v), { compact: true }) : f.type === "date" ? formatDate(String(v)) : f.type === "number" ? `${Number(v).toLocaleString("en-IN")}${f.unit ? ` ${f.unit}` : ""}` : String(v);
  const v = c.value;
  let value: string;
  if (c.op === "preset") value = DATE_PRESET_LABELS[v as DatePreset] ?? String(v);
  else if (c.op === "between" && Array.isArray(v)) value = `${one(v[0])} – ${one(v[1])}`;
  else if (Array.isArray(v)) {
    const labels = v.map(label);
    value = labels.length > 2 ? `${labels.slice(0, 2).join(", ")} +${labels.length - 2}` : labels.join(", ");
  } else value = one(v);
  return { field, op, value };
}
