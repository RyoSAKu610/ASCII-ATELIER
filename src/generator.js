export const defaultOptions = {
  width: 88,
  height: 38,
  density: 60,
  contrast: 90,
  craft: 92,
  style: 'etch',
  invert: false,
  seedShift: 0,
}

export const STYLES = {
  etch: {
    label: 'Line Etching',
    preview: ' .,/\\_|()',
    chars: "  .'`,:;~-_=+*xX#%@",
    grain: 0.028,
    edgeBias: 1,
  },
  classic: {
    label: 'Classic',
    preview: ' .:-=+*#%@',
    chars: '   ..,,::;;--==++**##%%@@',
    grain: 0.028,
    edgeBias: 0.88,
  },
  soft: {
    label: 'Soft Shade',
    preview: ' ·░▒▓█',
    chars: '  ·˙¨^~░░▒▒▓▓██',
    grain: 0.024,
    edgeBias: 0.72,
  },
  noir: {
    label: 'Noir Ink',
    preview: ' ░▒▓█@$',
    chars: '  ..,,--==++**##%%@@',
    grain: 0.06,
    edgeBias: 0.82,
  },
  cyber: {
    label: 'Cyber Glyph',
    preview: '01<>[]{}',
    chars: ' .`-:i!lI?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
    grain: 0.072,
    edgeBias: 0.78,
  },
  blocks: {
    label: 'Block Poster',
    preview: ' ▁▂▃▄▅▆▇█',
    chars: ' ▁▂▃▄▅▆▇█',
    grain: 0.014,
    edgeBias: 0.48,
  },
}

export const MOTIF_LABELS = {
  cat: '月夜の猫',
  robot: '眠る機械',
  mountain: '山の稜線',
  city: '街の灯り',
  ocean: '波の記憶',
  flower: '咲く花',
  space: '星の海',
  dragon: '竜の影',
  heart: '心の紋章',
  bird: '鳥の羽音',
  tree: '木漏れ日の樹',
  image: '画像変換',
  abstract: '未知の紋章',
}

const motifKeywords = [
  ['dragon', /dragon|竜|龍|ドラゴン|wyrm|serpent/i],
  ['cat', /cat|猫|ねこ|ネコ|kitten|黒猫/i],
  ['robot', /robot|android|mecha|ロボ|機械|端末|cyborg/i],
  ['mountain', /mountain|山|富士|稜線|小屋|峰|雪山/i],
  ['city', /city|tokyo|東京|街|都市|ビル|ネオン|skyline|street/i],
  ['ocean', /ocean|sea|wave|海|波|水|泳|船|whale|fish/i],
  ['flower', /flower|bloom|花|桜|庭|rose|lotus/i],
  ['space', /space|star|moon|cosmos|宇宙|星|月|銀河|planet|rocket/i],
  ['heart', /heart|love|ハート|心|愛/i],
  ['bird', /bird|eagle|owl|鳥|鷲|ふくろう|翼|羽/i],
  ['tree', /tree|forest|woods|木|森|樹|盆栽/i],
]

const EDGE_GLYPHS = {
  horizontal: ['-', '_', '~'],
  vertical: ['|', '!', 'l'],
  slash: ['/'],
  backslash: ['\\'],
  dot: ['.', ',', '`', "'"],
}

export function detectMotif(prompt = '') {
  const text = String(prompt)
  const strongSubject = motifKeywords
    .filter(([key]) => !['space', 'ocean'].includes(key))
    .find(([, pattern]) => pattern.test(text))
  if (strongSubject) return strongSubject[0]
  if (/星の海|宇宙|銀河|cosmos|outer space|planet|rocket/i.test(text)) return 'space'
  const hit = motifKeywords.find(([, pattern]) => pattern.test(prompt))
  return hit?.[0] || 'abstract'
}

