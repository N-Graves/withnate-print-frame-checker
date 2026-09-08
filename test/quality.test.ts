import { describe, expect, it } from "vitest";
import { ALL_FRAMES, frameById } from "../src/frames.js";
import {
  assessFrame,
  assessFrames,
  bandFor,
  describeAspect,
  isLandscape,
  maxPrintAt,
  orientFrame,
} from "../src/quality.js";

describe("maxPrintAt", () => {
  it("matches the reference figure used elsewhere in this project", () => {

    const s = maxPrintAt({ width: 3600, height: 4800 }, 300);
    expect(s.widthIn).toBeCloseTo(12, 6);
    expect(s.heightIn).toBeCloseTo(16, 6);
  });

  it("gets bigger as the density drops", () => {
    const px = { width: 3000, height: 2000 };
    expect(maxPrintAt(px, 150).widthIn).toBeCloseTo(2 * maxPrintAt(px, 300).widthIn, 6);
  });
});

describe("bandFor", () => {
  it("puts each threshold on the right side of the line", () => {
    expect(bandFor(300)).toBe("excellent");
    expect(bandFor(299.9)).toBe("good");
    expect(bandFor(200)).toBe("good");
    expect(bandFor(199.9)).toBe("acceptable");
    expect(bandFor(150)).toBe("acceptable");
    expect(bandFor(149.9)).toBe("poor");
    expect(bandFor(0)).toBe("poor");
  });
});

describe("orientation", () => {
  it("turns the frame to match the image", () => {
    const a3 = frameById("a3")!;
    expect(orientFrame(a3, true).widthIn).toBeGreaterThan(orientFrame(a3, true).heightIn);
    expect(orientFrame(a3, false).heightIn).toBeGreaterThan(orientFrame(a3, false).widthIn);
  });

  it("treats a square image as landscape, which is arbitrary but harmless", () => {
    expect(isLandscape({ width: 800, height: 800 })).toBe(true);
  });
});

describe("assessFrame", () => {
  it("uses the limiting edge for density, not the flattering one", () => {

    const a = assessFrame({ width: 3000, height: 2000 }, frameById("a3")!);
    expect(a.dpi).toBeCloseTo(171.0, 0);
    expect(a.band).toBe("acceptable");
  });

  it("measures the crop when the aspects disagree", () => {

    const a = assessFrame({ width: 3000, height: 2000 }, frameById("8x6")!);
    expect(a.cropFraction).toBeCloseTo(1 - (4 / 3) / 1.5, 4);
    expect(a.cleanFit).toBe(false);
  });

  it("calls an A-series image in an A-series frame a clean fit", () => {

    for (const frame of ALL_FRAMES.filter((f) => f.family === "a-series")) {
      const a = assessFrame({ width: 2480, height: 3508 }, frame);
      expect(a.cleanFit).toBe(true);
      expect(a.cropFraction).toBeLessThan(0.01);
    }
  });

  it("calls a square image in a square frame a perfect fit", () => {
    const a = assessFrame({ width: 2000, height: 2000 }, frameById("12x12")!);
    expect(a.cropFraction).toBeCloseTo(0, 10);
    expect(a.cleanFit).toBe(true);
  });

  it("never reports a negative crop", () => {

    for (const frame of ALL_FRAMES) {
      for (const px of [
        { width: 4000, height: 3000 },
        { width: 3000, height: 4000 },
        { width: 5000, height: 1000 },
        { width: 1000, height: 1000 },
      ]) {
        expect(assessFrame(px, frame).cropFraction).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("assessFrames", () => {
  it("returns every frame, largest first", () => {
    const all = assessFrames({ width: 4000, height: 3000 }, ALL_FRAMES);
    expect(all).toHaveLength(ALL_FRAMES.length);
    for (let i = 1; i < all.length; i += 1) {
      const prev = all[i - 1]!.frame;
      const cur = all[i]!.frame;
      expect(prev.longIn * prev.shortIn).toBeGreaterThanOrEqual(cur.longIn * cur.shortIn);
    }
  });

  it("degrades the band as the frame grows", () => {
    const all = assessFrames({ width: 3000, height: 2000 }, ALL_FRAMES);
    expect(all[0]!.dpi).toBeLessThan(all[all.length - 1]!.dpi);
  });
});

describe("describeAspect", () => {
  it("names a common photo ratio and reports it exactly", () => {
    const d = describeAspect({ width: 3000, height: 2000 });
    expect(d.exact).toEqual([3, 2]);
    expect(d.exactIsUseful).toBe(true);
    expect(d.nearestName).toBe("3:2");
    expect(d.nearestError).toBeCloseTo(0, 6);
  });

  it("recognises the A-series ratio", () => {
    const d = describeAspect({ width: 2480, height: 3508 });
    expect(d.nearestName).toBe("A-series (1:√2)");
    expect(d.nearestError).toBeLessThan(0.005);
  });

  it("flags an exact ratio that is true but useless", () => {

    const d = describeAspect({ width: 2480, height: 3508 });
    expect(d.exact).toEqual([620, 877]);
    expect(d.exactIsUseful).toBe(false);
  });

  it("is orientation-independent in the name it picks", () => {
    expect(describeAspect({ width: 3000, height: 2000 }).nearestName).toBe(
      describeAspect({ width: 2000, height: 3000 }).nearestName,
    );
  });

  it("names a square", () => {
    expect(describeAspect({ width: 900, height: 900 }).nearestName).toBe("1:1 square");
  });
});
