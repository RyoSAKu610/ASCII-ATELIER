import { MOTIF_LABELS, STYLES, defaultOptions, detectMotif, generateAscii, imageToAscii } from './generator.js'
import { downloadPng, downloadSvg, downloadText } from './export.js'
import { createAsciiWorldGame } from './game.js'
import {
  MASTERPIECE_TRAIL,
  getTrailEntry,
  makeInfiniteSamples,
  makeSamplePrompt,
  makeStudyPrompt,
  randomTrailIndex,
  trailIndex,
} from './inspirations.js'

const STORAGE_KEY = 'ascii-atelier-shelf-v4'
const SETTINGS_KEY = 'ascii-atelier-settings-v4'

const examples = [
  '雨の東京をネオン調で',
  '月を見上げる黒猫',
  '古い端末で眠るロボット',
  '星の海を泳ぐドラゴン',
  '花が咲く小さな山小屋',
  '森に立つ古い樹',
  '夜明けの鳥が羽ばたく',
  'cyberpunk skyline at midnight',
]

const palettes = [
  { id: 'aurora', label: 'Aurora', bg: '#050712', ink: '#eaffff', accent: '#6cf6ff', glow: '#78ffbf' },
  { id: 'amber', label: 'Amber CRT', bg: '#120d04', ink: '#fff1c2', accent: '#ffbe55', glow: '#ff7a3d' },
  { id: 'sakura', label: 'Sakura', bg: '#130810', ink: '#ffeaf7', accent: '#ff8fcb', glow: '#b5a7ff' },
  { id: 'paper', label: 'Paper', bg: '#f7f2e7', ink: '#211b16', accent: '#7f5cff', glow: '#14a87b' },
  { id: 'matrix', label: 'Matrix', bg: '#020802', ink: '#dbffe4', accent: '#48ff74', glow: '#19d66b' },
]

const savedSettings = safeJson(localStorage.getItem(SETTINGS_KEY), {})