export function hashText(value = '') {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function generateAscii(prompt = '', inputOptions = {}) {
  const options = normalizeOptions(inputOptions)
  const motif = detectMotif(prompt)
  const seed = (hashText(`${prompt}|${options.style}|${options.seedShift}|${options.craft}`) + options.seedShift) >>> 0
  const random = mulberry32(seed)
  const canvas = makeCanvas(options.width, options.height)
  const ctx = { prompt, motif, options, random, seed }

  drawUnderpainting(canvas, ctx)
  drawMotif(canvas, ctx)
  drawPromptEffects(canvas, ctx)
  polishCanvas(canvas, ctx)

  return {
    prompt,
    motif,
    seed,
    style: options.style,
    width: options.width,
    height: options.height,
    craftNotes: craftNotesFor(motif, options),
    art: renderCanvas(canvas, ctx),
  }
}

export async function imageToAscii(file, inputOptions = {}) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('画像ファイルを選んでください。')
  if (file.size > 12 * 1024 * 1024) throw new Error('画像は12MB以下にしてください。')

  const options = normalizeOptions(inputOptions)
  const bitmap = await createImageBitmap(file)
  const width = options.width
  const ratio = bitmap.height / Math.max(1, bitmap.width)
  const height = clamp(Math.round(width * ratio * 0.48), 12, options.height * 2)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const pixels = ctx.getImageData(0, 0, width, height).data
  const luminance = Array.from({ length: height }, () => Array(width).fill(0))
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      luminance[y][x] = (pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114) / 255
    }
  }

  const random = mulberry32(hashText(`${file.name}|${file.size}|${options.style}`))
  const style = STYLES[options.style]
  const lines = []
  for (let y = 0; y < height; y += 1) {
    let line = ''
    for (let x = 0; x < width; x += 1) {
      const center = luminance[y][x]
      const left = luminance[y][Math.max(0, x - 1)]
      const right = luminance[y][Math.min(width - 1, x + 1)]
      const up = luminance[Math.max(0, y - 1)][x]
      const down = luminance[Math.min(height - 1, y + 1)][x]
      const dx = right - left
      const dy = down - up
      const edge = Math.hypot(dx, dy)
      let value = clamp(((options.invert ? 1 - center : center) - 0.5) * (options.contrast / 82) + 0.5, 0, 1)
      value = clamp(value * (options.density / 92) + (random() - 0.5) * style.grain, 0, 1)

      if (edge > 0.16 - options.craft / 900 && options.style !== 'blocks') {
        line += lineGlyphForVector(-dy, dx, random)
      } else {
        line += toneChar(value, style, random)
      }
    }
    lines.push(line.trimEnd())
  }

  return {
    prompt: file.name,
    motif: 'image',
    seed: hashText(file.name),
    style: options.style,
    width,
    height,
    craftNotes: ['edge-aware image conversion', 'contrast-balanced tone ramp', 'monospace export'],
    art: lines.join('\n'),
  }
}

function normalizeOptions(input) {
  const options = { ...defaultOptions, ...input }
  return {
    ...options,
    width: clamp(Math.round(Number(options.width) || defaultOptions.width), 28, 156),
    height: clamp(Math.round(Number(options.height) || defaultOptions.height), 12, 76),
    density: clamp(Number(options.density) || defaultOptions.density, 0, 130),
    contrast: clamp(Number(options.contrast) || defaultOptions.contrast, 10, 170),
    craft: clamp(Number(options.craft) || defaultOptions.craft, 0, 100),
    style: STYLES[options.style] ? options.style : defaultOptions.style,
    invert: Boolean(options.invert),
    seedShift: Number(options.seedShift) || 0,
  }
}

function makeCanvas(width, height) {
  return {
    width,
    height,
    tone: Array.from({ length: height }, () => Array(width).fill(0)),
    glyph: Array.from({ length: height }, () => Array(width).fill('')),
    priority: Array.from({ length: height }, () => Array(width).fill(0)),
  }
}

function drawUnderpainting(canvas, { motif, random }) {
  const { width: w, height: h } = canvas
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const nx = x / Math.max(1, w - 1)
      const ny = y / Math.max(1, h - 1)
      const vignette = 1 - Math.hypot(nx - 0.5, ny - 0.48) * 1.28
      const diagonal = Math.sin((nx * 2.8 + ny * 1.6) * Math.PI) * 0.024
      const floorShade = ['city', 'mountain', 'ocean', 'tree'].includes(motif) ? Math.max(0, ny - 0.62) * 0.32 : 0
      const ambient = ['city', 'mountain', 'ocean', 'tree'].includes(motif) ? 0.026 : 0.012
      putTone(canvas, x, y, clamp(ambient + vignette * 0.066 + diagonal * 0.28 + floorShade * 0.68, 0, 0.32), 'max')
    }
  }

  if (['space', 'city', 'cat', 'mountain', 'dragon'].includes(motif)) {
    const starCount = Math.floor(w * h * (motif === 'space' ? 0.026 : 0.012))
    for (let i = 0; i < starCount; i += 1) {
      const x = Math.floor(random() * w)
      const y = Math.floor(random() * h * 0.62)
      const sparkle = random() > 0.88 ? '*' : random() > 0.62 ? '+' : '.'
      putGlyph(canvas, x, y, sparkle, 2, 0.72 + random() * 0.22)
    }
  }
}

function drawMotif(canvas, ctx) {
  const drawers = {
    cat: drawCat,
    robot: drawRobot,
    mountain: drawMountain,
    city: drawCity,
    ocean: drawOcean,
    flower: drawFlower,
    space: drawSpace,
    dragon: drawDragon,
    heart: drawHeart,
    bird: drawBird,
    tree: drawTree,
    abstract: drawAbstract,
  }
  ;(drawers[ctx.motif] || drawAbstract)(canvas, ctx)
}

