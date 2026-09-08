/**
 * Turning the numbers into a page.
 *
 * Everything is built with createElement and textContent rather than
 * innerHTML. Partly because the site's own scripts do, partly because it
 * removes the question of escaping entirely - the only strings that reach the
 * DOM from outside this module are a filename and a format name, and neither
 * gets a chance to be markup.
 */

import { formatLength, formatSize, roundTo, type LengthUnit } from "@nasdigitaluk/withnate-tool-core";
import { ALL_FRAMES, A_SERIES, IMPERIAL, SQUARE, type StandardFrame } from "./frames.js";
import { MAT_OVERLAP_IN, RABBET_IN, fitPrintInFrame, type SizeIn } from "./geometry.js";
import {
  BANDS,
  assessFrame,
  describeAspect,
  maxPrintAt,
  noteFor,
  orientFrame,
  type FrameAssessment,
  type Pixels,
  type QualityBand,
} from "./quality.js";

type Attrs = Record<string, string | boolean | number>;

export const h = (
  tag: string,
  attrs: Attrs = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElement => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === undefined) continue;
    if (k === "class") node.className = String(v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined) continue;
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
};

const BAND_LABEL: Record<QualityBand, string> = {
  excellent: "Excellent",
  good: "Good",
  acceptable: "Acceptable",
  poor: "Too small",
};

/** Maps onto the site's existing chip colours rather than inventing a palette. */
const BAND_CLASS: Record<QualityBand, string> = {
  excellent: "fam",
  good: "fam fam-4",
  acceptable: "fam fam-2",
  poor: "fam fam-3",
};

const section = (title: string, ...children: Array<Node | string | null>): HTMLElement =>
  h("section", { class: "pfc-section" }, h("h3", { class: "pfc-h" }, title), ...children);

/**
 * Both units, selected one first.
 *
 * Summary figures show metric and imperial together on purpose - UK framing is
 * genuinely mixed, paper is ordered in millimetres and frames are sold in
 * inches, and making someone convert in their head to check a size is the
 * error this tool exists to prevent. The toggle controls which leads, so it
 * still visibly does something here rather than appearing inert in the most
 * prominent place on the page.
 */
const bothUnits = (s: SizeIn, unit: LengthUnit): string => {
  const other: LengthUnit = unit === "in" ? "cm" : "in";
  return `${formatSize(s.widthIn, s.heightIn, unit)}  ·  ${formatSize(s.widthIn, s.heightIn, other)}`;
};

// ------------------------------------------------------------------ blocks

const headline = (px: Pixels, unit: LengthUnit): HTMLElement => {
  const best = maxPrintAt(px, 300);
  return h(
    "div",
    { class: "pfc-headline" },
    h("p", { class: "eyebrow" }, "Your image"),
    h("h2", {}, `${px.width.toLocaleString()} × ${px.height.toLocaleString()} pixels`),
    h(
      "p",
      { class: "lede" },
      `At top quality that prints up to ${bothUnits(best, unit)}. Bigger is possible, and the table below says what it costs you.`,
    ),
  );
};

const sizeTable = (px: Pixels, unit: LengthUnit): HTMLElement => {
  const rows = BANDS.filter((b) => b.minDpi > 0).map((b) => {
    const s = maxPrintAt(px, b.minDpi);
    return h(
      "tr",
      {},
      h("td", {}, h("span", { class: BAND_CLASS[b.band] }, BAND_LABEL[b.band])),
      h("td", {}, `${b.minDpi} DPI`),
      h("td", {}, bothUnits(s, unit)),
      h("td", { class: "pfc-note" }, b.note),
    );
  });
  return h(
    "table",
    { class: "pfc-table" },
    h(
      "thead",
      {},
      h(
        "tr",
        {},
        h("th", {}, "Quality"),
        h("th", {}, "Density"),
        h("th", {}, "Largest print"),
        h("th", {}, "What that means"),
      ),
    ),
    h("tbody", {}, ...rows),
  );
};

/**
 * The honest DPI answer.
 *
 * This is the section the tool exists for. "Convert my image to 300 DPI" is
 * one of the most-searched image tasks there is, and the tools that answer it
 * edit a tag and change nothing. Saying so plainly, with the visitor's own
 * numbers in the sentence, is more use than doing it for them.
 */
