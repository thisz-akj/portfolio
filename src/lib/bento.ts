/**
 * Desktop bento geometry for "Things I keep getting hired for".
 * 6 columns; tiles are placed explicitly so we know which tracks each one owns.
 *
 *   row 1:  A A A A B B
 *   row 2:  A A A A C C
 *   row 3:  D D E E F F
 *   row 4:  G G X X X X     (X = "Not on the list?" card, after "See more")
 *
 * Hovering a tile enlarges the column and row tracks it covers; every other tile
 * shares what's left. Because only fr values change, the browser can transition
 * grid-template-columns / grid-template-rows smoothly.
 */
export const COLS = 6;

/** [colStart, colEnd, rowStart, rowEnd] — CSS grid lines, end-exclusive */
export type Placement = [number, number, number, number];

export const PLACEMENTS: Placement[] = [
  [1, 5, 1, 3], // A — lead card
  [5, 7, 1, 2], // B
  [5, 7, 2, 3], // C
  [1, 3, 3, 4], // D
  [3, 5, 3, 4], // E
  [5, 7, 3, 4], // F
  [1, 3, 4, 5], // G
  [3, 7, 4, 5], // X — CTA card
];

export const GROW_COL = 1.9;
export const GROW_ROW = 1.7;

const track = (fr: number) => `minmax(0, ${Number(fr.toFixed(3))}fr)`;

/** Grid template strings for a given hovered tile (or none) and row count. */
export function bentoTracks(hovered: number | null, rows: number): { columns: string; rows: string } {
  const cols = Array<number>(COLS).fill(1);
  const rs = Array<number>(rows).fill(1);
  const p = hovered === null ? undefined : PLACEMENTS[hovered];
  if (p) {
    for (let c = p[0]; c < p[1]; c++) cols[c - 1] = GROW_COL;
    for (let r = p[2]; r < p[3] && r <= rows; r++) rs[r - 1] = GROW_ROW;
  }
  return { columns: cols.map(track).join(" "), rows: rs.map(track).join(" ") };
}

export const gridArea = (i: number) => {
  const p = PLACEMENTS[i];
  return p ? { column: `${p[0]} / ${p[1]}`, row: `${p[2]} / ${p[3]}` } : null;
};