function drawCat(canvas, { random }) {
  const { width: w, height: h } = canvas
  const cx = w * 0.5
  const cy = h * 0.48
  const cat = [
    '        /\\     /\\',
    "     .-'  `---'  `-.",
    '    /   o       o   \\',
    '   (==      ^      ==)',
    "    \\    `-----'    /",
    "     `-.         .-'",
    '       /  /| |\\  \\',
    '      (_/  |_|  \\_)',
  ]
  putArtBlock(canvas, Math.round(cx - 12), Math.round(cy - h * 0.17), cat, 8, 0.98)
  strokeCurve(canvas, (t) => [
    cx + w * 0.15 + Math.sin(t * Math.PI * 1.35) * w * 0.18,
    cy + h * 0.1 - Math.sin(t * Math.PI) * h * 0.2 + t * h * 0.08,
  ], { steps: 44, value: 0.72, priority: 5 })
  outlineEllipse(canvas, w * 0.78, h * 0.22, w * 0.09, h * 0.1, { value: 0.58, priority: 3 })
  eraseEllipse(canvas, w * 0.81, h * 0.2, w * 0.075, h * 0.09)
  for (let i = 0; i < 12; i += 1) putGlyph(canvas, random() * w, h * (0.72 + random() * 0.12), random() > 0.5 ? '`' : "'", 1, 0.22)
  putTone(canvas, cx, h * 0.76, 0.24, 'max')
}

function drawRobot(canvas, { random }) {
  const { width: w, height: h } = canvas
  const cx = w * 0.5
  const cy = h * 0.52
  rectFill(canvas, cx - w * 0.17, cy - h * 0.23, w * 0.34, h * 0.28, 0.58)
  rectOutline(canvas, cx - w * 0.17, cy - h * 0.23, w * 0.34, h * 0.28, { priority: 7, value: 0.95 })
  rectFill(canvas, cx - w * 0.23, cy + h * 0.08, w * 0.46, h * 0.27, 0.48)
  rectOutline(canvas, cx - w * 0.23, cy + h * 0.08, w * 0.46, h * 0.27, { priority: 6, value: 0.84 })
  strokeLine(canvas, cx, cy - h * 0.23, cx, cy - h * 0.38, { char: '|', priority: 6, value: 0.82 })
  putGlyph(canvas, cx, cy - h * 0.41, '*', 8, 1)
  putText(canvas, cx - 5, cy - h * 0.07, '[o_o]', 8, 1)
  putText(canvas, cx - 4, cy + h * 0.01, '<___>', 7, 0.9)
  for (let i = 0; i < 7; i += 1) {
    const x = cx - w * 0.17 + (i + 1) * (w * 0.34 / 8)
    strokeLine(canvas, x, cy + h * 0.1, x + (random() - 0.5) * 6, cy + h * (0.21 + random() * 0.08), { value: 0.62, priority: 3 })
    putGlyph(canvas, x, cy + h * (0.23 + random() * 0.07), random() > 0.5 ? 'o' : '*', 4, 0.88)
  }
  strokeLine(canvas, cx - w * 0.23, cy + h * 0.16, cx - w * 0.34, cy + h * 0.02, { priority: 4, value: 0.58 })
  strokeLine(canvas, cx + w * 0.23, cy + h * 0.16, cx + w * 0.34, cy + h * 0.02, { priority: 4, value: 0.58 })
}

function drawMountain(canvas, { random }) {
  const { width: w, height: h } = canvas
  const ridges = [
    [[0, h * 0.78], [w * 0.22, h * 0.42], [w * 0.39, h * 0.77]],
    [[w * 0.22, h * 0.81], [w * 0.55, h * 0.25], [w, h * 0.82]],
    [[w * 0.04, h * 0.86], [w * 0.76, h * 0.48], [w, h * 0.88]],
  ]
  for (const ridge of ridges) strokePolyline(canvas, ridge, { value: 0.96, priority: 6, thickness: 1 })
  for (let y = Math.floor(h * 0.62); y < h; y += 1) {
    const shade = 0.2 + (y / h) * 0.34
    strokeLine(canvas, 0, y, w, y + Math.sin(y * 0.5) * 1.6, { char: y % 3 === 0 ? '_' : '.', value: shade, priority: 1 })
  }
  strokePolyline(canvas, [[w * 0.55, h * 0.25], [w * 0.49, h * 0.41], [w * 0.58, h * 0.36], [w * 0.63, h * 0.49]], { char: random() > 0.5 ? '/' : '\\', value: 0.7, priority: 4 })
  rectFill(canvas, w * 0.68, h * 0.68, w * 0.11, h * 0.09, 0.42)
  rectOutline(canvas, w * 0.68, h * 0.68, w * 0.11, h * 0.09, { priority: 5, value: 0.78 })
  strokePolyline(canvas, [[w * 0.665, h * 0.68], [w * 0.735, h * 0.6], [w * 0.805, h * 0.68]], { value: 0.86, priority: 6 })
  for (let i = 0; i < 16; i += 1) {
    const x = random() * w
    const y = h * (0.75 + random() * 0.17)
    putGlyph(canvas, x, y, random() > 0.5 ? '^' : 'A', 2, 0.46)
  }
}

