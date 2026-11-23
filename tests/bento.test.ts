import { describe, expect, it } from "vitest";
import { bentoTracks, COLS, PLACEMENTS } from "@/lib/bento";

describe("bentoTracks", () => {
  it("is an even grid when nothing is hovered", () => {
    const t = bentoTracks(null, 3);
    expect(t.columns.split("minmax").length - 1).toBe(COLS);
    expect(t.columns).not.toContain("1.9fr");
    expect(t.rows.split("minmax").length - 1).toBe(3);
  });
  it("grows only the hovered tile's tracks", () => {
    const t = bentoTracks(1, 3); // B: cols 5–6, row 1
    const cols = t.columns.match(/[\d.]+fr/g)!;
    expect(cols.slice(4)).toEqual(["1.9fr", "1.9fr"]);
    expect(cols.slice(0, 4)).toEqual(["1fr", "1fr", "1fr", "1fr"]);
    expect(t.rows.match(/[\d.]+fr/g)).toEqual(["1.7fr", "1fr", "1fr"]);
  });
  it("keeps the same number of tracks in every state (so it can animate)", () => {
    for (let i = 0; i < PLACEMENTS.length; i++) {
      expect(bentoTracks(i, 4).columns.split(" minmax").length).toBe(COLS);
      expect(bentoTracks(i, 4).rows.split(" minmax").length).toBe(4);
    }
  });
  it("tiles cover the grid without overlapping", () => {
    const cells = new Set<string>();
    for (const [c0, c1, r0, r1] of PLACEMENTS)
      for (let c = c0; c < c1; c++)
        for (let r = r0; r < r1; r++) {
          const k = `${c},${r}`;
          expect(cells.has(k)).toBe(false);
          cells.add(k);
        }
    expect(cells.size).toBe(COLS * 4);
  });
});
