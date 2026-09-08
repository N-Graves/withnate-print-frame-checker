/**
 * How big a pixel count can print, and how well it suits a given frame.
 *
 * The thresholds are viewing-distance judgements, not physical constants. 300
 * DPI is the arm's-length standard - photographs, books, anything held. Large
 * prints are looked at from across a room and 150 to 200 genuinely holds up
 * there, because the eye cannot resolve the dots at that distance. Quoting 300
 * for a poster is how people get told their file is unusable when it is fine.
 */

import { aspectRatio } from "@nasdigitaluk/withnate-tool-core";
import type { StandardFrame } from "./frames.js";
import type { SizeIn } from "./geometry.js";

export interface Pixels {
  width: number;
  height: number;
}

export type QualityBand = "excellent" | "good" | "acceptable" | "poor";

export const BANDS: ReadonlyArray<{ band: QualityBand; minDpi: number; note: string }> = [
  { band: "excellent", minDpi: 300, note: "Crisp held at arm's length. The standard for photo prints." },
  { band: "good", minDpi: 200, note: "Sharp on a wall. You would have to get close to fault it." },
  { band: "acceptable", minDpi: 150, note: "Fine for a large print seen from across a room." },
  { band: "poor", minDpi: 0, note: "Soft. Print it smaller, or start from a bigger file." },
];

export const bandFor = (dpi: number): QualityBand =>
  (BANDS.find((b) => dpi >= b.minDpi) ?? BANDS[BANDS.length - 1]!).band;

export const noteFor = (band: QualityBand): string =>
  BANDS.find((b) => b.band === band)?.note ?? "";

/** The largest this many pixels can print at a given density. */
export const maxPrintAt = (px: Pixels, dpi: number): SizeIn => ({
  widthIn: px.width / dpi,
  heightIn: px.height / dpi,
});

export const isLandscape = (px: Pixels): boolean => px.width >= px.height;

/** Turn a frame the same way up as the image. Frames hang either way. */
export const orientFrame = (frame: StandardFrame, landscape: boolean): SizeIn =>
  landscape
    ? { widthIn: frame.longIn, heightIn: frame.shortIn }
    : { widthIn: frame.shortIn, heightIn: frame.longIn };

export interface FrameAssessment {
  frame: StandardFrame;
  /** The frame's opening, turned to match the image. */
  openingIn: SizeIn;
  /** Density you would actually be printing at, filling this frame. */
  dpi: number;
  band: QualityBand;
  /** Fraction of the image lost to the crop, 0 to 1. */
  cropFraction: number;
  /** True when the aspects match closely enough that the crop is invisible. */
  cleanFit: boolean;
}

/** Below this, the crop is a sliver off one edge and nobody would notice. */
const CLEAN_FIT_CROP = 0.02;

/**
 * Assess one frame.
 *
 * Density is `min(px.width / openingWidth, px.height / openingHeight)` - the
 * limiting edge. Filling a frame means scaling until both edges are covered
 * and cropping the overhang, so the edge with fewer pixels per inch sets the
 * quality. Averaging the two, or taking the better one, quietly overstates
 * what a mismatched aspect will actually look like.
 */
export const assessFrame = (px: Pixels, frame: StandardFrame): FrameAssessment => {
  const openingIn = orientFrame(frame, isLandscape(px));
  const dpi = Math.min(px.width / openingIn.widthIn, px.height / openingIn.heightIn);

  const imageAspect = px.width / px.height;
  const frameAspect = openingIn.widthIn / openingIn.heightIn;
  const retained = Math.min(imageAspect / frameAspect, frameAspect / imageAspect);
  const cropFraction = 1 - retained;

  return {
    frame,
    openingIn,
    dpi,
    band: bandFor(dpi),
    cropFraction,
    cleanFit: cropFraction < CLEAN_FIT_CROP,
  };
};

/** Assess every frame, largest first, so the best available size leads. */
export const assessFrames = (
  px: Pixels,
  frames: readonly StandardFrame[],
): FrameAssessment[] =>
  frames
    .map((f) => assessFrame(px, f))
    .sort((a, b) => b.frame.longIn * b.frame.shortIn - a.frame.longIn * a.frame.shortIn);

// ------------------------------------------------------------ aspect naming

interface NamedRatio {
  name: string;
  value: number;
}

/** Ratios worth naming, long edge over short. */
const NAMED_RATIOS: readonly NamedRatio[] = [
  { name: "1:1 square", value: 1 },
  { name: "5:4", value: 1.25 },
  { name: "4:3", value: 4 / 3 },
  { name: "7:5", value: 1.4 },
  { name: "A-series (1:√2)", value: Math.SQRT2 },
  { name: "3:2", value: 1.5 },
  { name: "16:9", value: 16 / 9 },
  { name: "2:1", value: 2 },
];

export interface AspectDescription {
  /** Exact reduced ratio. Can be enormous and useless, which is the caller's problem. */
  exact: [number, number];
  /** True when the exact ratio is small enough to be worth showing. */
  exactIsUseful: boolean;
  nearestName: string;
  /** How far off the named ratio, as a fraction. Zero is an exact match. */
  nearestError: number;
}

/** An exact ratio with a term above this is noise rather than information. */
const USEFUL_RATIO_TERM = 40;

export const describeAspect = (px: Pixels): AspectDescription => {
  const exact = aspectRatio(px.width, px.height);
  const long = Math.max(px.width, px.height);
  const short = Math.min(px.width, px.height);
  const value = long / short;

  let nearest = NAMED_RATIOS[0]!;
  let bestError = Infinity;
  for (const r of NAMED_RATIOS) {
    const err = Math.abs(value - r.value) / r.value;
    if (err < bestError) {
      bestError = err;
      nearest = r;
    }
  }

  return {
    exact,
    exactIsUseful: Math.max(exact[0], exact[1]) <= USEFUL_RATIO_TERM,
    nearestName: nearest.name,
    nearestError: bestError,
  };
};