function drawCity(canvas, { random }) {
  const { width: w, height: h } = canvas
  const ground = Math.floor(h * 0.78)
  strokeLine(canvas, 0, ground, w, ground - 1, { char: '_', priority: 4, value: 0.62 })
  for (let x = 1; x < w - 3;) {
    const bw = Math.floor(3 + random() * 6)
    const bh = Math.floor(h * (0.22 + random() * 0.42))
    const y = ground - bh
    rectFill(canvas, x, y, bw, bh, 0.35 + random() * 0.26)
    rectOutline(canvas, x, y, bw, bh, { priority: 4, value: 0.74 })
    if (random() > 0.66) strokeLine(canvas, x, y, x + bw / 2, y - h * (0.05 + random() * 0.06), { priority: 3, value: 0.7 })
    for (let yy = y + 2; yy < ground - 1; yy += 3) {
      for (let xx = x + 1; xx < x + bw - 1; xx += 2) {
        if (random() > 0.48) putGlyph(canvas, xx, yy, random() > 0.85 ? '*' : '.', 5, 0.98)
      }
    }
    x += bw + Math.floor(1 + random() * 3)
  }
  strokeLine(canvas, w * 0.48, ground, w * 0.1, h, { char: '/', priority: 3, value: 0.52 })
  strokeLine(canvas, w * 0.56, ground, w * 0.9, h, { char: '\\', priority: 3, value: 0.52 })
  for (let y = ground + 2; y < h; y += 3) {
    strokeLine(canvas, w * 0.2, y, w * 0.82, y + random() * 1.5, { char: y % 2 ? '-' : '~', priority: 2, value: 0.38 })
  }
  putText(canvas, w * 0.08, h * 0.19, 'NEON', 5, 0.9)
}

function drawOcean(canvas, { random }) {
  const { width: w, height: h } = canvas
  outlineEllipse(canvas, w * 0.78, h * 0.22, w * 0.07, h * 0.08, { value: 0.74, priority: 3 })
  for (let band = 0; band < 7; band += 1) {
    const base = h * (0.4 + band * 0.075)
    strokeCurve(canvas, (t) => [
      t * w,
      base + Math.sin(t * Math.PI * (3 + band % 2) + band) * h * 0.035,
    ], { steps: w, char: band % 2 ? '~' : '_', value: 0.5 + band * 0.04, priority: 3 })
  }
  strokePolyline(canvas, [[w * 0.42, h * 0.52], [w * 0.56, h * 0.52], [w * 0.5, h * 0.6]], { value: 0.78, priority: 5 })
  strokeLine(canvas, w * 0.5, h * 0.51, w * 0.5, h * 0.36, { char: '|', value: 0.74, priority: 5 })
  strokePolyline(canvas, [[w * 0.51, h * 0.38], [w * 0.63, h * 0.5], [w * 0.51, h * 0.5]], { value: 0.68, priority: 4 })
  for (let i = 0; i < 24; i += 1) putGlyph(canvas, random() * w, h * (0.54 + random() * 0.4), random() > 0.5 ? '`' : "'", 2, 0.38)
}

function drawFlower(canvas, { random }) {
  const { width: w, height: h } = canvas
  const cx = w * 0.5
  const cy = h * 0.38
  strokeCurve(canvas, (t) => [
    cx + Math.sin(t * Math.PI * 1.2) * w * 0.04,
    cy + t * h * 0.45,
  ], { steps: 48, value: 0.62, priority: 4, thickness: 1 })
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10
    const px = cx + Math.cos(angle) * w * 0.105
    const py = cy + Math.sin(angle) * h * 0.12
    fillEllipse(canvas, px, py, w * 0.065, h * 0.055, 0.58)
    outlineEllipse(canvas, px, py, w * 0.065, h * 0.055, { value: 0.86, priority: 5 })
  }
  fillEllipse(canvas, cx, cy, w * 0.05, h * 0.055, 0.88)
  outlineEllipse(canvas, cx, cy, w * 0.05, h * 0.055, { value: 0.96, priority: 6 })
  outlineEllipse(canvas, cx - w * 0.11, h * 0.74, w * 0.12, h * 0.05, { value: 0.62, priority: 4 })
  outlineEllipse(canvas, cx + w * 0.1, h * 0.66, w * 0.1, h * 0.045, { value: 0.62, priority: 4 })
  for (let i = 0; i < 18; i += 1) putGlyph(canvas, random() * w, h * (0.78 + random() * 0.16), random() > 0.5 ? ',' : '`', 2, 0.34)
}

function drawSpace(canvas, { random }) {
  const { width: w, height: h } = canvas
  const cx = w * 0.47
  const cy = h * 0.5
  fillEllipse(canvas, cx, cy, w * 0.18, h * 0.14, 0.46)
  outlineEllipse(canvas, cx, cy, w * 0.18, h * 0.14, { value: 0.88, priority: 5 })
  strokeCurve(canvas, (t) => [
    cx + (t - 0.5) * w * 0.55,
    cy + Math.sin((t - 0.5) * Math.PI) * h * 0.12,
  ], { steps: 84, value: 0.7, priority: 5 })
  strokeLine(canvas, w * 0.12, h * 0.18, w * 0.31, h * 0.1, { priority: 3, value: 0.45 })
  putGlyph(canvas, w * 0.32, h * 0.095, '>', 4, 0.62)
  for (let i = 0; i < 30; i += 1) {
    const x = random() * w
    const y = random() * h
    putGlyph(canvas, x, y, random() > 0.82 ? '*' : random() > 0.55 ? '+' : '.', 3, 0.72 + random() * 0.22)
  }
}

