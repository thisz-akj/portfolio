/**
 * The "edges land first · middle follows" curve from the reference site.
 *   t        = i / (n − 1)
 *   curve(t) = |cos(t × π)|   → 1 at the edges, 0 in the centre (U-shape)
 */
export function uCurve(i: number, n: number): number {
  const t = i / Math.max(n - 1, 1);
  return Math.abs(Math.cos(t * Math.PI));
}

/** Per-letter start offsets: startY(i) = min + (amp − min) × curve(t). */
export function arcOffsets(n: number, amp: number, min = 0): number[] {
  return Array.from({ length: n }, (_, i) => min + (amp - min) * uCurve(i, n));
}

/** Opacity of item i for a scrubbed reveal with a soft quadratic feather. */
export function featherOpacity(i: number, total: number, progress: number, floor: number, featherFrac: number): number {
  const feather = Math.max(total * featherFrac, 1);
  // The front travels past the last unit by the feather width, so at progress 1 every unit is fully lit.
  // (It used to stop at total + 1, leaving the last ~10% of words stuck near the floor — the About bio's
  // last two lines stayed dark.)
  const front = progress * (total + feather);
  const dist = front - i;
  if (dist <= 0) return floor;
  if (dist < feather) return floor + (1 - floor) * (dist / feather) ** 2;
  return 1;
}

export function splitGraphemes(text: string): string[] {
  return Array.from(text);
}
