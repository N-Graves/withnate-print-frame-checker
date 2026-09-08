import { describe, expect, it } from "vitest";
import { inchesToMm, mmToInches } from "@nasdigitaluk/withnate-tool-core";
import {
  MAT_OVERLAP_IN,
  RABBET_IN,
  fitPrintInFrame,
  frameOutsideSize,
  largestPrintForBorder,
  type SizeIn,
} from "../src/geometry.js";
import { ALL_FRAMES, frameById } from "../src/frames.js";

const size = (wMm: number, hMm: number): SizeIn => ({
  widthIn: mmToInches(wMm),
  heightIn: mmToInches(hMm),
});

const A4 = size(210, 297);
const A3 = size(297, 420);

describe("fitPrintInFrame", () => {
  it("gives A4 in an A3 frame a side border of 48mm and a top border of 66mm", () => {

    const fit = fitPrintInFrame(A4, A3);
    expect(inchesToMm(fit.borderSideIn)).toBeCloseTo(47.6, 1);
    expect(inchesToMm(fit.borderTopIn)).toBeCloseTo(65.6, 1);
    expect(fit.fits).toBe(true);
    expect(fit.mounted).toBe(true);
  });

  it("reports that border as NOT uniform", () => {

    expect(fitPrintInFrame(A4, A3).uniform).toBe(false);
  });

  it("cuts the aperture smaller than the paper, always", () => {

    for (const frame of ALL_FRAMES) {
      const print = { widthIn: frame.shortIn, heightIn: frame.longIn };
      const fit = fitPrintInFrame(print, { widthIn: frame.shortIn, heightIn: frame.longIn });
      expect(fit.apertureIn.widthIn).toBeLessThan(print.widthIn);
      expect(fit.apertureIn.heightIn).toBeLessThan(print.heightIn);
    }
  });

  it("uses the frame rabbet rather than a mount overlap when the print fills the frame", () => {
    const fit = fitPrintInFrame(A3, A3);
    expect(fit.mounted).toBe(false);
    expect(fit.overlapIn).toBe(RABBET_IN);

    expect(fit.borderSideIn).toBeCloseTo(RABBET_IN, 6);
  });

  it("uses the mount overlap once there is real card showing", () => {
    expect(fitPrintInFrame(A4, A3).overlapIn).toBe(MAT_OVERLAP_IN);
  });

  it("refuses a print larger than the frame rather than returning a negative border", () => {
    const fit = fitPrintInFrame(A3, A4);
    expect(fit.fits).toBe(false);
    expect(fit.borderSideIn).toBeLessThan(0);
  });

  it("reports a uniform border when the frame and print differ equally in both directions", () => {
    const print = { widthIn: 10, heightIn: 14 };
    const frame = { widthIn: 14, heightIn: 18 };
    expect(fitPrintInFrame(print, frame).uniform).toBe(true);
  });

  it("moves card from the top to the bottom when weighted, leaving the total unchanged", () => {
    const plain = fitPrintInFrame(A4, A3);
    const weighted = fitPrintInFrame(A4, A3, { bottomWeightIn: 0.5 });
    expect(weighted.borderBottomIn - weighted.borderTopIn).toBeCloseTo(0.5, 6);
    expect(weighted.borderTopIn + weighted.borderBottomIn).toBeCloseTo(
      plain.borderTopIn + plain.borderBottomIn,
      6,
    );

    expect(weighted.borderSideIn).toBeCloseTo(plain.borderSideIn, 6);
  });
});

describe("largestPrintForBorder", () => {
  it("is the inverse of fitPrintInFrame", () => {
    const border = 2.4;
    const print = largestPrintForBorder(A3, border);
    const fit = fitPrintInFrame(print, A3);
    expect(fit.borderSideIn).toBeCloseTo(border, 6);
    expect(fit.borderTopIn).toBeCloseTo(border, 6);
  });

  it("round-trips for every frame in the catalogue", () => {

    for (const frame of ALL_FRAMES) {
      const opening = { widthIn: frame.shortIn, heightIn: frame.longIn };
      for (const border of [0.5, 1.15, 2.4, 2.9]) {
        const print = largestPrintForBorder(opening, border);
        if (print.widthIn <= 0 || print.heightIn <= 0) continue;
        const fit = fitPrintInFrame(print, opening);
        expect(fit.borderSideIn).toBeCloseTo(border, 6);
      }
    }
  });
});

describe("frameOutsideSize", () => {
  it("adds the moulding to every edge", () => {
    const outer = frameOutsideSize(A3, 1.15);
    expect(outer.widthIn).toBeCloseTo(A3.widthIn + 2.3, 6);
    expect(outer.heightIn).toBeCloseTo(A3.heightIn + 2.3, 6);
  });
});

describe("against the studio's own numbers", () => {
  it("matches the shelf scene: a 6x9 print with a 0.95 inch mount", () => {

    const print = { widthIn: 6, heightIn: 9 };
    const aperture = { widthIn: 6 - 2 * MAT_OVERLAP_IN, heightIn: 9 - 2 * MAT_OVERLAP_IN };
    const opening = {
      widthIn: aperture.widthIn + 2 * 0.95,
      heightIn: aperture.heightIn + 2 * 0.95,
    };
    const fit = fitPrintInFrame(print, opening);
    expect(fit.borderSideIn).toBeCloseTo(0.95, 6);
    expect(fit.borderTopIn).toBeCloseTo(0.95, 6);
    expect(fit.uniform).toBe(true);
  });
});

describe("the A-series and imperial families genuinely do not line up", () => {
  it("shows A4 and 10x8 are different shapes, not rounding of each other", () => {

    const a4 = frameById("a4")!;
    const tenByEight = frameById("10x8")!;
    expect(inchesToMm(a4.shortIn)).toBeCloseTo(210, 1);
    expect(inchesToMm(a4.longIn)).toBeCloseTo(297, 1);
    expect(inchesToMm(tenByEight.shortIn)).toBeCloseTo(203.2, 1);
    expect(inchesToMm(tenByEight.longIn)).toBeCloseTo(254, 1);

    expect(a4.shortIn).toBeGreaterThan(tenByEight.shortIn);
    expect(a4.longIn).toBeGreaterThan(tenByEight.longIn);
  });

  it("puts an A4 print in a 10x8 frame as not fitting at all", () => {
    const tenByEight = { widthIn: 8, heightIn: 10 };
    expect(fitPrintInFrame(A4, tenByEight).fits).toBe(false);
  });
});
