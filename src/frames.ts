/**
 * The standard frame sizes actually sold in the UK.
 *
 * Two families that do not line up, which is the whole reason people get this
 * wrong. A-series is the European paper standard and is defined in whole
 * millimetres; imperial photo sizes are defined in whole inches. A4 is
 * 210 x 297mm and 10x8" is 254 x 203mm - near enough in area to look
 * interchangeable on a shelf, and different enough that a print cut for one
 * is visibly wrong in the other.
 *
 * Each size is written in its own native unit and converted once, rather than
 * everything being stored in inches with A4 as 8.268. The definition is the
 * millimetre; the decimal is the derived value.
 *
 * A frame's stated size is the size of the artwork it takes unmounted - which
 * is how they are sold and labelled. "An A3 frame" holds an A3 print, or a
 * smaller print with a mount around it.
 */

import { mmToInches } from "@nasdigitaluk/withnate-tool-core";

export type FrameFamily = "a-series" | "imperial" | "square";

export interface StandardFrame {
  id: string;
  label: string;
  family: FrameFamily;
  /** Short edge, inches. */
  shortIn: number;
  /** Long edge, inches. */
  longIn: number;
}

const fromMm = (id: string, label: string, w: number, h: number): StandardFrame => ({
  id,
  label,
  family: "a-series",
  shortIn: mmToInches(Math.min(w, h)),
  longIn: mmToInches(Math.max(w, h)),
});

const fromIn = (
  id: string,
  label: string,
  a: number,
  b: number,
  family: FrameFamily = "imperial",
): StandardFrame => ({
  id,
  label,
  family,
  shortIn: Math.min(a, b),
  longIn: Math.max(a, b),
});

/** ISO 216. Each size is the previous one halved across its long edge, so they all share a 1:root-2 ratio. */
export const A_SERIES: readonly StandardFrame[] = [
  fromMm("a6", "A6", 105, 148),
  fromMm("a5", "A5", 148, 210),
  fromMm("a4", "A4", 210, 297),
  fromMm("a3", "A3", 297, 420),
  fromMm("a2", "A2", 420, 594),
  fromMm("a1", "A1", 594, 841),
  fromMm("a0", "A0", 841, 1189),
];

/** Traditional photo and poster sizes. Note these do not share a single ratio between them. */
export const IMPERIAL: readonly StandardFrame[] = [
  fromIn("6x4", '6 x 4"', 6, 4),
  fromIn("7x5", '7 x 5"', 7, 5),
  fromIn("8x6", '8 x 6"', 8, 6),
  fromIn("10x8", '10 x 8"', 10, 8),
  fromIn("12x8", '12 x 8"', 12, 8),
  fromIn("12x10", '12 x 10"', 12, 10),
  fromIn("14x11", '14 x 11"', 14, 11),
  fromIn("16x12", '16 x 12"', 16, 12),
  fromIn("18x12", '18 x 12"', 18, 12),
  fromIn("20x16", '20 x 16"', 20, 16),
  fromIn("24x18", '24 x 18"', 24, 18),
  fromIn("24x20", '24 x 20"', 24, 20),
  fromIn("30x20", '30 x 20"', 30, 20),
  fromIn("40x30", '40 x 30"', 40, 30),
];

export const SQUARE: readonly StandardFrame[] = [
  fromIn("8x8", '8 x 8"', 8, 8, "square"),
  fromIn("10x10", '10 x 10"', 10, 10, "square"),
  fromIn("12x12", '12 x 12"', 12, 12, "square"),
  fromIn("16x16", '16 x 16"', 16, 16, "square"),
  fromIn("20x20", '20 x 20"', 20, 20, "square"),
];

export const ALL_FRAMES: readonly StandardFrame[] = [...A_SERIES, ...IMPERIAL, ...SQUARE];

export const frameById = (id: string): StandardFrame | undefined =>
  ALL_FRAMES.find((f) => f.id === id);

/** Aspect ratio of a frame, long edge over short. Square is 1. */
export const frameRatio = (f: StandardFrame): number => f.longIn / f.shortIn;
