# Glyphmix

Browser editor that turns videos, GIFs, and images into animated text and pixel art without uploading media.

**Live:** https://ahmed-sleem.github.io/glyphmix/

## Run locally

```bash
npm install
npm run dev
```

## Verify and build

```bash
npm run verify
```

The production site is generated in `dist/` by `npm run build` and is suitable for GitHub Pages.

## Browser support

Modern Chromium, Firefox, and Safari are supported for editing and PNG/HTML export. WebM recording availability and codecs depend on the browser. Animated GIFs use WebCodecs when available and a bundled fallback elsewhere.
