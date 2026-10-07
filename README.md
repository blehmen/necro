# Sibling Rivalry Companion PWA v0.2

Android-friendly PWA for the Sibling Rivalry event.

## Included in v0.2
- 67 guide steps from the supplied workbook, split into Day 1 / Day 2 / Day 3.
- Persistent checkboxes using localStorage.
- Event countdown and fixed-time guide-step urgency.
- Sleep / awake mode.
- Screenshot import.
- Browser OCR for top-bar resources (Tesseract.js, loaded from jsDelivr on first use).
- Best-effort 5x8 board icon recognition using wiki sprite assets, with a mandatory review/edit step before applying.
- Manual board/station corrections.
- Forecast engine based on the workbook's Forecast Tool and AT + Bombs formulas.
- Explicit forecast assumptions and recommendations.
- Wiki image assets bundled locally where the saved wiki page contained the actual sprite data.

## Important
The saved wiki page contains some blank/lazy-loaded sprite placeholders. Those files are retained by filename but are not used as recognition templates when they contain no actual pixels. The recognizer is deliberately reviewable rather than silently applying uncertain detections.

## Install
1. Extract this folder.
2. Host it on HTTPS (GitHub Pages is easiest) or any static web host.
3. Open the URL in Chrome on Android.
4. Use Chrome menu -> Add to Home screen / Install app.

## Screenshot workflow
1. Screenshot the NecroMerger event board.
2. Open the PWA and tap Update from Screenshot.
3. Let OCR and board detection finish.
4. Correct any uncertain values/cells.
5. Tap Apply detected state.
6. The Plan and Forecast recalculate from the applied state.

## Source
Strategy data is derived from the user-supplied Sibling Rivalry Guide workbook and the saved Sibling Rivalry wiki page. No gameplay values are silently replaced with generic NecroMerger knowledge.
