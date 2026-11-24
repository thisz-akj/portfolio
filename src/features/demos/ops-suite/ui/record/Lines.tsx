"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { editLinesAction } from "../../data/actions";
import type { LinesBlock } from "../../data/detail-types";
import { formatINR } from "../../lib/format";

/** Order lines with totals; on drafts, quantities/discounts are editable and products can be added or removed. */
export function Lines({ entity, id, block, onChanged }: { entity: string; id: number; block: LinesBlock; onChanged: (message: string, ok: boolean) => void }) {
  const [pending, start] = useTransition();
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [search, setSearch] = useState("");
  const so = block.kind === "so";

  const run = (op: Record<string, unknown>) =>
    start(async () => {
      const res = await editLinesAction(entity, id, op);
      onChanged(res.message, res.ok);
      if (res.ok && op.op === "add") {
        setProductId("");
        setQty("1");
        setSearch("");
      }
    });

  const products = (block.productOptions ?? []).filter((o) => !search || o.label.toLowerCase().includes(search.toLowerCase())).slice(0, 200);

  return (
    <section className="ops-related" aria-labelledby={`lines-${id}`}>
      <h3 id={`lines-${id}`}>
        Lines <span className="ops-count">{block.rows.length}</span>
      </h3>
      <div className="ops-scroll ops-lines-scroll">
        <table className="ops-table ops-lines">
          <thead>
            <tr>
              <th>Product</th>
              <th className="is-end">Qty</th>
              {!so && <th className="is-end">Received</th>}
              <th className="is-end">{so ? "Price" : "Unit cost"}</th>
              {so && <th className="is-end">Disc %</th>}
              <th className="is-end">GST</th>
              <th className="is-end">Amount</th>
              {block.editable && <th aria-label="Remove" />}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="ops-primary">{r.name}</span>
                  <span className="ops-line-sku">
                    {r.sku}
                    {so && r.available !== undefined && (
                      <em className={r.available < r.qty ? "is-short" : undefined}>
                        {" "}
                        · {r.available} available{r.available < r.qty ? " — short" : ""}
                      </em>
                    )}
                  </span>
                </td>
                <td className="is-end">
                  {block.editable ? (
                    <input
                      className="ops-num"
                      aria-label={`Quantity for ${r.sku}`}
                      inputMode="numeric"
                      defaultValue={r.qty}
                      disabled={pending}
                      onBlur={(e) => {
                        const q = Number(e.target.value);
                        if (q !== r.qty) run({ op: "update", lineId: r.id, qty: q, discountPct: r.discountPct ?? 0 });
                      }}
                    />
                  ) : (
                    r.qty.toLocaleString("en-IN")
                  )}
                </td>
                {!so && <td className="is-end">{r.qtyReceived?.toLocaleString("en-IN")}</td>}
                <td className="is-end">{formatINR(r.unitPrice, { paise: true })}</td>
                {so && (
                  <td className="is-end">
                    {block.editable ? (
                      <input
                        className="ops-num"
                        aria-label={`Discount for ${r.sku}`}
                        inputMode="decimal"
                        defaultValue={r.discountPct}
                        disabled={pending}
                        onBlur={(e) => {
                          const d = Number(e.target.value);
                          if (d !== r.discountPct) run({ op: "update", lineId: r.id, qty: r.qty, discountPct: d });
                        }}
                      />
                    ) : (
                      r.discountPct || "—"
                    )}
                  </td>
                )}
                <td className="is-end">{r.gstRate}%</td>
                <td className="is-end">{formatINR(r.lineTotal, { paise: true })}</td>
                {block.editable && (
                  <td>
                    <button type="button" className="ops-icon-btn" aria-label={`Remove ${r.sku}`} disabled={pending} onClick={() => run({ op: "remove", lineId: r.id })}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!block.rows.length && (
              <tr>
                <td colSpan={8} className="ops-null">
                  No lines yet{block.editable ? " — add a product below" : ""}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={so ? 5 : 5} className="is-end ops-dim">
                Subtotal · GST
              </td>
              <td colSpan={block.editable ? 2 : 1} className="is-end">
                {formatINR(block.subtotal, { compact: true })} · {formatINR(block.tax, { compact: true })}
              </td>
            </tr>
            <tr>
              <td colSpan={so ? 5 : 5} className="is-end ops-dim">
                Total incl. GST
              </td>
              <td colSpan={block.editable ? 2 : 1} className="is-end ops-total">
                {formatINR(block.total, { paise: true })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {block.editable && (
        <form
          className="ops-line-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (productId) run({ op: "add", productId: Number(productId), qty: Number(qty) });
          }}
        >
          <input type="search" aria-label="Search products" placeholder="Search SKU or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="Product" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Choose a product ({products.length})</option>
            {products.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input className="ops-num" aria-label="Quantity" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
          <button type="submit" className="ops-btn" disabled={!productId || pending}>
            <Plus size={14} /> Add
          </button>
        </form>
      )}
    </section>
  );
}
