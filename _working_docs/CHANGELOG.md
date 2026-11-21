# Changelog

## 2026-11-21 session 4

- Added contextual loading and processing feedback with elapsed time.
- Added GIF decode progress and measurable export frame percentage/ETA.
- Explicitly explains export-related playback pauses and offers visible safe cancellation.
- Added high-detail preview feedback while keeping the current preview visible.
- Verified locally and on the deployed desktop/mobile site.

## 2026-11-21 session 3

- Added a branded SVG favicon and minimal README introduction with immediate live URL.
- Moved all built-in presets into the first sidebar section and made every settings section collapsed by default.
- Replaced manual preview zoom with automatic container fitting.
- Verified adaptive layout across desktop, narrow mobile, tablet/landscape, and short viewports; pushed and deployed successfully.

## 2026-11-21 session 2

- Reorganized settings into clear progressive groups and a visual style list.
- Replaced conflicting cell-size/resolution controls with one Detail control.
- Added one format-aware Export window containing animated DOM-text HTML, canvas HTML, TXT frame, TXT sequence, PNG, and WebM outputs.
- Added pure selectable animated text playback without canvas, GIF, or video.
- Added unit and desktop/mobile download validation; pushed and verified GitHub Pages deployment.

## 2026-11-21 session 1

- Rebuilt Glyphmix as a modular Vite application with a polished responsive light interface.
- Added GIF fallback decoding, media cleanup, file safeguards, export cancellation/progress/ETA, memory estimates, transparent output, and robust feature messaging.
- Added undo/redo/reset, persistent settings, custom presets, original/effect comparison, preview zoom, keyboard controls, and help.
- Added centralized rendering primitives, automated lint/unit/build/browser/secret verification, and GitHub Pages automation.
- Verified 4 unit tests and 7 desktop/mobile browser tests; exercised PNG and standalone HTML downloads.
- Published to GitHub and verified a successful Pages workflow plus live desktop/mobile smoke tests.