const state = {
  prompt: savedSettings.prompt || examples[0],
  options: {
    ...defaultOptions,
    ...(savedSettings.options || {}),
  },
  palette: savedSettings.palette || 'aurora',
  zoom: savedSettings.zoom || 1,
  result: null,
  variants: [],
  shelf: safeJson(localStorage.getItem(STORAGE_KEY), []),
  inspirationIndex: savedSettings.inspirationIndex || 0,
  sampleCursor: savedSettings.sampleCursor || 0,
  sampleIdea: null,
  sampleBatch: [],
  editing: false,
  undo: [],
  redo: [],
  status: 'Ready',
}

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="ASCII ATELIER">
      <span class="brand-mark">Aa</span>
      <span><b>ASCII ATELIER</b><small>prompt to text-art studio</small></span>
    </a>
    <nav class="top-actions" aria-label="Quick actions">
      <button class="primary-button play-world-button" id="openWorld" type="button"><span>@</span> Play World</button>
      <button class="ghost-button" id="randomPrompt" type="button">Surprise</button>
      <button class="ghost-button" id="openShelf" type="button">Shelf <span id="shelfCount">0</span></button>
      <button class="icon-button" id="openHelp" type="button" title="Help">?</button>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">text becomes atmosphere</p>
        <h1>言葉から、飾れるASCIIアートを。</h1>
        <p>お題を入れるだけで、モチーフ判定・スタイル調整・画像変換・保存・書き出しまでできる、小さな文字絵アトリエです。</p>
      </div>
      <div class="hero-card" aria-label="Studio signal">
        <span class="live-dot"></span>
        <b id="motifBadge">motif: --</b>
        <small>deterministic / local / exportable</small>
      </div>
    </section>

    <section class="studio-grid">
      <aside class="control-panel" aria-label="Generation controls">
        <form id="promptForm" class="prompt-box">
          <label for="promptInput">お題 / Prompt</label>
          <textarea id="promptInput" rows="5" spellcheck="false" placeholder="例: 雨の東京をネオン調で"></textarea>
          <div class="prompt-actions">
            <button class="primary-button" type="submit">Generate</button>
            <button class="secondary-button" id="variantButton" type="button">3 Variants</button>
          </div>
          <small>Ctrl / ⌘ + Enter でも生成できます。</small>
        </form>

        <div class="example-cloud" id="exampleCloud" aria-label="Example prompts"></div>

        <section class="panel-block prompt-forge" aria-label="Infinite prompt samples">
          <div class="panel-title">
            <h2>∞ Prompt Forge</h2>
            <span id="sampleCounter"></span>
          </div>
          <p id="sampleText"></p>
          <small id="sampleSource"></small>
          <div class="sample-batch" id="sampleBatch"></div>
          <div class="mini-actions">
            <button class="primary-button" id="useSampleButton" type="button">Use Sample</button>
            <button class="secondary-button" id="newSampleButton" type="button">Next ∞</button>
            <button class="secondary-button" id="randomSampleButton" type="button">Random</button>
          </div>
        </section>

        <section class="panel-block">
          <div class="panel-title">
            <h2>Style</h2>
            <span id="styleCaption"></span>
          </div>
          <div class="style-grid" id="styleGrid"></div>
        </section>

        <section class="panel-block sliders">
          <div class="range-row">
            <label for="widthRange">Width <b id="widthValue"></b></label>
            <input id="widthRange" type="range" min="32" max="156" step="4" />
          </div>
          <div class="range-row">
            <label for="heightRange">Height <b id="heightValue"></b></label>
            <input id="heightRange" type="range" min="14" max="76" step="2" />
          </div>
          <div class="range-row">
            <label for="densityRange">Density <b id="densityValue"></b></label>
            <input id="densityRange" type="range" min="10" max="130" step="5" />
          </div>
          <div class="range-row">
            <label for="contrastRange">Contrast <b id="contrastValue"></b></label>
            <input id="contrastRange" type="range" min="20" max="170" step="1" />
          </div>
          <div class="range-row">
            <label for="craftRange">Craft <b id="craftValue"></b></label>
            <input id="craftRange" type="range" min="0" max="100" step="1" />
          </div>
          <label class="toggle-line">
            <input id="invertToggle" type="checkbox" />
            <span>Invert brightness</span>
          </label>
        </section>

        <section class="panel-block">
          <div class="panel-title">
            <h2>Palette</h2>
            <span>見た目だけを変更</span>
          </div>
          <div class="palette-grid" id="paletteGrid"></div>
        </section>

        <section class="panel-block upload-zone" id="dropZone">
          <input id="imageInput" type="file" accept="image/png,image/jpeg,image/webp" />
          <b>画像からASCIIへ</b>
          <span>クリック、またはここへドロップ</span>
        </section>
      </aside>

      <section class="preview-panel" aria-label="ASCII preview">
        <div class="preview-toolbar">
          <div>
            <p class="eyebrow">live canvas</p>
            <h2 id="artTitle">Untitled artifact</h2>
          </div>
          <div class="toolbar-actions">
            <button class="secondary-button" id="undoButton" type="button">Undo</button>
            <button class="secondary-button" id="redoButton" type="button">Redo</button>
            <button class="secondary-button" id="editButton" type="button">Edit</button>
            <button class="secondary-button" id="fullButton" type="button">Focus</button>
          </div>
        </div>

        <div class="meta-strip" id="metaStrip"></div>
        <div class="craft-notes" id="craftNotes" aria-label="Craft notes"></div>

        <div class="art-frame" id="artFrame">
          <pre id="asciiOutput" aria-label="Generated ASCII art"></pre>
          <textarea id="asciiEditor" spellcheck="false" aria-label="Edit ASCII art"></textarea>
        </div>

        <div class="preview-footer">
          <div class="zoom-group" aria-label="Zoom">
            <button class="icon-button" id="zoomOut" type="button">−</button>
            <span id="zoomLabel">100%</span>
            <button class="icon-button" id="zoomIn" type="button">+</button>
          </div>
          <div class="export-actions">
            <button class="secondary-button" id="worldFromArtButton" type="button">Enter World</button>
            <button class="secondary-button" id="copyButton" type="button">Copy</button>
            <button class="secondary-button" id="saveButton" type="button">Save</button>
            <button class="secondary-button" id="txtButton" type="button">TXT</button>
            <button class="secondary-button" id="svgButton" type="button">SVG</button>
            <button class="primary-button" id="pngButton" type="button">PNG</button>
          </div>
        </div>
      </section>
    </section>

    <section class="variant-section" aria-label="Generated variants">
      <div class="section-head">
        <p class="eyebrow">parallel sketches</p>
        <h2>Variants</h2>
      </div>
      <div class="variant-grid" id="variantGrid"></div>
    </section>

    <section class="inspiration-section" id="masterpieceTrail" aria-label="Masterpiece trail">
      <div class="section-head">
        <div>
          <p class="eyebrow">masterpiece trail</p>
          <h2>受賞作・名作から辿る研究ノート</h2>
        </div>
        <div class="trail-nav">
          <button class="secondary-button" id="prevTrail" type="button">Prev</button>
          <button class="secondary-button" id="nextTrail" type="button">Next</button>
          <button class="primary-button" id="randomTrail" type="button">Random</button>
        </div>
      </div>
      <div class="trail-layout">
        <article class="trail-feature" id="trailFeature"></article>
        <div class="trail-list" id="trailList"></div>
      </div>
    </section>
  </main>

  <section class="world-overlay" id="worldOverlay" aria-hidden="true" hidden></section>

  <aside class="shelf-drawer" id="shelfDrawer" aria-label="Saved shelf" aria-hidden="true">
    <div class="drawer-head">
      <div>
        <p class="eyebrow">saved works</p>
        <h2>Atelier Shelf</h2>
      </div>
      <button class="icon-button" id="closeShelf" type="button">×</button>
    </div>
    <div id="shelfList" class="shelf-list"></div>
  </aside>

  <dialog id="helpDialog">
    <div class="drawer-head">
      <div>
        <p class="eyebrow">tips</p>
        <h2>使い方</h2>
      </div>
      <button class="icon-button" id="closeHelp" type="button">×</button>
    </div>
    <p>日本語でも英語でもOK。猫、街、山、海、花、宇宙、ドラゴン、ハートなどは自動でモチーフ化されます。</p>
    <p>Craft を上げるほど、輪郭線・曲線・特徴点を優先した「手描きASCII」寄りになります。下げると画像処理っぽい粒状の表現になります。</p>
    <p>∞ Prompt Forge は、受賞作や高品質テキストアートから抽出した構図レッスンをもとに、転載ではないオリジナルお題を無限に作ります。</p>
    <p>Masterpiece Trail は、外部の受賞作・名作・アーカイブを順番またはランダムに辿るための研究カードです。作品本文は埋め込まず、技法ノートと出典リンクだけを扱います。</p>
    <p>Play World では、現在のお題から生まれたASCII世界を @ で探索できます。文字を採掘・配置・クラフトし、Frame Scene でアトリエへ景色を持ち帰れます。</p>
    <p>完成した文字絵は直接編集でき、TXT / SVG / PNGとして保存できます。処理はブラウザ内で完結します。</p>
  </dialog>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`

const $ = (selector) => document.querySelector(selector)

const worldGame = createAsciiWorldGame({
  root: $('#worldOverlay'),
  getSource: () => ({ prompt: state.prompt, motif: detectMotif(state.prompt) }),
  onFrame: ({ art, width, height, title, prompt }) => {
    state.prompt = prompt
    state.options = {
      ...state.options,
      width: Math.max(32, Math.min(156, width)),
      height: Math.max(14, Math.min(76, height)),
      style: 'etch',
      craft: 100,
    }
    state.result = {
      prompt,
      motif: 'abstract',
      seed: 0,
      style: 'etch',
      width,
      height,
      art,
      craftNotes: ['captured from ATELIER WILDS', 'player-built glyph structure', 'ready for manual editing and export'],
    }
    state.status = `World framed · ${title}`
    state.editing = false
    persistSettings()
    render()
  },
  notify: toast,
})

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function currentPalette() {
  return palettes.find((palette) => palette.id === state.palette) || palettes[0]
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    prompt: state.prompt,
    options: state.options,
    palette: state.palette,
    zoom: state.zoom,
    inspirationIndex: state.inspirationIndex,
    sampleCursor: state.sampleCursor,
  }))
}

function generate({ variants = false } = {}) {
  state.result = generateAscii(state.prompt, state.options)
  state.status = 'Generated'
  state.undo = []
  state.redo = []
  if (variants) {
    state.variants = [1, 2, 3].map((shift) => generateAscii(state.prompt, {
      ...state.options,
      seedShift: (state.options.seedShift || 0) + shift * 137,
    }))
  }
  persistSettings()
  render()
  toast(variants ? '3つの別案を描きました。' : 'ASCIIを生成しました。')
}

function render() {
  const palette = currentPalette()
  document.documentElement.style.setProperty('--canvas-bg', palette.bg)
  document.documentElement.style.setProperty('--canvas-ink', palette.ink)
  document.documentElement.style.setProperty('--accent', palette.accent)
  document.documentElement.style.setProperty('--glow', palette.glow)
  document.body.dataset.palette = palette.id

  $('#promptInput').value = state.prompt
  $('#widthRange').value = state.options.width
  $('#heightRange').value = state.options.height
  $('#densityRange').value = state.options.density
  $('#contrastRange').value = state.options.contrast
  $('#craftRange').value = state.options.craft
  $('#invertToggle').checked = state.options.invert
  $('#widthValue').textContent = state.options.width
  $('#heightValue').textContent = state.options.height
  $('#densityValue').textContent = `${state.options.density}%`
  $('#contrastValue').textContent = `${state.options.contrast}%`
  $('#craftValue').textContent = `${state.options.craft}%`
  $('#zoomLabel').textContent = `${Math.round(state.zoom * 100)}%`
  $('#artFrame').style.setProperty('--zoom', state.zoom)

  renderExamples()
  renderPromptForge()
  renderStyles()
  renderPalettes()
  renderArt()
  renderVariants()
  renderShelf()
  renderTrail()
}

function renderExamples() {
  $('#exampleCloud').innerHTML = examples.map((example) => `
    <button type="button" data-example="${escapeHtml(example)}">${escapeHtml(example)}</button>
  `).join('')
}

function renderPromptForge() {
  if (!state.sampleIdea) state.sampleIdea = makeSamplePrompt(state.sampleCursor, currentTrailEntry())
  if (!state.sampleBatch.length) state.sampleBatch = makeInfiniteSamples(3, state.sampleCursor + 23, currentTrailEntry())
  $('#sampleCounter').textContent = `#${state.sampleCursor.toLocaleString()}`
  $('#sampleText').textContent = state.sampleIdea.prompt
  $('#sampleSource').textContent = `${state.sampleIdea.sourceTitle} / ${state.sampleIdea.sourceRank}`
  $('#sampleBatch').innerHTML = state.sampleBatch.map((sample, index) => `
    <button type="button" data-sample="${index}">
      <b>${escapeHtml(sample.sourceTitle)}</b>
      <span>${escapeHtml(sample.prompt)}</span>
    </button>
  `).join('')
}