function drawDragon(canvas, { random }) {
  const { width: w, height: h } = canvas
  const body = (t) => [
    w * (0.12 + t * 0.68),
    h * (0.52 + Math.sin(t * Math.PI * 2.8) * 0.18 - Math.sin(t * Math.PI) * 0.08),
  ]
  strokeCurve(canvas, body, { steps: 118, value: 0.66, priority: 5, thickness: 2 })
  strokeCurve(canvas, body, { steps: 118, value: 0.94, priority: 7, thickness: 1 })
  for (let i = 5; i < 92; i += 7) {
    const t = i / 118
    const [x, y] = body(t)
    putGlyph(canvas, x, y - h * 0.055, '^', 7, 0.95)
  }
  const headX = w * 0.82
  const headY = h * 0.39
  strokePolyline(canvas, [[w * 0.73, h * 0.41], [headX, headY], [w * 0.92, h * 0.35], [w * 0.84, h * 0.46], [w * 0.74, h * 0.45]], { value: 0.96, priority: 8 })
  putArtBlock(canvas, Math.round(w * 0.72), Math.round(h * 0.29), [
    '    /\\_/\\',
    ' __/ o o \\__',
    '<_   \\^/   _>',
    "  `-./_\\.-'",
  ], 9, 1)
  putGlyph(canvas, headX + w * 0.035, headY - h * 0.01, '*', 9, 1)
  strokeLine(canvas, headX, headY - h * 0.02, headX - w * 0.03, headY - h * 0.18, { char: '/', value: 0.86, priority: 7 })
  strokeLine(canvas, headX + w * 0.04, headY - h * 0.01, headX + w * 0.065, headY - h * 0.17, { char: '\\', value: 0.86, priority: 7 })
  strokePolyline(canvas, [[w * 0.47, h * 0.48], [w * 0.37, h * 0.23], [w * 0.6, h * 0.39], [w * 0.48, h * 0.49]], { value: 0.62, priority: 4 })
  strokePolyline(canvas, [[w * 0.54, h * 0.58], [w * 0.39, h * 0.75], [w * 0.62, h * 0.69], [w * 0.55, h * 0.58]], { value: 0.5, priority: 3 })
  for (let i = 0; i < 20; i += 1) putGlyph(canvas, w * (0.86 + random() * 0.1), h * (0.24 + random() * 0.22), random() > 0.55 ? '*' : '.', 2, 0.58)
}

function drawHeart(canvas) {
  const { width: w, height: h } = canvas
  const cx = w * 0.5
  const cy = h * 0.47
  const scaleX = w * 0.017
  const scaleY = h * 0.025
  let previous = null
  for (let i = 0; i <= 160; i += 1) {
    const t = (Math.PI * 2 * i) / 160
    const x = cx + 16 * Math.sin(t) ** 3 * scaleX
    const y = cy - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * scaleY
    if (previous) strokeLine(canvas, previous[0], previous[1], x, y, { value: 0.96, priority: 7 })
    previous = [x, y]
  }
  fillEllipse(canvas, cx - w * 0.07, cy - h * 0.08, w * 0.08, h * 0.08, 0.44)
  fillEllipse(canvas, cx + w * 0.07, cy - h * 0.08, w * 0.08, h * 0.08, 0.44)
  strokeLine(canvas, cx, cy + h * 0.25, cx, cy + h * 0.36, { char: '|', value: 0.48, priority: 3 })
}

function drawBird(canvas) {
  const { width: w, height: h } = canvas
  const cx = w * 0.5
  const cy = h * 0.47
  strokeCurve(canvas, (t) => [cx - w * 0.04 - t * w * 0.33, cy - Math.sin(t * Math.PI) * h * 0.18], { steps: 58, value: 0.92, priority: 6 })
  strokeCurve(canvas, (t) => [cx + w * 0.04 + t * w * 0.33, cy - Math.sin(t * Math.PI) * h * 0.18], { steps: 58, value: 0.92, priority: 6 })
  fillEllipse(canvas, cx, cy + h * 0.02, w * 0.09, h * 0.11, 0.5)
  outlineEllipse(canvas, cx, cy + h * 0.02, w * 0.09, h * 0.11, { value: 0.85, priority: 5 })
  putGlyph(canvas, cx + w * 0.045, cy - h * 0.04, '>', 7, 0.9)
  putGlyph(canvas, cx + w * 0.02, cy - h * 0.065, 'o', 7, 0.95)
  strokeLine(canvas, cx - w * 0.03, cy + h * 0.12, cx - w * 0.08, cy + h * 0.2, { value: 0.55, priority: 3 })
  strokeLine(canvas, cx + w * 0.03, cy + h * 0.12, cx + w * 0.08, cy + h * 0.2, { value: 0.55, priority: 3 })
}

