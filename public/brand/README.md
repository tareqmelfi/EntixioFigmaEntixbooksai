# ENSIDEX brand marks · document + print

`EN-BRAND-LOGO-Wordmark-Light-BG.*` — ink mark (`#1A1E48`, X in `#4661C7`) for light grounds.
`EN-BRAND-LOGO-Wordmark-Dark-BG.*`  — light mark (`#FFFFFF`, X in `#8FA3F0`) for dark grounds.

The mark is the letters `ENSIDEX` with the X in the brand colour — **no full stop**
(en-document-system §14) — drawn from Plus Jakarta Sans at `wght 800` and converted to
outlines, so the letterforms are identical everywhere and no font has to load.

SVG: cap height = 100 units; the viewBox is trimmed to the ink, so its height is the cap
plus the S overshoot. PNG: 2400 px wide, transparent, cap height ≈ 452 px.

**LOGO FRAME LAW.** Neither variant is ever placed on a chip, card, plate or rounded box.
On a dark sheet the light variant sits directly on the dark ground; on paper the ink
variant sits directly on the paper. A company with no light variant gets a light sheet —
the mark is never boxed to rescue it. The document engine enforces this
(`src/app/lib/document-render.ts`).
