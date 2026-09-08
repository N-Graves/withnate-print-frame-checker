export interface SizeIn {
  widthIn: number;
  heightIn: number;
}

export const MAT_OVERLAP_IN = 0.16;

export const RABBET_IN = 0.12;

const MOUNTED_THRESHOLD_IN = 0.25;

const UNIFORM_TOLERANCE_IN = 0.05;

export interface MountFit {
  printIn: SizeIn;
  frameOpeningIn: SizeIn;

  apertureIn: SizeIn;
  borderSideIn: number;
  borderTopIn: number;
  borderBottomIn: number;
  overlapIn: number;

  mounted: boolean;

  uniform: boolean;

  fits: boolean;
}

export interface MountOptions {

  bottomWeightIn?: number;
}

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

    fits: borderSideIn >= 0 && borderTopIn >= 0,
  };
};

export const largestPrintForBorder = (frameOpeningIn: SizeIn, borderIn: number): SizeIn => {
  const overlapIn = borderIn > MOUNTED_THRESHOLD_IN ? MAT_OVERLAP_IN : RABBET_IN;
  return {
    widthIn: frameOpeningIn.widthIn - 2 * borderIn + 2 * overlapIn,
    heightIn: frameOpeningIn.heightIn - 2 * borderIn + 2 * overlapIn,
  };
};

export const frameOutsideSize = (frameOpeningIn: SizeIn, mouldingWidthIn = 1.15): SizeIn => ({
  widthIn: frameOpeningIn.widthIn + 2 * mouldingWidthIn,
  heightIn: frameOpeningIn.heightIn + 2 * mouldingWidthIn,
});