const dpiTruth = (
  px: Pixels,
  declared: { x: number; y: number } | null,
  unit: LengthUnit,
): HTMLElement => {
  const body: Node[] = [];
  if (declared) {
    const dpi = roundTo(declared.x, 0);
    const at = maxPrintAt(px, declared.x);
    body.push(
      h(
        "p",
        {},
        `This file declares ${dpi} DPI. That is a label written into the file, not a measure of how much detail it holds. All it says is that the image is meant to print at ${bothUnits(at, unit)}.`,
      ),
      h(
        "p",
        {},
        "Changing that number does not add a single pixel. A tool that offers to raise it to 300 is editing a tag, and the print comes out exactly as sharp as it was going to anyway. The pixel count above is the real answer.",
      ),
    );
  } else {
    body.push(
      h(
        "p",
        {},
        "This file declares no print density at all, which is completely normal — most cameras and phones leave it out or write a meaningless 72.",
      ),
      h(
        "p",
        {},
        "It changes nothing. Density is only a label saying how big to print; the detail comes from the pixel count, and that is what the table above uses.",
      ),
    );
  }
  return section("About that DPI number", ...body);
};

const shape = (px: Pixels): HTMLElement => {
  const d = describeAspect(px);
  const exact = `${d.exact[0]}:${d.exact[1]}`;
  const close = d.nearestError < 0.005;
  return section(
    "Shape",
    h(
      "p",
      {},
      d.exactIsUseful
        ? close
          ? `Your image is ${exact} — exactly the ${d.nearestName} standard.`
          : `Your image is ${exact}, closest to ${d.nearestName}.`
        : close
          ? `Your image matches the ${d.nearestName} standard.`
          : `Your image is not a standard shape. The nearest is ${d.nearestName}, and it is ${Math.round(d.nearestError * 100)}% away from it.`,
    ),
    h(
      "p",
      { class: "pfc-note" },
      "A frame whose shape does not match yours means cropping. The list below says how much for each one.",
    ),
  );
};

// ------------------------------------------------------------- frame lists

const frameRow = (
  a: FrameAssessment,
  unit: LengthUnit,
  onPick: (a: FrameAssessment) => void,
): HTMLElement => {
  const crop =
    a.cleanFit
      ? "fits your shape"
      : `crops ${Math.round(a.cropFraction * 100)}% away`;
  const btn = h(
    "button",
    { type: "button", class: "pfc-frame" },
    h("span", { class: "pfc-frame-name" }, a.frame.label),
    h("span", { class: "pfc-frame-size" }, formatSize(a.openingIn.widthIn, a.openingIn.heightIn, unit)),
    h("span", { class: BAND_CLASS[a.band] }, BAND_LABEL[a.band]),
    h("span", { class: "pfc-frame-detail" }, `${Math.round(a.dpi)} DPI · ${crop}`),
  );
  btn.addEventListener("click", () => onPick(a));
  return btn;
};

const frameGroup = (
  title: string,
  frames: readonly StandardFrame[],
  px: Pixels,
  unit: LengthUnit,
  onPick: (a: FrameAssessment) => void,
): HTMLElement =>
  h(
    "div",
    { class: "pfc-group" },
    h("h4", { class: "pfc-group-h" }, title),
    h(
      "div",
      { class: "pfc-frames" },
      ...frames
        .map((f) => assessFrame(px, f))
        .sort((a, b) => b.frame.longIn * b.frame.shortIn - a.frame.longIn * a.frame.shortIn)
        .map((a) => frameRow(a, unit, onPick)),
    ),
  );

/**
 * The mount detail for one chosen frame.
 *
 * Side and top borders are reported separately and deliberately. They are
 * usually different - A4 in an A3 frame is 48mm at the sides and 66mm top and
 * bottom - and a single averaged figure would describe a mount nobody could
 * cut.
 */
/** The largest standard size in the same family that is genuinely smaller. */
const nextSizeDown = (frame: StandardFrame): StandardFrame | undefined => {
  const area = frame.shortIn * frame.longIn;
  return ALL_FRAMES.filter((f) => f.family === frame.family && f.shortIn * f.longIn < area).sort(
    (a, b) => b.shortIn * b.longIn - a.shortIn * a.longIn,
  )[0];
};

const line = (label: string, value: string, note?: string): HTMLElement =>
  h(
    "div",
    { class: "pfc-line" },
    h("span", { class: "pfc-line-k" }, label),
    h("span", { class: "pfc-line-v" }, value),
    note ? h("span", { class: "pfc-note" }, note) : null,
  );

