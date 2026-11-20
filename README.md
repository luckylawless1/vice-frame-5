# VICE FRAME 5 — GTA-Style Cover Art Maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/luckylawless1/vice-frame-5/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/luckylawless1/vice-frame-5/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

VICE FRAME 5 is an offline web app that turns any photo plus a caption into
GTA-style multi-panel cover art, exported as a PNG in three sizes:
**1080×1080**, **1080×1350** and **1920×1080**. It is plain static files —
no build step, no network, no dependencies — and runs in a desktop browser
straight from disk.

## Run it

- Open `app/index.html` in Chrome, or
- serve the repo root with `node serve.ts` and open the printed local
  address (http://localhost:8080 by default).

## What it does

- **Photos** — 9 bundled sample photos (generated for this entry: neon
  marina, casino strip, diner night and more), plus your own: upload
  multiple files or drag & drop them onto the cover. Click a panel on the
  canvas to select it, then click a thumbnail to put that photo into the
  selected panel.
- **Framing** — drag on the canvas to pan the selected panel's photo,
  zoom with the mouse wheel or the 1–3 zoom slider, double-click a panel
  to reset its framing, and nudge with the arrow keys (Shift for bigger
  steps).
- **Layouts (6)** — Cover Star (big left + two stacked right), Collage
  Four (2×2), Panel Grid (3×2), Crew Wide (wide top + two below), Cover
  Closeup (one huge hero panel at ~75% width + two insets) and Angled
  Grid (diagonal-cut parallelogram panels).
- **Grades (7)** — Clean, Vice Sunset, Neon Night, Ink Poster (posterize
  + Sobel ink edges + halftone dots), Duotone Heat (grayscale mapped to a
  pink/teal duotone ramp), Split Tone and Golden Hour. Grades are
  per-panel, with an apply-to-all button.
- **Words** — editable Title, Tagline and Caption. The masthead is set in
  Anton (shipped under `app/fonts/` with its OFL license), wrapped and
  measured, with a pink→violet→teal gradient fill and a dark outline. A
  row of 5 gold wanted-stars is always laid out from the measured bottom
  edge of the wrapped title, so it can never overlap the masthead. The
  tagline sits under the stars with a neon pink glow and a slight shear;
  the caption sits in a dark rounded bar near the bottom, set in Archivo
  Black (also shipped, OFL), with a pink→teal accent strip on top.
- **Dressing** — toggleable canvas-drawn stickers (neon palm, “NEW!”
  starburst — always inset from the canvas edges so it is never clipped —
  and a sun badge), film grain from a seeded noise tile, a deterministic
  canvas-drawn magazine barcode block (seeded PRNG) and the editorial
  line “ISSUE 06 · LAS LUMEN · $6.99” bottom-right above the caption bar.
- **Export** — one click exports the current size as a PNG, or use
  “Export all 3 sizes” to download 1080×1080, 1080×1350 and 1920×1080.
- **Screenshot scenes** — `?shot=cover` hides the editor and shows only
  the cover; `?shot=editor` shows the normal editor. Both accept
  `photo=`, `caption=`, `title=`, `layout=` and `size=` query params (see
  `shots.json` for the four scenes shipped in `screenshots/`).

Everything is original: no Rockstar logos, wordmarks, artwork or fonts.
The two display fonts are open-licensed (SIL Open Font License, texts in
`app/fonts/`).

## Layout of this repo

- `app/` — the web app (static HTML/CSS/JS, ES modules, canvas rendering).
- `screenshots/` — four JPEG captures of the running app.
- `main.ts` — the hand-in program: copies `app/` and `screenshots/` to
  the output directory and writes `dossier.json` with the vendored
  library.
- `serve.ts` — a small local static server for previewing `app/`.
- `vendor/` — the kit's vendored library (untouched).