function drawTree(canvas, { random }) {
  const { width: w, height: h } = canvas
  const cx = w * 0.5
  rectFill(canvas, cx - w * 0.035, h * 0.47, w * 0.07, h * 0.34, 0.45)
  rectOutline(canvas, cx - w * 0.035, h * 0.47, w * 0.07, h * 0.34, { priority: 4, value: 0.64 })
  for (let i = 0; i < 24; i += 1) {
    const angle = random() * Math.PI * 2
    const radius = random() ** 0.65
    const x = cx + Math.cos(angle) * radius * w * 0.24
    const y = h * 0.35 + Math.sin(angle) * radius * h * 0.2
    fillEllipse(canvas, x, y, w * (0.035 + random() * 0.03), h * (0.025 + random() * 0.025), 0.44 + random() * 0.2)
    putGlyph(canvas, x, y, random() > 0.5 ? '&' : '*', 3, 0.68)
  }
  for (let i = 0; i < 18; i += 1) strokeLine(canvas, random() * w, h * (0.82 + random() * 0.12), random() * w, h * (0.82 + random() * 0.12), { char: '_', value: 0.28, priority: 1 })
}

function drawAbstract(canvas, { random }) {
  const { width: w, height: h } = canvas
  const cx = w * 0.5
  const cy = h * 0.5
  for (let i = 0; i < 5; i += 1) {
    outlineEllipse(canvas, cx, cy, w * (0.08 + i * 0.045), h * (0.06 + i * 0.038), { value: 0.36 + i * 0.1, priority: 3 + i })
  }
  strokePolyline(canvas, [[cx, cy - h * 0.28], [cx + w * 0.2, cy], [cx, cy + h * 0.28], [cx - w * 0.2, cy], [cx, cy - h * 0.28]], { value: 0.88, priority: 6 })
  putGlyph(canvas, cx, cy, '@', 8, 1)
  for (let i = 0; i < 28; i += 1) {
    const x = cx + (random() - 0.5) * w * 0.62
    const y = cy + (random() - 0.5) * h * 0.58
    putGlyph(canvas, x, y, ['.', "'", '`', '+', '*'][Math.floor(random() * 5)], 2, 0.45 + random() * 0.4)
  }
}

function drawPromptEffects(canvas, { prompt, random }) {
  const { width: w, height: h } = canvas
  if (/rain|雨|霧雨|storm/i.test(prompt)) {
    for (let i = 0; i < w * 0.72; i += 1) {
      const x = random() * w
      const y = random() * h * 0.82
      putRainDrop(canvas, x, y, 3 + Math.floor(random() * 2), 0.34 + random() * 0.18)
    }
  }
  if (/snow|雪/i.test(prompt)) {
    for (let i = 0; i < w * 0.65; i += 1) putGlyph(canvas, random() * w, random() * h, random() > 0.8 ? '*' : '.', 2, 0.52)
  }
  if (/neon|ネオン|cyber|サイバー|glow/i.test(prompt)) {
    strokeLine(canvas, 0, h * 0.2, w, h * 0.18, { char: '-', value: 0.62, priority: 2 })
    strokeLine(canvas, 0, h * 0.82, w, h * 0.78, { char: '_', value: 0.58, priority: 2 })
    for (let i = 0; i < 4; i += 1) putText(canvas, random() * w * 0.75, h * (0.18 + random() * 0.55), random() > 0.5 ? '###' : '///', 1.8, 0.44)
  }
  if (/fire|炎|火|flame/i.test(prompt)) {
    for (let i = 0; i < 24; i += 1) {
      strokeCurve(canvas, (t) => [w * (0.2 + random() * 0.6) + Math.sin(t * 8) * 2, h * (0.88 - t * 0.2)], { steps: 20, char: random() > 0.5 ? '/' : '\\', value: 0.58, priority: 2 })
    }
  }
  if (/wind|風|流れ|疾走/i.test(prompt)) {
    for (let i = 0; i < 8; i += 1) {
      const y = h * (0.18 + random() * 0.62)
      strokeCurve(canvas, (t) => [t * w, y + Math.sin(t * Math.PI * 3 + random()) * h * 0.02], { steps: 60, char: '~', value: 0.28, priority: 1 })
    }
  }
}

function polishCanvas(canvas, { options, random }) {
  const { width: w, height: h } = canvas
  const craft = options.craft / 100
  if (craft <= 0.05) return

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      if (canvas.glyph[y][x]) continue
      const neighbors = canvas.tone[y - 1][x] + canvas.tone[y + 1][x] + canvas.tone[y][x - 1] + canvas.tone[y][x + 1]
      if (canvas.tone[y][x] < 0.16 && neighbors < 0.36) canvas.tone[y][x] *= 0.25
      if (canvas.tone[y][x] > 0.58 && random() < craft * 0.015) putGlyph(canvas, x, y, random() > 0.5 ? '.' : "'", 1, canvas.tone[y][x])
    }
  }

  if (options.craft >= 70) {
    const label = 'aa'
    putText(canvas, w - label.length - 2, h - 2, label, 1, 0.32)
  }
}

