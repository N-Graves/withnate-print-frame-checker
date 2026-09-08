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

const MIN_USEFUL_EDGE = 32;

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

          showError("That file could not be opened. Try choosing it again.");
        });
    },
  });

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

      accept({ width: w, height: h }, null);
    });
  }

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
