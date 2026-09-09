import { formatLength, formatSize, h, roundTo, type LengthUnit } from "@nasdigitaluk/withnate-tool-core";
import { ALL_FRAMES, A_SERIES, IMPERIAL, SQUARE, type StandardFrame } from "./frames.js";
import { MAT_OVERLAP_IN, RABBET_IN, fitPrintInFrame, type SizeIn } from "./geometry.js";
import {
  BANDS,
  assessFrame,
  assessFrames,
  describeAspect,
  maxPrintAt,
  noteFor,
  orientFrame,
  type FrameAssessment,
  type Pixels,
  type QualityBand,
} from "./quality.js";

const BAND_LABEL: Record<QualityBand, string> = {
  excellent: "Excellent",
  good: "Good",
  acceptable: "Acceptable",
  poor: "Too small",
};

const BAND_CLASS: Record<QualityBand, string> = {
  excellent: "fam",
  good: "fam fam-4",
  acceptable: "fam fam-2",
  poor: "fam fam-3",
};

const section = (title: string, ...children: Array<Node | string | null>): HTMLElement =>
  h("section", { class: "pfc-section" }, h("h3", { class: "pfc-h" }, title), ...children);

const bothUnits = (s: SizeIn, unit: LengthUnit): string => {
  const other: LengthUnit = unit === "in" ? "cm" : "in";
  return `${formatSize(s.widthIn, s.heightIn, unit)}  ·  ${formatSize(s.widthIn, s.heightIn, other)}`;
};

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

const dpiTruth = (
  px: Pixels,
  declared: { x: number; y: number } | null,
  unit: LengthUnit,
): HTMLElement => {
  const body: Node[] = [];
  if (declared && Number.isFinite(declared.x) && declared.x > 0) {
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
      ...assessFrames(px, frames).map((a) => frameRow(a, unit, onPick)),
    ),
  );

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

  blocks.push(
    h("h5", { class: "pfc-opt" }, "Fill the frame"),
    line("Order a print at", formatSize(a.openingIn.widthIn, a.openingIn.heightIn, unit)),
    line("You would print at", `${Math.round(a.dpi)} DPI`, noteFor(a.band)),
    line(
      "Cropping",
      a.cleanFit ? "none worth mentioning" : `${Math.round(a.cropFraction * 100)}% of the image`,
    ),
  );

  const smaller = nextSizeDown(a.frame);
  if (smaller) {
    const inner = orientFrame(smaller, a.openingIn.widthIn >= a.openingIn.heightIn);
    const fit = fitPrintInFrame(inner, a.openingIn);
    if (fit.fits) {
      const smallerAssessment = assessFrame(px, smaller);
      blocks.push(

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

      `A mount laps ${formatLength(MAT_OVERLAP_IN, "mm")} over the artwork on every edge, and a frame with no mount laps ${formatLength(RABBET_IN, "mm")}. Cut the hole the same size as the paper and the print falls through it.`,
    ),
  );
};

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