function renderCanvas(canvas, { options, random }) {
  const style = STYLES[options.style]
  const contrast = options.contrast / 94
  const density = options.density / 100
  const craft = options.craft / 100
  const glyphThreshold = 1.2 + (1 - craft) * 3.2 - style.edgeBias * 0.35

  return canvas.tone.map((row, y) => row.map((raw, x) => {
    const glyph = canvas.glyph[y][x]
    if (glyph && canvas.priority[y][x] >= glyphThreshold && random() < 0.94 + craft * 0.06) return styleGlyph(glyph, options.style)
    let value = clamp(((raw - 0.5) * contrast + 0.5) * density + (random() - 0.5) * style.grain, 0, 1)
    if (options.invert) value = 1 - value
    return toneChar(value, style, random)
  }).join('').trimEnd()).join('\n')
}

function craftNotesFor(motif, options) {
  const motifNote = {
    cat: 'ears, eyes, whiskers, tail silhouette',
    robot: 'box outline, faceplate, circuit marks',
    mountain: 'layered ridges, snow cut, tiny cabin',
    city: 'skyline, lit windows, street perspective',
    ocean: 'wave bands, sail, moon reflection',
    flower: 'petal rings, stem gesture, leaf balance',
    space: 'planet ring, star field, comet line',
    dragon: 'serpentine spine, horns, wings, sparks',
    heart: 'parametric outline, soft inner shade',
    bird: 'wing arcs, body focus, beak accent',
    tree: 'trunk mass, leaf clusters, ground texture',
    abstract: 'orbital symmetry, negative-space center',
    image: 'edge-aware conversion',
  }[motif] || 'motif-specific structure'
  return [
    'structure lines before tone fill',
    motifNote,
    options.craft >= 70 ? 'polish pass: isolated noise cleaned' : 'light polish pass',
  ]
}

function putTone(canvas, x, y, value, mode = 'max') {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (!inside(canvas, xi, yi)) return
  if (mode === 'add') canvas.tone[yi][xi] = clamp(canvas.tone[yi][xi] + value, 0, 1)
  else if (mode === 'set') canvas.tone[yi][xi] = clamp(value, 0, 1)
  else canvas.tone[yi][xi] = clamp(Math.max(canvas.tone[yi][xi], value), 0, 1)
}

function putGlyph(canvas, x, y, glyph, priority = 3, tone = 0.75) {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (!inside(canvas, xi, yi)) return
  if (priority >= canvas.priority[yi][xi]) {
    canvas.glyph[yi][xi] = glyph
    canvas.priority[yi][xi] = priority
  }
  putTone(canvas, xi, yi, tone, 'max')
}

function putText(canvas, x, y, text, priority = 5, tone = 0.8) {
  const start = Math.round(x)
  const yy = Math.round(y)
  for (let i = 0; i < text.length; i += 1) putGlyph(canvas, start + i, yy, text[i], priority, tone)
}

function putArtBlock(canvas, x, y, lines, priority = 6, tone = 0.9) {
  for (let yy = 0; yy < lines.length; yy += 1) {
    for (let xx = 0; xx < lines[yy].length; xx += 1) {
      const glyph = lines[yy][xx]
      if (glyph !== ' ') putGlyph(canvas, x + xx, y + yy, glyph, priority, tone)
    }
  }
}

function putRainDrop(canvas, x, y, length, value) {
  for (let i = 0; i < length; i += 1) {
    const xi = Math.round(x - i * 0.36)
    const yi = Math.round(y + i)
    if (!inside(canvas, xi, yi)) continue
    if (canvas.priority[yi][xi] > 1 || canvas.tone[yi][xi] > 0.29) continue
    putGlyph(canvas, xi, yi, '/', 2, value)
  }
}

function strokeLine(canvas, x1, y1, x2, y2, options = {}) {
  const dx = x2 - x1
  const dy = y2 - y1
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1) * 1.8
  const glyph = options.char || lineGlyphForVector(dx, dy, () => 0.5)
  const thickness = options.thickness || 0
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const x = x1 + dx * t
    const y = y1 + dy * t
    stamp(canvas, x, y, glyph, options, thickness)
  }
}

function strokePolyline(canvas, points, options = {}) {
  for (let i = 0; i < points.length - 1; i += 1) {
    strokeLine(canvas, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], options)
  }
}

function strokeCurve(canvas, pointAt, options = {}) {
  const steps = options.steps || 80
  let previous = pointAt(0)
  for (let i = 1; i <= steps; i += 1) {
    const point = pointAt(i / steps)
    const glyph = options.char || lineGlyphForVector(point[0] - previous[0], point[1] - previous[1], () => 0.5)
    strokeLine(canvas, previous[0], previous[1], point[0], point[1], { ...options, char: glyph })
    previous = point
  }
}

