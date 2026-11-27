import { describe, expect, it } from "vitest";
import { arcOffsets, featherOpacity, uCurve } from "@/lib/curve";

describe("uCurve", () => {
  it("is 1 at the edges and 0 in the centre", () => {
    expect(uCurve(0, 5)).toBeCloseTo(1);
    expect(uCurve(4, 5)).toBeCloseTo(1);
    expect(uCurve(2, 5)).toBeCloseTo(0);
  });
  it("handles a single letter", () => {
    expect(uCurve(0, 1)).toBeCloseTo(1);
  });
});

describe("arcOffsets", () => {
  it("interpolates between min (centre) and amp (edges)", () => {
    const o = arcOffsets(5, -40, -12);
    expect(o[0]).toBeCloseTo(-40);
    expect(o[2]).toBeCloseTo(-12);
  });
});

describe("featherOpacity", () => {
  it("is the floor before the front and 1 well behind it", () => {
    expect(featherOpacity(10, 20, 0, 0.12, 0.1)).toBe(0.12);
    expect(featherOpacity(0, 20, 1, 0.12, 0.1)).toBe(1);
  });
  it("increases monotonically with progress", () => {
    const a = featherOpacity(10, 20, 0.5, 0.1, 0.2);
    const b = featherOpacity(10, 20, 0.55, 0.1, 0.2);
    expect(b).toBeGreaterThanOrEqual(a);
  });
});

describe("featherOpacity end state", () => {
  it("lights every unit fully at progress 1 (the last ~10% used to stay near the floor)", () => {
    for (const total of [5, 40, 216]) {
      for (let i = 0; i < total; i++) expect(featherOpacity(i, total, 1, 0.15, 0.1)).toBe(1);
    }
  });
  it("still starts every unit at the floor", () => {
    expect(featherOpacity(0, 216, 0, 0.15, 0.1)).toBe(0.15);
  });
});