function renderTrail() {
  const entry = currentTrailEntry()
  const studyPrompt = makeStudyPrompt(entry, state.sampleCursor)
  $('#trailFeature').innerHTML = `
    <div class="trail-kicker">
      <span>${escapeHtml(entry.rank)}</span>
      <span>${escapeHtml(entry.format)}</span>
    </div>
    <h3>${escapeHtml(entry.title)}</h3>
    <p class="trail-collection">${escapeHtml(entry.collection)}</p>
    <p>${escapeHtml(entry.lesson)}</p>
    <div class="tag-row">
      ${entry.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
    </div>
    <blockquote>${escapeHtml(studyPrompt)}</blockquote>
    <div class="mini-actions">
      <button class="primary-button" id="studyTrailButton" type="button">Generate Study</button>
      <button class="secondary-button" id="sampleTrailButton" type="button">3 Inspired Samples</button>
      <a class="source-link" href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noreferrer noopener">Open source ↗</a>
    </div>
    <small>作品本文は埋め込まず、出典リンクと技法ノートだけを扱います。</small>
  `
  $('#trailList').innerHTML = MASTERPIECE_TRAIL.map((item, index) => `
    <button class="${index === trailIndex(state.inspirationIndex) ? 'active' : ''}" type="button" data-trail="${index}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <b>${escapeHtml(item.title)}</b>
      <small>${escapeHtml(item.rank)} · ${escapeHtml(item.collection)}</small>
    </button>
  `).join('')
}

