# withnate-print-frame-checker

Drop an image in and find out how big you can actually print it, which UK frames it fits, and how
much mount border you need — in one answer rather than three separate calculators.

**Everything runs in the browser, and the image is never decoded.** The answer comes from the first
64KB of the file, so nothing is uploaded, nothing is stored, and a 60 megapixel photo costs the same
as a thumbnail.

MIT licensed.

## Why this rather than another DPI converter

The existing tools split the question in three and answer none of it fully. Print-size calculators
are US-centric and stop at "maximum print size". UK framing sites explain A-series versus imperial in
prose. Mount calculators exist but are input-only and never see your file.

The gap is the join: **from *here is my file* to *here is the frame to buy*.**

There is a second reason. "Increase my image to 300 DPI" is one of the most-searched image tasks
there is, and most tools that answer it edit a metadata tag and change nothing — a 900 × 600 image
tagged 300 DPI is still 900 × 600, it has just declared that it should print three inches wide. This
tool puts the visitor's own numbers into that sentence instead of doing it for them.

## The framing maths

Ported from this project's own 3D mockup studio, where the geometry had to be physically correct in
order to render — a mount cut wrong there produced a visible strip of bare backing that a reviewer
rejected, so these numbers have been through contact with reality rather than a diagram.

```
aperture     = paper − 2 × overlap        overlap = 0.16" matted, 0.12" rabbet unmatted
mount outer  = aperture + 2 × border
frame outer  = mount outer + 2 × moulding
```

The load-bearing rule is the overlap: **a real framer cuts the aperture slightly smaller than the
paper and laps over the edge.** Cut it the same size and the print falls through the hole, and bare
backing shows at the edges at any viewing angle.

### One correction to the original

The studio applies a single uniform border, because it is building a scene it controls and never has
to answer this question. In the real case **the frame is fixed and the print is whatever it is, so
the side and top borders are usually different** — and the tool reports them separately.

> A4 in an A3 frame gives **48mm at the sides and 66mm top and bottom.** A uniform border only
> happens when the frame and the print differ by the same amount in both directions, which is rare
> and never true between the A-series and imperial families. Averaging them would describe a mount
> nobody could cut.

## Integration

The script is a plain IIFE. It does nothing unless the page contains an element with `data-pfc`, so
it is safe to load anywhere. Copy `dist/print-frame-checker.js` and `dist/print-frame-checker.css`
into the site's assets and reference them from the page — no build step, no module, no dependency to
resolve at runtime.

**The markup is not built by the script.** The page ships real HTML and this fills it in, because
content must never need JavaScript to become visible. `demo/index.html` is the working contract; the
hooks are:

| Attribute | Required | What it is |
|---|---|---|
| `data-pfc` | yes | The root. Absent, the script does nothing at all. |
| `data-pfc-intake` | yes | Drop target. Must contain an `<input type="file">`, which is *found*, not created. |
| `data-pfc-results` | yes | Where the answer is written. |
| `data-pfc-error` | no | Refusals land here as text. Give it `role="status"`. |
| `data-pfc-w` / `data-pfc-h` / `data-pfc-manual` | no | Typed dimensions, for people who already know them. |
| `data-pfc-unit` | no | Contains `button[data-unit="cm"|"in"|"mm"]`. Kept in sync via `aria-pressed`. |

It reuses the site's existing `.btn`, `.fam`, `.glass`, `.eyebrow`, `.lede`, `.sw` and `.vh` rather
than restyling them, and **the stylesheet defines only `.pfc-` classes** — there is a smoke check
that fails the build if that stops being true, because two definitions of a site class is a fight
decided by load order.

`demo/demo.css` is stand-ins for those site classes so the demo page is readable on its own. It is
not part of the deliverable and must not be copied across.

## Known limits

- **JPEG density is read from the JFIF segment only, not Exif.** A photo straight off a phone
  usually reports no declared density. That is the absence of a number rather than a wrong one, and
  it does not affect the primary answer, which comes from the pixel count. It closes when the
  metadata viewer lands and Exif parsing is extracted back into the shared core.
- **No HEIC**, which is what an iPhone shoots by default. The tool says so and tells you to export
  as JPEG rather than failing silently.
- **Frame sizes are the common British ones, not a catalogue of everything sold.** A bespoke framer
  will cut any size; this answers what you can buy off a shelf.
- **Nothing here knows about paper stock, ink or a particular printer.** 300/200/150 are
  viewing-distance rules of thumb, and they are labelled as such on the page rather than presented
  as a specification.

## Testing

```bash
npm run lint    # tsc --noEmit
npm test        # 42 tests
npm run smoke   # 20 checks against the built bundle
npm run demo    # serves demo/ on :4173
```

The smoke tier is the browser equivalent of the stdio smoke used by the MCP servers here: it reads
the bundle that would be copied into the site and checks the properties the site enforces — no
module syntax, no network call, no storage, no external URL, no inline handler, and **it runs the
bundle against a stubbed document with no root element to prove it bails silently**. Several of
those fail at runtime with nothing in the console, so a unit test cannot catch them.

## Built on

[`@nasdigitaluk/withnate-tool-core`](https://github.com/N-Graves/withnate-tool-core).

## Licence

MIT.
