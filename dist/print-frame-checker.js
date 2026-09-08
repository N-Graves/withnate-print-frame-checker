/*! withnate-print-frame-checker v0.1.0 - MIT
 * https://github.com/N-Graves/withnate-print-frame-checker#readme
 * Runs entirely in the browser. No network requests, no storage.
 */
"use strict";
(() => {
  // node_modules/@nasdigitaluk/withnate-tool-core/dist/sniff.js
  var startsWith = (bytes, sig, offset = 0) => {
    if (bytes.length < offset + sig.length)
      return false;
    for (let i = 0; i < sig.length; i += 1) {
      if (bytes[offset + i] !== sig[i])
        return false;
    }
    return true;
  };
  var PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  var JPEG_SIG = [255, 216, 255];
  var GIF87_SIG = [71, 73, 70, 56, 55, 97];
  var GIF89_SIG = [71, 73, 70, 56, 57, 97];
  var RIFF_SIG = [82, 73, 70, 70];
  var WEBP_SIG = [87, 69, 66, 80];
  var HEADER_BYTES = 64 * 1024;
  var sniffFormat = (bytes) => {
    if (startsWith(bytes, PNG_SIG))
      return "png";
    if (startsWith(bytes, JPEG_SIG))
      return "jpeg";
    if (startsWith(bytes, GIF87_SIG) || startsWith(bytes, GIF89_SIG))
      return "gif";
    if (startsWith(bytes, RIFF_SIG) && startsWith(bytes, WEBP_SIG, 8))
      return "webp";
    return null;
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/dimensions.js
  var MM_PER_INCH = 25.4;
  var MM_PER_METRE = 1e3;
  var at = (b, i) => {
    const v = b[i];
    if (v === void 0)
      throw new RangeError(`byte ${i} is past the end of the buffer`);
    return v;
  };
  var be16 = (b, i) => at(b, i) << 8 | at(b, i + 1);
  var le16 = (b, i) => at(b, i) | at(b, i + 1) << 8;
  var le24 = (b, i) => at(b, i) | at(b, i + 1) << 8 | at(b, i + 2) << 16;
  var be32 = (b, i) => (at(b, i) << 24 | at(b, i + 1) << 16 | at(b, i + 2) << 8 | at(b, i + 3)) >>> 0;
  var asciiAt = (b, i, s) => {
    for (let k = 0; k < s.length; k += 1) {
      if (b[i + k] !== s.charCodeAt(k))
        return false;
    }
    return true;
  };
  var measurePng = (b) => {
    const width = be32(b, 16);
    const height = be32(b, 20);
    let density = null;
    let p = 8;
    while (p + 8 <= b.length) {
      const len = be32(b, p);
      const type = p + 4;
      if (asciiAt(b, type, "IDAT") || asciiAt(b, type, "IEND"))
        break;
      if (asciiAt(b, type, "pHYs") && len === 9 && p + 8 + 9 <= b.length) {
        const d = p + 8;
        const unit = at(b, d + 8);
        if (unit === 1) {
          density = {
            x: be32(b, d) * MM_PER_INCH / MM_PER_METRE,
            y: be32(b, d + 4) * MM_PER_INCH / MM_PER_METRE,
            source: "png-phys"
          };
        }
        break;
      }
      p += 12 + len;
    }
    return { format: "png", width, height, density };
  };
  var isSof = (m) => m >= 192 && m <= 195 || m >= 197 && m <= 199 || m >= 201 && m <= 203 || m >= 205 && m <= 207;
  var measureJpeg = (b) => {
    let density = null;
    let p = 2;
    while (p + 4 <= b.length) {
      if (at(b, p) !== 255) {
        p += 1;
        continue;
      }
      const marker = at(b, p + 1);
      if (marker === 255) {
        p += 1;
        continue;
      }
      if (marker === 216 || marker >= 208 && marker <= 217 || marker === 1) {
        p += 2;
        continue;
      }
      const len = be16(b, p + 2);
      if (len < 2)
        break;
      const payload = p + 4;
      if (isSof(marker)) {
        return { format: "jpeg", height: be16(b, payload + 1), width: be16(b, payload + 3), density };
      }
      if (marker === 224 && asciiAt(b, payload, "JFIF\0")) {
        const units = at(b, payload + 7);
        const x = be16(b, payload + 8);
        const y = be16(b, payload + 10);
        if (units === 1 && x > 0 && y > 0)
          density = { x, y, source: "jfif" };
        else if (units === 2 && x > 0 && y > 0) {
          density = { x: x * MM_PER_INCH / 10, y: y * MM_PER_INCH / 10, source: "jfif" };
        }
      }
      if (marker === 218)
        break;
      p = payload + len - 2;
    }
    throw new RangeError("no start-of-frame segment found");
  };
  var measureGif = (b) => ({
    format: "gif",
    width: le16(b, 6),
    height: le16(b, 8),
    density: null
    // GIF has no density field at all.
  });
  var measureWebp = (b) => {
    const fourcc = String.fromCharCode(at(b, 12), at(b, 13), at(b, 14), at(b, 15));
    const data = 20;
    if (fourcc === "VP8X") {
      return {
        format: "webp",
        width: le24(b, data + 4) + 1,
        height: le24(b, data + 7) + 1,
        density: null
      };
    }
    if (fourcc === "VP8 ") {
      return {
        format: "webp",
        width: le16(b, data + 6) & 16383,
        height: le16(b, data + 8) & 16383,
        density: null
      };
    }
    if (fourcc === "VP8L") {
      if (at(b, data) !== 47)
        throw new RangeError("VP8L signature byte missing");
      const bits = at(b, data + 1) | at(b, data + 2) << 8 | at(b, data + 3) << 16 | at(b, data + 4) << 24;
      return {
        format: "webp",
        width: (bits & 16383) + 1,
        height: (bits >>> 14 & 16383) + 1,
        density: null
      };
    }
    throw new RangeError(`unrecognised WebP chunk "${fourcc}"`);
  };
  var measureImage = (bytes) => {
    const format = sniffFormat(bytes);
    if (format === null)
      return null;
    try {
      const m = format === "png" ? measurePng(bytes) : format === "jpeg" ? measureJpeg(bytes) : format === "gif" ? measureGif(bytes) : measureWebp(bytes);
      if (!Number.isFinite(m.width) || !Number.isFinite(m.height) || m.width < 1 || m.height < 1) {
        return null;
      }
      return m;
    } catch {
      return null;
    }
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/units.js
  var MM_PER_INCH2 = 25.4;
  var inchesToMm = (inches) => inches * MM_PER_INCH2;
  var mmToInches = (mm) => mm / MM_PER_INCH2;
  var inchesToCm = (inches) => inches * MM_PER_INCH2 / 10;
  var roundTo = (value, dp) => {
    const f = 10 ** dp;
    return Math.round(value * f) / f;
  };
  var PRECISION = { in: 1, mm: 0, cm: 1 };
  var convertFromInches = (inches, unit) => unit === "in" ? inches : unit === "mm" ? inchesToMm(inches) : inchesToCm(inches);
  var formatLength = (inches, unit) => `${roundTo(convertFromInches(inches, unit), PRECISION[unit])}${unit === "in" ? '"' : ` ${unit}`}`;
  var formatSize = (wIn, hIn, unit) => {
    const dp = PRECISION[unit];
    const w = roundTo(convertFromInches(wIn, unit), dp);
    const h2 = roundTo(convertFromInches(hIn, unit), dp);
    return unit === "in" ? `${w} \xD7 ${h2}"` : `${w} \xD7 ${h2} ${unit}`;
  };
  var gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  var aspectRatio = (width, height) => {
    const w = Math.round(width);
    const h2 = Math.round(height);
    const g = gcd(Math.max(w, h2), Math.min(w, h2)) || 1;
    return [w / g, h2 / g];
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/intake.js
  var DEFAULT_DRAGGING_CLASS = "is-dragging";
  var humanBytes = (n) => n >= 1024 * 1024 ? `${Math.round(n / (1024 * 1024))}MB` : `${Math.round(n / 1024)}KB`;
  var attachIntake = (root, opts) => {
    const draggingClass = opts.draggingClass ?? DEFAULT_DRAGGING_CLASS;
    const input = root.querySelector('input[type="file"]');
    const accept = (file) => {
      if (!file)
        return;
      if (opts.maxBytes && file.size > opts.maxBytes) {
        opts.onReject?.(`That file is ${humanBytes(file.size)}. The limit here is ${humanBytes(opts.maxBytes)}.`);
        return;
      }
      if (file.size === 0) {
        opts.onReject?.("That file is empty.");
        return;
      }
      opts.onFile(file);
    };
    const onDragEnter = (e) => {
      e.preventDefault();
      root.classList.add(draggingClass);
    };
    const onDragOver = (e) => {
      e.preventDefault();
      if (e.dataTransfer)
        e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e) => {
      if (e.relatedTarget instanceof Node && root.contains(e.relatedTarget))
        return;
      root.classList.remove(draggingClass);
    };
    const onDrop = (e) => {
      e.preventDefault();
      root.classList.remove(draggingClass);
      accept(e.dataTransfer?.files?.[0]);
    };
    const onChange = () => {
      accept(input?.files?.[0]);
      if (input)
        input.value = "";
    };
    const onPaste = (e) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === "file");
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        accept(file);
      }
    };
    root.addEventListener("dragenter", onDragEnter);
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("dragleave", onDragLeave);
    root.addEventListener("drop", onDrop);
    input?.addEventListener("change", onChange);
    document.addEventListener("paste", onPaste);
    return () => {
      root.removeEventListener("dragenter", onDragEnter);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("dragleave", onDragLeave);
      root.removeEventListener("drop", onDrop);
      input?.removeEventListener("change", onChange);
      document.removeEventListener("paste", onPaste);
      root.classList.remove(draggingClass);
    };
  };
  var readHeaderBytes = async (file, n = HEADER_BYTES) => {
    const buf = await file.slice(0, n).arrayBuffer();
    return new Uint8Array(buf);
  };

  // node_modules/@nasdigitaluk/withnate-tool-core/dist/mount.js
  var getWn = () => {
    const w = globalThis;
    return w.WN ?? null;
  };
  var mount = (selector, init) => {
    const run = () => {
      const root = document.querySelector(selector);
      if (!root)
        return;
      const wn = getWn();
      const reduced = wn?.reduced ?? (typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)").matches : true);
      init({ root, wn, reduced });
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  };

  // src/frames.ts
  var fromMm = (id, label, w, h2) => ({
    id,
    label,
    family: "a-series",
    shortIn: mmToInches(Math.min(w, h2)),
    longIn: mmToInches(Math.max(w, h2))
  });
  var fromIn = (id, label, a, b, family = "imperial") => ({
    id,
    label,
    family,
    shortIn: Math.min(a, b),
    longIn: Math.max(a, b)
  });
  var A_SERIES = [
    fromMm("a6", "A6", 105, 148),
    fromMm("a5", "A5", 148, 210),
    fromMm("a4", "A4", 210, 297),
    fromMm("a3", "A3", 297, 420),
    fromMm("a2", "A2", 420, 594),
    fromMm("a1", "A1", 594, 841),
    fromMm("a0", "A0", 841, 1189)
  ];
  var IMPERIAL = [
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
    fromIn("40x30", '40 x 30"', 40, 30)
  ];
  var SQUARE = [
    fromIn("8x8", '8 x 8"', 8, 8, "square"),
    fromIn("10x10", '10 x 10"', 10, 10, "square"),
    fromIn("12x12", '12 x 12"', 12, 12, "square"),
    fromIn("16x16", '16 x 16"', 16, 16, "square"),
    fromIn("20x20", '20 x 20"', 20, 20, "square")
  ];
  var ALL_FRAMES = [...A_SERIES, ...IMPERIAL, ...SQUARE];

  // src/geometry.ts
  var MAT_OVERLAP_IN = 0.16;
  var RABBET_IN = 0.12;
  var MOUNTED_THRESHOLD_IN = 0.25;
  var UNIFORM_TOLERANCE_IN = 0.05;
  var fitPrintInFrame = (printIn, frameOpeningIn, opts = {}) => {
    const gapW = frameOpeningIn.widthIn - printIn.widthIn;
    const gapH = frameOpeningIn.heightIn - printIn.heightIn;
    const mounted = gapW > MOUNTED_THRESHOLD_IN * 2 || gapH > MOUNTED_THRESHOLD_IN * 2;
    const overlapIn = mounted ? MAT_OVERLAP_IN : RABBET_IN;
    const apertureIn = {
      widthIn: printIn.widthIn - 2 * overlapIn,
      heightIn: printIn.heightIn - 2 * overlapIn
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
      fits: borderSideIn >= 0 && borderTopIn >= 0
    };
  };

  // src/quality.ts
  var BANDS = [
    { band: "excellent", minDpi: 300, note: "Crisp held at arm's length. The standard for photo prints." },
    { band: "good", minDpi: 200, note: "Sharp on a wall. You would have to get close to fault it." },
    { band: "acceptable", minDpi: 150, note: "Fine for a large print seen from across a room." },
    { band: "poor", minDpi: 0, note: "Soft. Print it smaller, or start from a bigger file." }
  ];
  var bandFor = (dpi) => (BANDS.find((b) => dpi >= b.minDpi) ?? BANDS[BANDS.length - 1]).band;
  var noteFor = (band) => BANDS.find((b) => b.band === band)?.note ?? "";
  var maxPrintAt = (px, dpi) => ({
    widthIn: px.width / dpi,
    heightIn: px.height / dpi
  });
  var isLandscape = (px) => px.width >= px.height;
  var orientFrame = (frame, landscape) => landscape ? { widthIn: frame.longIn, heightIn: frame.shortIn } : { widthIn: frame.shortIn, heightIn: frame.longIn };
  var CLEAN_FIT_CROP = 0.02;
  var assessFrame = (px, frame) => {
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
      cleanFit: cropFraction < CLEAN_FIT_CROP
    };
  };
  var NAMED_RATIOS = [
    { name: "1:1 square", value: 1 },
    { name: "5:4", value: 1.25 },
    { name: "4:3", value: 4 / 3 },
    { name: "7:5", value: 1.4 },
    { name: "A-series (1:\u221A2)", value: Math.SQRT2 },
    { name: "3:2", value: 1.5 },
    { name: "16:9", value: 16 / 9 },
    { name: "2:1", value: 2 }
  ];
  var USEFUL_RATIO_TERM = 40;
  var describeAspect = (px) => {
    const exact = aspectRatio(px.width, px.height);
    const long = Math.max(px.width, px.height);
    const short = Math.min(px.width, px.height);
    const value = long / short;
    let nearest = NAMED_RATIOS[0];
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
      nearestError: bestError
    };
  };

  // src/render.ts
  var h = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v === void 0) continue;
      if (k === "class") node.className = String(v);
      else if (v === true) node.setAttribute(k, "");
      else node.setAttribute(k, String(v));
    }
    for (const c of children) {
      if (c === null || c === void 0) continue;
      node.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  };
  var BAND_LABEL = {
    excellent: "Excellent",
    good: "Good",
    acceptable: "Acceptable",
    poor: "Too small"
  };
  var BAND_CLASS = {
    excellent: "fam",
    good: "fam fam-4",
    acceptable: "fam fam-2",
    poor: "fam fam-3"
  };
  var section = (title, ...children) => h("section", { class: "pfc-section" }, h("h3", { class: "pfc-h" }, title), ...children);
  var bothUnits = (s, unit) => {
    const other = unit === "in" ? "cm" : "in";
    return `${formatSize(s.widthIn, s.heightIn, unit)}  \xB7  ${formatSize(s.widthIn, s.heightIn, other)}`;
  };
  var headline = (px, unit) => {
    const best = maxPrintAt(px, 300);
    return h(
      "div",
      { class: "pfc-headline" },
      h("p", { class: "eyebrow" }, "Your image"),
      h("h2", {}, `${px.width.toLocaleString()} \xD7 ${px.height.toLocaleString()} pixels`),
      h(
        "p",
        { class: "lede" },
        `At top quality that prints up to ${bothUnits(best, unit)}. Bigger is possible, and the table below says what it costs you.`
      )
    );
  };
  var sizeTable = (px, unit) => {
    const rows = BANDS.filter((b) => b.minDpi > 0).map((b) => {
      const s = maxPrintAt(px, b.minDpi);
      return h(
        "tr",
        {},
        h("td", {}, h("span", { class: BAND_CLASS[b.band] }, BAND_LABEL[b.band])),
        h("td", {}, `${b.minDpi} DPI`),
        h("td", {}, bothUnits(s, unit)),
        h("td", { class: "pfc-note" }, b.note)
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
          h("th", {}, "What that means")
        )
      ),
      h("tbody", {}, ...rows)
    );
  };
  var dpiTruth = (px, declared, unit) => {
    const body = [];
    if (declared) {
      const dpi = roundTo(declared.x, 0);
      const at2 = maxPrintAt(px, declared.x);
      body.push(
        h(
          "p",
          {},
          `This file declares ${dpi} DPI. That is a label written into the file, not a measure of how much detail it holds. All it says is that the image is meant to print at ${bothUnits(at2, unit)}.`
        ),
        h(
          "p",
          {},
          "Changing that number does not add a single pixel. A tool that offers to raise it to 300 is editing a tag, and the print comes out exactly as sharp as it was going to anyway. The pixel count above is the real answer."
        )
      );
    } else {
      body.push(
        h(
          "p",
          {},
          "This file declares no print density at all, which is completely normal \u2014 most cameras and phones leave it out or write a meaningless 72."
        ),
        h(
          "p",
          {},
          "It changes nothing. Density is only a label saying how big to print; the detail comes from the pixel count, and that is what the table above uses."
        )
      );
    }
    return section("About that DPI number", ...body);
  };
  var shape = (px) => {
    const d = describeAspect(px);
    const exact = `${d.exact[0]}:${d.exact[1]}`;
    const close = d.nearestError < 5e-3;
    return section(
      "Shape",
      h(
        "p",
        {},
        d.exactIsUseful ? close ? `Your image is ${exact} \u2014 exactly the ${d.nearestName} standard.` : `Your image is ${exact}, closest to ${d.nearestName}.` : close ? `Your image matches the ${d.nearestName} standard.` : `Your image is not a standard shape. The nearest is ${d.nearestName}, and it is ${Math.round(d.nearestError * 100)}% away from it.`
      ),
      h(
        "p",
        { class: "pfc-note" },
        "A frame whose shape does not match yours means cropping. The list below says how much for each one."
      )
    );
  };
  var frameRow = (a, unit, onPick) => {
    const crop = a.cleanFit ? "fits your shape" : `crops ${Math.round(a.cropFraction * 100)}% away`;
    const btn = h(
      "button",
      { type: "button", class: "pfc-frame" },
      h("span", { class: "pfc-frame-name" }, a.frame.label),
      h("span", { class: "pfc-frame-size" }, formatSize(a.openingIn.widthIn, a.openingIn.heightIn, unit)),
      h("span", { class: BAND_CLASS[a.band] }, BAND_LABEL[a.band]),
      h("span", { class: "pfc-frame-detail" }, `${Math.round(a.dpi)} DPI \xB7 ${crop}`)
    );
    btn.addEventListener("click", () => onPick(a));
    return btn;
  };
  var frameGroup = (title, frames, px, unit, onPick) => h(
    "div",
    { class: "pfc-group" },
    h("h4", { class: "pfc-group-h" }, title),
    h(
      "div",
      { class: "pfc-frames" },
      ...frames.map((f) => assessFrame(px, f)).sort((a, b) => b.frame.longIn * b.frame.shortIn - a.frame.longIn * a.frame.shortIn).map((a) => frameRow(a, unit, onPick))
    )
  );
  var nextSizeDown = (frame) => {
    const area = frame.shortIn * frame.longIn;
    return ALL_FRAMES.filter((f) => f.family === frame.family && f.shortIn * f.longIn < area).sort(
      (a, b) => b.shortIn * b.longIn - a.shortIn * a.longIn
    )[0];
  };
  var line = (label, value, note) => h(
    "div",
    { class: "pfc-line" },
    h("span", { class: "pfc-line-k" }, label),
    h("span", { class: "pfc-line-v" }, value),
    note ? h("span", { class: "pfc-note" }, note) : null
  );
  var mountDetail = (a, px, unit) => {
    const blocks = [
      line("Frame opening", formatSize(a.openingIn.widthIn, a.openingIn.heightIn, unit))
    ];
    blocks.push(
      h("h5", { class: "pfc-opt" }, "Fill the frame"),
      line("Order a print at", formatSize(a.openingIn.widthIn, a.openingIn.heightIn, unit)),
      line("You would print at", `${Math.round(a.dpi)} DPI`, noteFor(a.band)),
      line(
        "Cropping",
        a.cleanFit ? "none worth mentioning" : `${Math.round(a.cropFraction * 100)}% of the image`
      )
    );
    const smaller = nextSizeDown(a.frame);
    if (smaller) {
      const inner = orientFrame(smaller, a.openingIn.widthIn >= a.openingIn.heightIn);
      const fit = fitPrintInFrame(inner, a.openingIn);
      if (fit.fits) {
        const smallerAssessment = assessFrame(px, smaller);
        blocks.push(
          // No article before the label: "a A4" is wrong and "an 10 x 8" is
          // worse, and picking correctly needs the spoken form, not the spelling.
          h("h5", { class: "pfc-opt" }, `Mounted \u2014 ${smaller.label} print`),
          line("Order a print at", formatSize(inner.widthIn, inner.heightIn, unit)),
          line(
            "Card you will see",
            `${formatLength(fit.borderSideIn, unit)} at the sides, ${formatLength(fit.borderTopIn, unit)} top and bottom`,
            fit.uniform ? "an even border all the way round" : "not an even border \u2014 the shapes differ"
          ),
          line("Aperture cut to", formatSize(fit.apertureIn.widthIn, fit.apertureIn.heightIn, unit)),
          line(
            "You would print at",
            `${Math.round(smallerAssessment.dpi)} DPI`,
            noteFor(smallerAssessment.band)
          )
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
        `A mount laps ${formatLength(MAT_OVERLAP_IN, "mm")} over the artwork on every edge, and a frame with no mount laps ${formatLength(RABBET_IN, "mm")}. Cut the hole the same size as the paper and the print falls through it.`
      )
    );
  };
  var renderResults = (opts) => {
    const { px, unit } = opts;
    const detailHost = h("div", { class: "pfc-detail-host" });
    const onPick = (a) => {
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
        h("div", { class: "pfc-table-wrap" }, sizeTable(px, unit))
      ),
      dpiTruth(px, opts.declaredDensity, unit),
      shape(px),
      section(
        "Which frames fit",
        h(
          "p",
          { class: "pfc-note" },
          "Sizes are the artwork the frame takes. Pick one for the mount measurements."
        ),
        frameGroup("A sizes", A_SERIES, px, unit, onPick),
        frameGroup("Inches", IMPERIAL, px, unit, onPick),
        frameGroup("Square", SQUARE, px, unit, onPick),
        detailHost
      )
    );
  };

  // src/index.ts
  var MIN_USEFUL_EDGE = 32;
  var MAX_SANE_EDGE = 1e5;
  mount("[data-pfc]", ({ root }) => {
    const intake = root.querySelector("[data-pfc-intake]");
    const results = root.querySelector("[data-pfc-results]");
    const errorOut = root.querySelector("[data-pfc-error]");
    if (!intake || !results) return;
    const state = { px: null, density: null, unit: "cm" };
    const showError = (message) => {
      if (errorOut) errorOut.textContent = message;
      results.replaceChildren();
    };
    const clearError = () => {
      if (errorOut) errorOut.textContent = "";
    };
    const draw = () => {
      if (!state.px) return;
      clearError();
      results.replaceChildren(
        renderResults({ px: state.px, declaredDensity: state.density, unit: state.unit })
      );
    };
    const accept = (px, density) => {
      if (px.width < MIN_USEFUL_EDGE || px.height < MIN_USEFUL_EDGE || px.width > MAX_SANE_EDGE || px.height > MAX_SANE_EDGE) {
        showError("Those dimensions do not look like a real image. Have another go.");
        return;
      }
      state.px = px;
      state.density = density;
      draw();
    };
    attachIntake(intake, {
      onReject: showError,
      onFile: (file) => {
        clearError();
        void readHeaderBytes(file).then((bytes) => {
          const m = measureImage(bytes);
          if (!m) {
            showError(
              "That file could not be read as a PNG, JPEG, GIF or WebP. If it is a HEIC from an iPhone, export it as JPEG first."
            );
            return;
          }
          accept({ width: m.width, height: m.height }, m.density);
        }).catch(() => {
          showError("That file could not be opened. Try choosing it again.");
        });
      }
    });
    const wInput = root.querySelector("[data-pfc-w]");
    const hInput = root.querySelector("[data-pfc-h]");
    const manualGo = root.querySelector("[data-pfc-manual]");
    if (wInput && hInput && manualGo) {
      manualGo.addEventListener("click", () => {
        const w = Number.parseInt(wInput.value, 10);
        const h2 = Number.parseInt(hInput.value, 10);
        if (!Number.isFinite(w) || !Number.isFinite(h2)) {
          showError("Put a pixel width and height in both boxes.");
          return;
        }
        accept({ width: w, height: h2 }, null);
      });
    }
    const unitHost = root.querySelector("[data-pfc-unit]");
    if (unitHost) {
      const buttons = Array.from(unitHost.querySelectorAll("button[data-unit]"));
      const sync = () => {
        for (const b of buttons) {
          b.setAttribute("aria-pressed", String(b.dataset["unit"] === state.unit));
        }
      };
      for (const b of buttons) {
        b.addEventListener("click", () => {
          const next = b.dataset["unit"];
          if (next !== "cm" && next !== "in" && next !== "mm") return;
          state.unit = next;
          sync();
          draw();
        });
      }
      sync();
    }
  });
})();
