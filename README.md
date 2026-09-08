# withnate-print-frame-checker

Drop an image in and find out how big you can actually print it, which UK frames it fits, and how
much mount border you need — in one answer rather than three separate calculators.

**Everything runs in the browser. The file never leaves your device**, and the image is never
decoded: the answer comes from the header, which is a few hundred bytes.

MIT licensed. Status: **not built yet** — see the roadmap below.

## Why this rather than another DPI converter

The existing tools split the question in three and answer none of it fully. Print-size calculators
are US-centric and stop at "maximum print size". UK framing sites explain A-series versus imperial in
prose. Mount calculators exist but are input-only and never see your file.

The gap is the join: **from *here is my file* to *here is the frame to buy*.**

There is a second reason. "Increase my image to 300 DPI" is one of the most-searched image tasks
there is, and most tools that answer it edit a metadata tag and change nothing — a 900 × 600 image
tagged 300 DPI is still 900 × 600, it has just declared that it should print three inches wide. This
tool answers the question honestly instead: here is what your pixels genuinely support, and here is
what that tag actually means.

## What it will do

- Maximum print size at 300, 200 and 150 DPI, in both centimetres and inches
- Aspect ratio, and how far off the nearest standard it is
- Which standard UK frames it fits — A6 to A0, imperial 6×4 to 40×30, and squares
- For a chosen frame: the mount aperture, the border width, and whether a crop is needed
- What the file's own DPI tag claims, and why that number is not the answer

## The framing maths

Ported from this project's own 3D mockup studio, where the geometry had to be physically correct to
render:

```
aperture     = paper − 2 × overlap        overlap = 0.16" matted, 0.12" rabbet unmatted
mount outer  = aperture + 2 × border
frame outer  = mount outer + 2 × moulding
```

The load-bearing rule is the overlap: **a real framer cuts the aperture slightly smaller than the
paper and laps over the edge.** Cut it the same size and the print falls through the hole, and bare
backing shows at the edges at any viewing angle.

## Built on

[`@nasdigitaluk/withnate-tool-core`](https://github.com/N-Graves/withnate-tool-core).

## Licence

MIT.