function renderStyles() {
  $('#styleCaption').textContent = STYLES[state.options.style]?.label || ''
  $('#styleGrid').innerHTML = Object.entries(STYLES).map(([id, style]) => `
    <button class="${id === state.options.style ? 'active' : ''}" type="button" data-style="${id}">
      <b>${style.label}</b>
      <small>${style.preview}</small>
    </button>
  `).join('')
}

function renderPalettes() {
  $('#paletteGrid').innerHTML = palettes.map((palette) => `
    <button class="${palette.id === state.palette ? 'active' : ''}" type="button" data-palette="${palette.id}">
      <span style="--swatch-bg:${palette.bg};--swatch-ink:${palette.ink};--swatch-accent:${palette.accent}"></span>
      ${palette.label}
    </button>
  `).join('')
}

function renderArt({ syncEditor = true } = {}) {
  if (!state.result) state.result = generateAscii(state.prompt, state.options)
  const { art, motif, width, height, style } = state.result
  $('#asciiOutput').textContent = art
  if (syncEditor) $('#asciiEditor').value = art
  $('#asciiOutput').hidden = state.editing
  $('#asciiEditor').hidden = !state.editing
  $('#editButton').textContent = state.editing ? 'Preview' : 'Edit'
  $('#artTitle').textContent = makeTitle(state.prompt)
  $('#motifBadge').textContent = `motif: ${MOTIF_LABELS[motif] || motif}`
  $('#metaStrip').innerHTML = [
    `${width} × ${height}`,
    `${art.length.toLocaleString()} glyphs`,
    STYLES[style]?.label || style,
    `Craft ${state.options.craft}%`,
    MOTIF_LABELS[motif] || motif,
    state.status,
  ].map((item) => `<span>${escapeHtml(item)}</span>`).join('')
  $('#craftNotes').innerHTML = (state.result.craftNotes || [])
    .map((note) => `<span>${escapeHtml(note)}</span>`)
    .join('')
  $('#undoButton').disabled = state.undo.length === 0
  $('#redoButton').disabled = state.redo.length === 0
}

