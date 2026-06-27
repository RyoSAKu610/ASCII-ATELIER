# ASCII ATELIER

ASCII ATELIER is a local-first browser studio that turns a prompt or image into polished ASCII art. It is designed to feel like a tiny creative atelier: generate, tune, edit, save, and export without any backend or API key.

## Features

- Prompt-to-ASCII generation with Japanese and English motif detection
- Motifs for cats, robots, mountains, cities, ocean scenes, flowers, space, dragons, hearts, and abstract forms
- Five visual styles: Classic, Soft Shade, Noir Ink, Cyber Glyph, and Block Poster
- Controls for width, height, density, contrast, invert, zoom, and color palette
- 3-variant sketch generation
- Direct editing with undo / redo
- Image-to-ASCII conversion in the browser
- Local shelf using `localStorage`
- Export to TXT, SVG, and PNG

## Run locally

Node.js 20 or newer is required.

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:4173
```

Change the port if needed:

```bash
PORT=8080 npm run dev
```

## Validate

```bash
npm run check
```

The app is a dependency-free static ES module app. The included tests cover deterministic generation, motif recognition, style output, and safe fallback behavior.

## Deploy

The repository can be hosted directly from GitHub Pages because it only needs:

- `index.html`
- `src/*.js`
- `src/styles.css`

No build step is required.