function stamp(canvas, x, y, glyph, options, thickness) {
  const radius = Math.max(0, thickness)
  for (let yy = -radius; yy <= radius; yy += 1) {
    for (let xx = -radius; xx <= radius; xx += 1) {
      if (Math.hypot(xx, yy) <= radius + 0.15) {
        putGlyph(canvas, x + xx, y + yy, glyph, options.priority || 4, options.value || 0.82)
      }
    }
  }
}

function fillEllipse(canvas, cx, cy, rx, ry, value) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const distance = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (distance <= 1) putTone(canvas, x, y, value * (1 - distance * 0.22), 'max')
    }
  }
}

function eraseEllipse(canvas, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const distance = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (distance <= 1 && inside(canvas, x, y)) {
        canvas.tone[y][x] = Math.min(canvas.tone[y][x], 0.08)
        canvas.glyph[y][x] = ''
        canvas.priority[y][x] = 0
      }
    }
  }
}

function outlineEllipse(canvas, cx, cy, rx, ry, options = {}) {
  const steps = Math.max(48, Math.round((rx + ry) * 4))
  let previous = null
  for (let i = 0; i <= steps; i += 1) {
    const angle = (Math.PI * 2 * i) / steps
    const x = cx + Math.cos(angle) * rx
    const y = cy + Math.sin(angle) * ry
    if (previous) {
      const char = ellipseGlyph(angle)
      strokeLine(canvas, previous[0], previous[1], x, y, { ...options, char })
    }
    previous = [x, y]
  }
}

function rectFill(canvas, x, y, width, height, value) {
  for (let yy = Math.floor(y); yy < y + height; yy += 1) {
    for (let xx = Math.floor(x); xx < x + width; xx += 1) putTone(canvas, xx, yy, value, 'max')
  }
}

function rectOutline(canvas, x, y, width, height, options = {}) {
  const x1 = Math.round(x)
  const y1 = Math.round(y)
  const x2 = Math.round(x + width)
  const y2 = Math.round(y + height)
  strokeLine(canvas, x1, y1, x2, y1, { ...options, char: '-' })
  strokeLine(canvas, x1, y2, x2, y2, { ...options, char: '_' })
  strokeLine(canvas, x1, y1, x1, y2, { ...options, char: '|' })
  strokeLine(canvas, x2, y1, x2, y2, { ...options, char: '|' })
  putGlyph(canvas, x1, y1, '+', (options.priority || 4) + 1, options.value || 0.82)
  putGlyph(canvas, x2, y1, '+', (options.priority || 4) + 1, options.value || 0.82)
  putGlyph(canvas, x1, y2, '+', (options.priority || 4) + 1, options.value || 0.82)
  putGlyph(canvas, x2, y2, '+', (options.priority || 4) + 1, options.value || 0.82)
}

function textureHatches(canvas, cx, cy, rx, ry, random, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2
    const radius = Math.sqrt(random())
    const x = cx + Math.cos(angle) * rx * radius
    const y = cy + Math.sin(angle) * ry * radius
    putGlyph(canvas, x, y, random() > 0.5 ? ',' : "'", 2, 0.42)
  }
}

function lineGlyphForVector(dx, dy, random) {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax < 0.001 && ay < 0.001) return '.'
  if (ax > ay * 2.2) return EDGE_GLYPHS.horizontal[Math.floor(random() * EDGE_GLYPHS.horizontal.length)]
  if (ay > ax * 2.2) return EDGE_GLYPHS.vertical[Math.floor(random() * EDGE_GLYPHS.vertical.length)]
  return dx * dy > 0 ? '\\' : '/'
}

function ellipseGlyph(angle) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  if (Math.abs(s) < 0.28) return Math.abs(c) > 0.7 ? (c > 0 ? ')' : '(') : '-'
  if (Math.abs(c) < 0.22) return s > 0 ? '_' : "'"
  return c * s > 0 ? '\\' : '/'
}

function styleGlyph(glyph, style) {
  if (style === 'cyber') {
    if (glyph === 'o') return '0'
    if (glyph === '*') return '+'
    if (glyph === '.') return randomCyberDot(glyph)
  }
  if (style === 'blocks' && ['.', "'", '`', ','].includes(glyph)) return ' '
  return glyph
}

function randomCyberDot(fallback) {
  return fallback
}

function toneChar(value, style, random) {
  const quietThreshold = style.label === 'Block Poster' ? 0.1 : 0.155
  if (value < quietThreshold) return ' '
  const adjusted = clamp(value + (random() - 0.5) * style.grain, 0, 1)
  return style.chars[Math.round(adjusted * (style.chars.length - 1))]
}

function inside(canvas, x, y) {
  return y >= 0 && y < canvas.height && x >= 0 && x < canvas.width
}

function mulberry32(seed) {
  return function next() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
