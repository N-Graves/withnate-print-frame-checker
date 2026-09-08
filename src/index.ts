/**
 * Print and frame checker - entry point.
 *
 * Loaded as a plain script on one page and must do nothing on every other, so
 * everything hangs off finding the root element and bailing quietly when it
 * is not there.
 *
 * The markup is NOT built here. The page ships real, readable HTML and this
 * fills it in, because the site's rule is that content must never need
 * JavaScript to become visible. With scripting off a visitor still sees a
 * file input and an explanation; they simply do not get an answer.
 *
 * Nothing is uploaded, nothing is stored, and no request leaves the page.
 * Only the first 64KB of the chosen file is ever read.
 */

import {
  attachIntake,
  measureImage,
  mount,
  readHeaderBytes,
  type LengthUnit,
} from "@nasdigitaluk/withnate-tool-core";
import { renderResults } from "./render.js";
import type { Pixels } from "./quality.js";

interface State {
  px: Pixels | null;
  density: { x: number; y: number } | null;
  unit: LengthUnit;
}

/** Below this a "print" is a thumbnail and the answer is not worth giving. */
const MIN_USEFUL_EDGE = 32;
/** Above this something has gone wrong in whatever produced the file. */
const MAX_SANE_EDGE = 100_000;

mount("[data-pfc]", ({ root }) => {
  const intake = root.querySelector<HTMLElement>("[data-pfc-intake]");
  const results = root.querySelector<HTMLElement>("[data-pfc-results]");
  const errorOut = root.querySelector<HTMLElement>("[data-pfc-error]");
  if (!intake || !results) return;

  const state: State = { px: null, density: null, unit: "cm" };

  const showError = (message: string): void => {
    if (errorOut) errorOut.textContent = message;
    results.replaceChildren();
  };
  const clearError = (): void => {
    if (errorOut) errorOut.textContent = "";
  };

  const draw = (): void => {
    if (!state.px) return;
    clearError();
    results.replaceChildren(
      renderResults({ px: state.px, declaredDensity: state.density, unit: state.unit }),
    );
  };

  const accept = (px: Pixels, density: { x: number; y: number } | null): void => {
    if (
      px.width < MIN_USEFUL_EDGE ||
      px.height < MIN_USEFUL_EDGE ||
      px.width > MAX_SANE_EDGE ||
      px.height > MAX_SANE_EDGE
    ) {
      showError("Those dimensions do not look like a real image. Have another go.");
      return;
    }
    state.px = px;
    state.density = density;
    draw();
  };

  // ------------------------------------------------------------ from a file

  attachIntake(intake, {
    onReject: showError,
    onFile: (file) => {
      clearError();
      void readHeaderBytes(file)
        .then((bytes) => {
          const m = measureImage(bytes);
          if (!m) {
            showError(
              "That file could not be read as a PNG, JPEG, GIF or WebP. If it is a HEIC from an iPhone, export it as JPEG first.",
            );
            return;
          }
          accept({ width: m.width, height: m.height }, m.density);
        })
        .catch(() => {
          // Reading a local slice essentially cannot fail, but a file that
          // vanished between the pick and the read would land here, and a
          // silent nothing looks identical to a broken tool.
          showError("That file could not be opened. Try choosing it again.");
        });
    },
  });

  // ------------------------------------ typed dimensions, for people who know

  const wInput = root.querySelector<HTMLInputElement>("[data-pfc-w]");
  const hInput = root.querySelector<HTMLInputElement>("[data-pfc-h]");
  const manualGo = root.querySelector<HTMLButtonElement>("[data-pfc-manual]");
  if (wInput && hInput && manualGo) {
    manualGo.addEventListener("click", () => {
      const w = Number.parseInt(wInput.value, 10);
      const h = Number.parseInt(hInput.value, 10);
      if (!Number.isFinite(w) || !Number.isFinite(h)) {
        showError("Put a pixel width and height in both boxes.");
        return;
      }
      // Typed dimensions carry no file, so there is no declared density to
      // report. Passing null is the honest answer rather than assuming 72.
      accept({ width: w, height: h }, null);
    });
  }

  // ------------------------------------------------------------- unit toggle

  const unitHost = root.querySelector<HTMLElement>("[data-pfc-unit]");
  if (unitHost) {
    const buttons = Array.from(unitHost.querySelectorAll<HTMLButtonElement>("button[data-unit]"));
    const sync = (): void => {
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