export const mountDetail = (
  a: FrameAssessment,
  px: Pixels,
  unit: LengthUnit,
): HTMLElement => {
  const blocks: HTMLElement[] = [
    line("Frame opening", formatSize(a.openingIn.widthIn, a.openingIn.heightIn, unit)),
  ];

  // Option one: print to the frame's own size, no mount.
  blocks.push(
    h("h5", { class: "pfc-opt" }, "Fill the frame"),
    line("Order a print at", formatSize(a.openingIn.widthIn, a.openingIn.heightIn, unit)),
    line("You would print at", `${Math.round(a.dpi)} DPI`, noteFor(a.band)),
    line(
      "Cropping",
      a.cleanFit ? "none worth mentioning" : `${Math.round(a.cropFraction * 100)}% of the image`,
    ),
  );

  // Option two: the next standard size down, with the card that leaves. This
  // is the case worth showing, because the two borders come out different and
  // that is the thing every other calculator gets wrong or hides.
  const smaller = nextSizeDown(a.frame);
  if (smaller) {
    const inner = orientFrame(smaller, a.openingIn.widthIn >= a.openingIn.heightIn);
    const fit = fitPrintInFrame(inner, a.openingIn);
    if (fit.fits) {
      const smallerAssessment = assessFrame(px, smaller);
      blocks.push(
        // No article before the label: "a A4" is wrong and "an 10 x 8" is
        // worse, and picking correctly needs the spoken form, not the spelling.
        h("h5", { class: "pfc-opt" }, `Mounted — ${smaller.label} print`),
        line("Order a print at", formatSize(inner.widthIn, inner.heightIn, unit)),
        line(
          "Card you will see",
          `${formatLength(fit.borderSideIn, unit)} at the sides, ${formatLength(fit.borderTopIn, unit)} top and bottom`,
          fit.uniform ? "an even border all the way round" : "not an even border — the shapes differ",
        ),
        line("Aperture cut to", formatSize(fit.apertureIn.widthIn, fit.apertureIn.heightIn, unit)),
        line(
          "You would print at",
          `${Math.round(smallerAssessment.dpi)} DPI`,
          noteFor(smallerAssessment.band),
        ),
      );
    }
  }

  return h(
    "div",
    { class: "pfc-detail glass", role: "status" },
    h("h4", { class: "pfc-h" }, `${a.frame.label} in detail`),
    ...blocks,
    h(
      "p",
      { class: "pfc-note" },
      // Always millimetres, whatever unit is selected. These are fixed
      // constants a few millimetres across; in centimetres they round to
      // "0.4" and in inches to "0.2", and neither is a number anyone can cut to.
      `A mount laps ${formatLength(MAT_OVERLAP_IN, "mm")} over the artwork on every edge, and a frame with no mount laps ${formatLength(RABBET_IN, "mm")}. Cut the hole the same size as the paper and the print falls through it.`,
    ),
  );
};

// ------------------------------------------------------------------- entry

export interface ResultsOptions {
  px: Pixels;
  declaredDensity: { x: number; y: number } | null;
  unit: LengthUnit;
}

export const renderResults = (opts: ResultsOptions): HTMLElement => {
  const { px, unit } = opts;
  const detailHost = h("div", { class: "pfc-detail-host" });
  const onPick = (a: FrameAssessment): void => {
    detailHost.replaceChildren(mountDetail(a, px, unit));
  };

  return h(
    "div",
    { class: "pfc-results-inner" },
    headline(px, unit),
    section(
      "How big can I print it?",
      // The table scrolls inside its own box. The site's rule is that the page
      // body never scrolls sideways, and four columns will not fit a phone.
      h("div", { class: "pfc-table-wrap" }, sizeTable(px, unit)),
    ),
    dpiTruth(px, opts.declaredDensity, unit),
    shape(px),
    section(
      "Which frames fit",
      h(
        "p",
        { class: "pfc-note" },
        "Sizes are the artwork the frame takes. Pick one for the mount measurements.",
      ),
      frameGroup("A sizes", A_SERIES, px, unit, onPick),
      frameGroup("Inches", IMPERIAL, px, unit, onPick),
      frameGroup("Square", SQUARE, px, unit, onPick),
      detailHost,
    ),
  );
};

export { orientFrame };