function renderVariants() {
  $('#variantGrid').innerHTML = state.variants.length
    ? state.variants.map((variant, index) => `
      <button type="button" data-variant="${index}">
        <b>Variant ${index + 1}</b>
        <pre>${escapeHtml(variant.art.split('\n').slice(0, 10).join('\n'))}</pre>
      </button>
    `).join('')
    : `<p class="empty-note">3 Variants を押すと、同じお題から別の構図を並べます。</p>`
}

function renderShelf() {
  $('#shelfCount').textContent = String(state.shelf.length)
  $('#shelfList').innerHTML = state.shelf.length
    ? state.shelf.map((item, index) => `
      <article>
        <button type="button" data-load-shelf="${index}">
          <b>${escapeHtml(item.title)}</b>
          <small>${escapeHtml(item.prompt)}</small>
          <pre>${escapeHtml(item.art.split('\n').slice(0, 8).join('\n'))}</pre>
        </button>
        <button class="danger-link" type="button" data-delete-shelf="${index}">Delete</button>
      </article>
    `).join('')
    : '<p class="empty-note">まだ保存された作品はありません。</p>'
}

function makeTitle(prompt) {
  const motif = detectMotif(prompt)
  return `${MOTIF_LABELS[motif] || '未知の紋章'} / ${prompt.trim().slice(0, 32) || 'Untitled'}`
}

