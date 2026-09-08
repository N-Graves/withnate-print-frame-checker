import { describe, expect, it } from "vitest";
import { inchesToMm } from "@nasdigitaluk/withnate-tool-core";
import { A_SERIES, ALL_FRAMES, IMPERIAL, SQUARE, frameById, frameRatio } from "../src/frames.js";

describe("the catalogue", () => {
  it("is the three families and nothing else", () => {
    expect(ALL_FRAMES).toHaveLength(A_SERIES.length + IMPERIAL.length + SQUARE.length);
  });

  it("has no duplicate ids", () => {
    const ids = ALL_FRAMES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stores every frame short edge first", () => {
    for (const f of ALL_FRAMES) expect(f.shortIn).toBeLessThanOrEqual(f.longIn);
  });

  it("labels every frame", () => {
    for (const f of ALL_FRAMES) expect(f.label.length).toBeGreaterThan(0);
  });

  it("finds a frame by id and returns undefined for one that does not exist", () => {
    expect(frameById("a4")?.label).toBe("A4");
    expect(frameById("a9")).toBeUndefined();
  });
});

describe("A-series", () => {
  it("matches ISO 216 to the millimetre", () => {

    const expected: Record<string, [number, number]> = {
      a6: [105, 148],
      a5: [148, 210],
      a4: [210, 297],
      a3: [297, 420],
      a2: [420, 594],
      a1: [594, 841],
      a0: [841, 1189],
    };
    for (const [id, [short, long]] of Object.entries(expected)) {
      const f = frameById(id)!;
      expect(inchesToMm(f.shortIn)).toBeCloseTo(short, 6);
      expect(inchesToMm(f.longIn)).toBeCloseTo(long, 6);
    }
  });

  it("shares one ratio across every size", () => {

    for (const f of A_SERIES) expect(frameRatio(f)).toBeCloseTo(Math.SQRT2, 2);
  });

  it("doubles in area at each step down the series", () => {
    for (let i = 1; i < A_SERIES.length; i += 1) {
      const smaller = A_SERIES[i - 1]!;
      const larger = A_SERIES[i]!;
      const ratio = (larger.shortIn * larger.longIn) / (smaller.shortIn * smaller.longIn);
      expect(ratio).toBeCloseTo(2, 1);
    }
  });
});

describe("imperial", () => {
  it("stores whole inches, because that is how they are defined", () => {
    for (const f of IMPERIAL) {
      expect(Number.isInteger(f.shortIn)).toBe(true);
      expect(Number.isInteger(f.longIn)).toBe(true);
    }
  });

  it("does not share a single ratio, unlike the A-series", () => {

    const ratios = new Set(IMPERIAL.map((f) => frameRatio(f).toFixed(3)));
    expect(ratios.size).toBeGreaterThan(1);
  });
});

describe("square", () => {
  it("is square", () => {
    for (const f of SQUARE) expect(frameRatio(f)).toBe(1);
  });
});
