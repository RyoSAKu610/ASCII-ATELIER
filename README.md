# ASCII ATELIER

ASCII ATELIER is a local-first browser studio that turns a prompt or image into polished ASCII art. It is designed to feel like a tiny creative atelier: generate, tune, edit, save, and export without any backend or API key.

## 初めての方へ

公開版はこちらです:

- アトリエTOP: https://ryosaku610.github.io/ASCII-ATELIER/
- ATELIER WILDS 直行: https://ryosaku610.github.io/ASCII-ATELIER/?mode=world

3ステップで遊べます:

1. 作る: TOPでお題を入力して Generate（または画像から変換）。
2. 遊ぶ: 「▶ Worldで遊ぶ」で ATELIER WILDS へ。スマホは左右・ジャンプ・MINEボタン、PCは `A` / `D`・`Space`・`X` キー。
3. 持ち帰る: WILDS の Frame Scene で景色をアトリエへ送り、TXT / SVG / PNG で書き出し。「◀ Atelierに戻る」でいつでも TOP へ戻れます。

スマホは縦画面のまま親指操作できます。PWA対応なので、スマホのブラウザメニューからホーム画面に追加するとフルスクリーンで起動できます（`?mode=world` 始動にも対応）。

## Features

- Prompt-to-ASCII generation with Japanese and English motif detection
- Motifs for cats, robots, mountains, cities, ocean scenes, flowers, space, dragons, hearts, birds, trees, and abstract forms
- Six visual styles: Line Etching, Classic, Soft Shade, Noir Ink, Cyber Glyph, and Block Poster
- Structure-first generation: motif-specific outlines, curves, feature points, tone fill, prompt effects, and a final polish pass
- Infinite prompt sampling through Prompt Forge, seeded by award-winning and high-quality text-art study cards
- Masterpiece Trail for browsing contest winners, renowned ANSI/ASCII collections, and quality references in order or at random
- Controls for width, height, density, contrast, craft, invert, zoom, and color palette
- 3-variant sketch generation
- Direct editing with undo / redo
- Edge-aware image-to-ASCII conversion in the browser
- Local shelf using `localStorage`
- Export to TXT, SVG, and PNG
- **ATELIER WILDS**, a playable side-view ASCII sandbox generated from the current artwork prompt
- Mobile-first touch controls, keyboard controls, day/night atmosphere, crafting, local world saves, and installable PWA support
- Frame Scene workflow that sends a player-built world view back to the Atelier editor and exporters

## ATELIER WILDS

`Play World` opens a full-screen glyph sandbox where every character is both scenery and material. The player is `@`; terrain, trees, ores, water, lights, and ruins are generated deterministically from the current Atelier prompt and detected motif.

Core loop:

1. Explore a generated glyph biome.
2. Mine visible characters such as soil `:`, stone `#`, wood `|`, coal `c`, and crystals `*`.
3. Select a material from the hotbar and place it back into the world.
4. Craft planks `=` and glyph torches `!`.
5. Watch the world shift through dawn, day, dusk, and night.
6. Use **Frame Scene** to return the visible world to the normal ASCII editor, shelf, TXT, SVG, and PNG tools.

Controls:

- Mobile: left / jump / right buttons, Mine / Place modes, hotbar, and direct world-cell tapping
- Keyboard: `A` / `D` or arrow keys to move, `W` / `Space` to jump, `X` to mine, `C` to place, `1`–`6` to select materials, and `Escape` to pause
- Touch controls use Pointer Events and support safe-area insets, portrait, and landscape layouts

World progress is saved separately under `ascii-atelier-world-v1`. The app manifest and service worker allow supported mobile browsers to add ASCII ATELIER to the home screen and reopen the core app offline.

## Quality model

ASCII ATELIER does not treat ASCII art as a plain brightness conversion. The current engine uses a three-layer process inspired by classic ASCII art practice:

1. Structure pass: draw the recognisable skeleton first, such as cat ears and whiskers, city horizons, dragon spines, mountain ridges, or wave bands.
2. Tone pass: fill the form with density-controlled shade characters.
3. Polish pass: clean isolated noise, preserve negative space, add small feature glyphs, and expose craft notes in the UI.

The `Craft` slider controls how strongly the renderer prefers deliberate line glyphs over raw tone texture.

## Masterpiece Trail and Prompt Forge

The app includes a curated study trail of award-winning or historically strong text-art sources. It does not embed or redistribute the original artwork. Instead, each card stores:

- title, contest or collection context, and source link
- a craft lesson distilled from the work or scene culture
- style, palette, and canvas defaults for original generated studies
- prompt fragments used by the infinite sampler

`∞ Prompt Forge` can keep producing new prompts from these study cards, while `Masterpiece Trail` lets users move through the sources sequentially or randomly and open the original source externally.

### References used for the craft pass

- Christopher Johnson’s ASCII Art Collection tutorials: https://asciiart.website/tutorials.php
- Rowan Crawford, ASCII Graphical Techniques: https://www.roysac.com/tutorial/rowanasciiarttutorial.html
- Maija Haavisto / DiamonDie ASCII Art Tutorial: https://www.roysac.com/tutorial/diamondieasciiarttutorial.html
- Structure-based ASCII Art paper: https://ttwong12.github.io/papers/asciiart/asciiart.pdf
- Chafa renderer notes on preprocessing, dithering, and symbol ranges: https://hpjansson.org/blag/2019/01/07/the-worst-ansi-renderer-except-for-all-the-others/
- Realms of Despair ASCII Art Contest winners: https://realmsofdespair.com/index.php/ascii-art-contest/
- Revision 2024 textmode graphics competition listings: https://demozoo.org/parties/4791/
- CAFe 2019 oldschool textmode graphics listings: https://demozoo.org/parties/3727/
- 16colo.rs Blocktronics archive: https://16colo.rs/group/blocktronics
- IOCCC ASCII-shaped source-code overview: https://dan.gop/articles/ioccc-ascii-art/
- Roy/SAC Best Of text-art gallery: https://www.roysac.com/roy_bestof.html

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