function currentTrailEntry() {
  return getTrailEntry(state.inspirationIndex)
}

function setTrail(index, { refreshSample = true, announce = true } = {}) {
  state.inspirationIndex = trailIndex(index)
  if (refreshSample) {
    state.sampleIdea = makeSamplePrompt(state.sampleCursor, currentTrailEntry())
    state.sampleBatch = makeInfiniteSamples(3, state.sampleCursor + 23, currentTrailEntry())
  }
  persistSettings()
  render()
  if (announce) toast(`${currentTrailEntry().title} の研究カードへ移動しました。`)
}

function drawSample({ random = false, use = false } = {}) {
  const step = random ? Math.floor(Math.random() * 900000) + Date.now() : state.sampleCursor + 1
  state.sampleCursor = step
  if (random && Math.random() > 0.45) state.inspirationIndex = randomTrailIndex(step, state.inspirationIndex)
  state.sampleIdea = makeSamplePrompt(state.sampleCursor, currentTrailEntry())
  state.sampleBatch = makeInfiniteSamples(3, state.sampleCursor + 23, currentTrailEntry())
  persistSettings()
  if (use) {
    applySample(state.sampleIdea)
  } else {
    render()
    toast(random ? 'ランダム研究お題を引きました。' : '次のお題サンプルを作りました。')
  }
}

function applySample(sample) {
  state.prompt = sample.prompt
  state.options = {
    ...state.options,
    ...sample.options,
  }
  state.palette = sample.palette || state.palette
  generate({ variants: true })
  toast(`${sample.sourceTitle} から学ぶオリジナルお題を生成しました。`)
}

function applyTrailStudy() {
  const entry = currentTrailEntry()
  state.prompt = makeStudyPrompt(entry, state.sampleCursor)
  state.options = {
    ...state.options,
    width: entry.width,
    height: entry.height,
    density: entry.density,
    contrast: entry.contrast,
    craft: entry.craft,
    style: entry.style,
    seedShift: (state.sampleCursor + trailIndex(state.inspirationIndex) * 313) % 10000,
  }
  state.palette = entry.palette || state.palette
  generate({ variants: true })
  toast(`${entry.title} の技法ノートから生成しました。`)
}

function pushUndo() {
  if (!state.result) return
  state.undo.push(state.result.art)
  if (state.undo.length > 40) state.undo.shift()
  state.redo = []
}

function setArt(art, status = 'Edited', { syncEditor = true } = {}) {
  state.result = {
    ...(state.result || generateAscii(state.prompt, state.options)),
    art,
    width: Math.max(...art.split('\n').map((line) => line.length)),
    height: art.split('\n').length,
    craftNotes: ['direct text edit', 'manual refinement preserved', 'export uses the edited canvas'],
  }
  state.status = status
  renderArt({ syncEditor })
}

function toast(message) {
  const node = $('#toast')
  node.textContent = message
  node.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => node.classList.remove('show'), 2200)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function scrollHashTarget() {
  if (!location.hash) return
  const target = document.querySelector(location.hash)
  if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
}

