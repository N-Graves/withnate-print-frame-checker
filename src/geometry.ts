/**
 * Mount and frame arithmetic.
 *
 * Ported from this project's own 3D mockup studio, where the geometry had to
 * be physically correct in order to render - a mount cut wrong there produced
 * a visible strip of bare backing that a reviewer rejected, so the numbers
 * have been through contact with reality rather than a diagram.
 *
 * The load-bearing rule is the overlap. A real framer cuts the aperture
 * SLIGHTLY SMALLER than the paper and laps the card over the edge. Cut it the
 * same size and the print falls through the hole, and bare backing shows along
 * the edges at any viewing angle. Everything else here follows from that.
 */

export interface SizeIn {
  widthIn: number;
  heightIn: number;
}

/** How far a mount laps over the artwork on each edge. */
export const MAT_OVERLAP_IN = 0.16;
/** How far the frame's own rabbet laps over the artwork when there is no mount. */
export const RABBET_IN = 0.12;

/**
 * Below this much card on an edge there is no mount, just a frame lip.
 * An eighth of an inch of visible card is a manufacturing tolerance rather
 * than a design choice, and calling it a mount would be flattering it.
 */
const MOUNTED_THRESHOLD_IN = 0.25;

/** Borders within this of each other read as equal to the eye at arm's length. */
const UNIFORM_TOLERANCE_IN = 0.05;

export interface MountFit {
  printIn: SizeIn;
  frameOpeningIn: SizeIn;
  /** The hole cut in the card - always smaller than the paper. */
  apertureIn: SizeIn;
  borderSideIn: number;
  borderTopIn: number;
  borderBottomIn: number;
  overlapIn: number;
  /** True when there is a real mount rather than just the frame lip. */
  mounted: boolean;
  /** True when the side and top borders match. Rarely true across families. */
  uniform: boolean;
  /** False when the print is bigger than the frame in either direction. */
  fits: boolean;
}

export interface MountOptions {
  /**
   * Extra card at the bottom, traditional for optical balance - a mount with
   * equal borders reads as bottom-heavy because the eye centres slightly high.
   * The aperture moves up; the frame does not grow.
   */
  bottomWeightIn?: number;
}

/**
 * Work out the mount for a given print in a given frame.
 *
 * Reports the side and top borders SEPARATELY, and this is the correction to
 * the original. The studio version applies one uniform border because it is
 * building a scene it controls, so it never has to answer this. In the real
 * case the frame is fixed and the print is whatever it is, and a uniform
 * border only happens when the frame and the print differ by the same amount
 * in both directions - which is rare, and never true between the A-series and
 * imperial families. A4 in an A3 frame gives 44mm at the sides and 62mm top
 * and bottom, and reporting a single averaged number would be describing a
 * mount nobody could cut.
 */
export const fitPrintInFrame = (
  printIn: SizeIn,
  frameOpeningIn: SizeIn,
  opts: MountOptions = {},
): MountFit => {
  const gapW = frameOpeningIn.widthIn - printIn.widthIn;
  const gapH = frameOpeningIn.heightIn - printIn.heightIn;
  const mounted = gapW > MOUNTED_THRESHOLD_IN * 2 || gapH > MOUNTED_THRESHOLD_IN * 2;
  const overlapIn = mounted ? MAT_OVERLAP_IN : RABBET_IN;

  const apertureIn: SizeIn = {
    widthIn: printIn.widthIn - 2 * overlapIn,
    heightIn: printIn.heightIn - 2 * overlapIn,
  };

  const borderSideIn = (frameOpeningIn.widthIn - apertureIn.widthIn) / 2;
  const totalVertical = frameOpeningIn.heightIn - apertureIn.heightIn;
  const weight = opts.bottomWeightIn ?? 0;
  const borderTopIn = totalVertical / 2 - weight / 2;
  const borderBottomIn = totalVertical / 2 + weight / 2;

  return {
    printIn,
    frameOpeningIn,
    apertureIn,
    borderSideIn,
    borderTopIn,
    borderBottomIn,
    overlapIn,
    mounted,
    uniform: Math.abs(borderSideIn - borderTopIn) <= UNIFORM_TOLERANCE_IN,
    // A negative border means the paper is wider than the frame opening.
    // The top border is checked rather than the bottom because weighting
    // moves card from one to the other and the top runs out first.
    fits: borderSideIn >= 0 && borderTopIn >= 0,
  };
};

/**
 * The largest print that leaves at least `borderIn` of card on every edge.
 *
 * The inverse of the above, for the other way people ask the question: not
 * "what border will I get" but "I want a three inch mount, what do I order".
 */
export const largestPrintForBorder = (frameOpeningIn: SizeIn, borderIn: number): SizeIn => {
  const overlapIn = borderIn > MOUNTED_THRESHOLD_IN ? MAT_OVERLAP_IN : RABBET_IN;
  return {
    widthIn: frameOpeningIn.widthIn - 2 * borderIn + 2 * overlapIn,
    heightIn: frameOpeningIn.heightIn - 2 * borderIn + 2 * overlapIn,
  };
};

/**
 * Outside dimensions of the finished frame, for working out whether it fits
 * the wall or the alcove. Moulding width varies wildly by style; 1.15" is the
 * default the studio uses for an ordinary gallery moulding.
 */
export const frameOutsideSize = (frameOpeningIn: SizeIn, mouldingWidthIn = 1.15): SizeIn => ({
  widthIn: frameOpeningIn.widthIn + 2 * mouldingWidthIn,
  heightIn: frameOpeningIn.heightIn + 2 * mouldingWidthIn,
});