function bindEvents() {
  $('#openWorld').addEventListener('click', () => worldGame.open())
  $('#worldFromArtButton').addEventListener('click', () => worldGame.open({ fromSource: true }))

  $('#promptForm').addEventListener('submit', (event) => {
    event.preventDefault()
    state.prompt = $('#promptInput').value.trim() || '静かな夜に光る小さな記号'
    generate()
  })

  $('#promptInput').addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') $('#promptForm').requestSubmit()
  })

  $('#variantButton').addEventListener('click', () => {
    state.prompt = $('#promptInput').value.trim() || state.prompt
    generate({ variants: true })
  })

  $('#randomPrompt').addEventListener('click', () => {
    drawSample({ random: true, use: true })
  })

  $('#useSampleButton').addEventListener('click', () => applySample(state.sampleIdea || makeSamplePrompt(state.sampleCursor, currentTrailEntry())))
  $('#newSampleButton').addEventListener('click', () => drawSample())
  $('#randomSampleButton').addEventListener('click', () => drawSample({ random: true }))
  $('#sampleBatch').addEventListener('click', (event) => {
    const button = event.target.closest('[data-sample]')
    if (!button) return
    const sample = state.sampleBatch[Number(button.dataset.sample)]
    if (sample) {
      state.sampleIdea = sample
      applySample(sample)
    }
  })

  $('#exampleCloud').addEventListener('click', (event) => {
    const button = event.target.closest('[data-example]')
    if (!button) return
    state.prompt = button.dataset.example
    generate()
  })

  $('#styleGrid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-style]')
    if (!button) return
    state.options.style = button.dataset.style
    generate()
  })

  $('#paletteGrid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-palette]')
    if (!button) return
    state.palette = button.dataset.palette
    persistSettings()
    render()
  })

  for (const [id, key] of [['widthRange', 'width'], ['heightRange', 'height'], ['densityRange', 'density'], ['contrastRange', 'contrast'], ['craftRange', 'craft']]) {
    $(`#${id}`).addEventListener('input', (event) => {
      state.options[key] = Number(event.target.value)
      generate()
    })
  }

  $('#invertToggle').addEventListener('change', (event) => {
    state.options.invert = event.target.checked
    generate()
  })

  $('#asciiEditor').addEventListener('input', (event) => {
    pushUndo()
    setArt(event.target.value, 'Edited', { syncEditor: false })
  })

  $('#editButton').addEventListener('click', () => {
    state.editing = !state.editing
    renderArt()
  })

  $('#undoButton').addEventListener('click', () => {
    if (!state.undo.length) return
    state.redo.push(state.result.art)
    setArt(state.undo.pop(), 'Undo')
  })

  $('#redoButton').addEventListener('click', () => {
    if (!state.redo.length) return
    state.undo.push(state.result.art)
    setArt(state.redo.pop(), 'Redo')
  })

  $('#zoomOut').addEventListener('click', () => {
    state.zoom = Math.max(0.6, Math.round((state.zoom - 0.1) * 10) / 10)
    persistSettings()
    render()
  })

  $('#zoomIn').addEventListener('click', () => {
    state.zoom = Math.min(1.8, Math.round((state.zoom + 0.1) * 10) / 10)
    persistSettings()
    render()
  })

  $('#fullButton').addEventListener('click', () => $('#artFrame').requestFullscreen?.())

  $('#copyButton').addEventListener('click', async () => {
    await navigator.clipboard.writeText(state.result.art)
    toast('クリップボードにコピーしました。')
  })

  $('#saveButton').addEventListener('click', () => {
    const item = {
      title: makeTitle(state.prompt),
      prompt: state.prompt,
      options: state.options,
      palette: state.palette,
      art: state.result.art,
      savedAt: new Date().toISOString(),
    }
    state.shelf.unshift(item)
    state.shelf = state.shelf.slice(0, 24)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.shelf))
    renderShelf()
    toast('Atelier Shelf に保存しました。')
  })

  $('#txtButton').addEventListener('click', () => downloadText(`${makeTitle(state.prompt)}.txt`, state.result.art))
  $('#svgButton').addEventListener('click', () => downloadSvg(`${makeTitle(state.prompt)}.svg`, state.result.art, currentPalette()))
  $('#pngButton').addEventListener('click', () => downloadPng(`${makeTitle(state.prompt)}.png`, state.result.art, currentPalette()))

  $('#variantGrid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-variant]')
    if (!button) return
    state.result = state.variants[Number(button.dataset.variant)]
    state.prompt = state.result.prompt || state.prompt
    state.status = 'Variant selected'
    state.editing = false
    render()
    toast('別案をキャンバスに移しました。')
  })

  $('#masterpieceTrail').addEventListener('click', (event) => {
    const trailButton = event.target.closest('[data-trail]')
    if (trailButton) {
      setTrail(Number(trailButton.dataset.trail))
      return
    }
    if (event.target.closest('#studyTrailButton')) {
      applyTrailStudy()
      return
    }
    if (event.target.closest('#sampleTrailButton')) {
      state.sampleBatch = makeInfiniteSamples(3, state.sampleCursor + 101, currentTrailEntry())
      state.variants = state.sampleBatch.map((sample) => generateAscii(sample.prompt, {
        ...state.options,
        ...sample.options,
      }))
      state.sampleIdea = state.sampleBatch[0]
      render()
      toast('この研究カードから3つのサンプル案を並べました。')
    }
  })

  $('#prevTrail').addEventListener('click', () => setTrail(state.inspirationIndex - 1))
  $('#nextTrail').addEventListener('click', () => setTrail(state.inspirationIndex + 1))
  $('#randomTrail').addEventListener('click', () => setTrail(randomTrailIndex(Date.now(), state.inspirationIndex)))

  $('#openShelf').addEventListener('click', () => {
    $('#shelfDrawer').classList.add('open')
    $('#shelfDrawer').setAttribute('aria-hidden', 'false')
  })
  $('#closeShelf').addEventListener('click', () => {
    $('#shelfDrawer').classList.remove('open')
    $('#shelfDrawer').setAttribute('aria-hidden', 'true')
  })

  $('#shelfList').addEventListener('click', (event) => {
    const load = event.target.closest('[data-load-shelf]')
    const remove = event.target.closest('[data-delete-shelf]')
    if (load) {
      const item = state.shelf[Number(load.dataset.loadShelf)]
      state.prompt = item.prompt
      state.options = { ...defaultOptions, ...item.options }
      state.palette = item.palette || state.palette
      state.result = {
        art: item.art,
        motif: detectMotif(item.prompt),
        width: Math.max(...item.art.split('\n').map((line) => line.length)),
        height: item.art.split('\n').length,
        style: state.options.style,
      }
      state.status = 'Loaded'
      $('#shelfDrawer').classList.remove('open')
      render()
    }
    if (remove) {
      state.shelf.splice(Number(remove.dataset.deleteShelf), 1)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.shelf))
      renderShelf()
    }
  })

  $('#openHelp').addEventListener('click', () => $('#helpDialog').showModal())
  $('#closeHelp').addEventListener('click', () => $('#helpDialog').close())

  const dropZone = $('#dropZone')
  const imageInput = $('#imageInput')
  dropZone.addEventListener('click', () => imageInput.click())
  dropZone.addEventListener('dragover', (event) => {
    event.preventDefault()
    dropZone.classList.add('dragging')
  })
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'))
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault()
    dropZone.classList.remove('dragging')
    const file = event.dataTransfer.files?.[0]
    if (file) convertImage(file)
  })
  imageInput.addEventListener('change', (event) => {
    const file = event.target.files?.[0]
    if (file) convertImage(file)
  })
}

async function convertImage(file) {
  try {
    state.result = await imageToAscii(file, state.options)
    state.prompt = `画像変換: ${file.name}`
    state.status = 'Image converted'
    state.editing = false
    persistSettings()
    render()
    toast('画像をASCIIに変換しました。')
  } catch (error) {
    toast(error.message || '画像変換に失敗しました。')
  }
}

bindEvents()
generate({ variants: true })
scrollHashTarget()
window.addEventListener('hashchange', scrollHashTarget)

if (new URLSearchParams(location.search).get('mode') === 'world') {
  requestAnimationFrame(() => worldGame.open())
}

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
