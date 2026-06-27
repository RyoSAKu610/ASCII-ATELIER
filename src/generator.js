export const defaultOptions = {
  width: 72,
  height: 32,
  density: 70,
  contrast: 82,
  style: 'classic',
  invert: false,
  seedShift: 0,
}

export const STYLES = {
  classic: {
    label: 'Classic',
    preview: ' .:-=+*#%@',
    chars: ' .,:;irsXA253hMHGS#9B&@',
    grain: 0.06,
  },
  soft: {
    label: 'Soft Shade',
    preview: ' ·░▒▓█',
    chars: '  ·˙¨^~░░▒▒▓▓██',
    grain: 0.035,
  },
  noir: {
    label: 'Noir Ink',
    preview: ' ░▒▓█@$',
    chars: '  ..,,--==++**##%%@@',
    grain: 0.08,
  },
  cyber: {
    label: 'Cyber Glyph',
    preview: '01<>[]{}',
    chars: ' .`-:i!lI?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
    grain: 0.1,
  },
  blocks: {
    label: 'Block Poster',
    preview: ' ▁▂▃▄▅▆▇█',
    chars: ' ▁▂▃▄▅▆▇█',
    grain: 0.025,
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
  image: '画像変換',
  abstract: '未知の紋章',
}

const motifKeywords = [
  ['dragon', /dragon|竜|龍|ドラゴン/i],
  ['cat', /cat|猫|ねこ|ネコ/i],
  ['robot', /robot|android|mecha|ロボ|機械|端末/i],
  ['mountain', /mountain|山|富士|稜線|小屋/i],
  ['city', /city|tokyo|東京|街|都市|ビル|ネオン|雨/i],
  ['ocean', /ocean|sea|wave|海|波|水|泳/i],
  ['flower', /flower|bloom|花|桜|庭/i],
  ['space', /space|star|moon|cosmos|宇宙|星|月|銀河/i],
  ['heart', /heart|love|ハート|心|愛/i],
]

export function detectMotif(prompt = '') {
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
  const seed = (hashText(`${prompt}|${options.style}|${options.seedShift}`) + options.seedShift) >>> 0
  const random = mulberry32(seed)
  const grid = makeGrid(options.width, options.height)

  drawBackdrop(grid, random, motif)
  drawMotif(grid, motif, random)
  drawAtmosphere(grid, prompt, random)

  return {
    prompt,
    motif,
    seed,
    style: options.style,
    width: options.width,
    height: options.height,
    art: renderGrid(grid, options, random),
  }
}

export async function imageToAscii(file, inputOptions = {}) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('画像ファイルを選んでください。')
  if (file.size > 12 * 1024 * 1024) throw new Error('画像は12MB以下にしてください。')

  const options = normalizeOptions(inputOptions)
  const bitmap = await createImageBitmap(file)
  const width = options.width
  const ratio = bitmap.height / bitmap.width
  const height = clamp(Math.round(width * ratio * 0.46), 12, options.height * 2)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height).data
  const chars = STYLES[options.style].chars
  const lines = []

  for (let y = 0; y < height; y += 1) {
    let line = ''
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const brightness = (pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114) / 255
      const value = clamp(((options.invert ? 1 - brightness : brightness) - 0.5) * (options.contrast / 70) + 0.5, 0, 1)
      line += chars[Math.round(value * (chars.length - 1))]
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
    art: lines.join('\n'),
  }
}

function normalizeOptions(input) {
  const options = { ...defaultOptions, ...input }
  return {
    ...options,
    width: clamp(Math.round(Number(options.width) || defaultOptions.width), 24, 140),
    height: clamp(Math.round(Number(options.height) || defaultOptions.height), 10, 70),
    density: clamp(Number(options.density) || defaultOptions.density, 0, 120),
    contrast: clamp(Number(options.contrast) || defaultOptions.contrast, 10, 160),
    style: STYLES[options.style] ? options.style : defaultOptions.style,
    invert: Boolean(options.invert),
    seedShift: Number(options.seedShift) || 0,
  }
}

function makeGrid(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => 0))
}

function drawBackdrop(grid, random, motif) {
  const height = grid.length
  const width = grid[0].length
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / Math.max(1, width - 1)
      const ny = y / Math.max(1, height - 1)
      const vignette = 1 - Math.hypot(nx - 0.5, ny - 0.48) * 1.35
      const wave = Math.sin((nx * 5.5 + ny * 2.2 + random()) * Math.PI) * 0.08
      grid[y][x] = clamp(0.16 + vignette * 0.24 + wave, 0, 1)
    }
  }

  if (['space', 'city', 'cat'].includes(motif)) {
    for (let i = 0; i < Math.floor(width * height * 0.018); i += 1) {
      put(grid, Math.floor(random() * width), Math.floor(random() * height * 0.68), 0.9 + random() * 0.1)
    }
  }
}

function drawMotif(grid, motif, random) {
  const h = grid.length
  const w = grid[0].length
  const cx = w / 2
  const cy = h / 2

  if (motif === 'cat') {
    ellipse(grid, cx, cy + h * 0.1, w * 0.19, h * 0.22, 0.86)
    ellipse(grid, cx, cy - h * 0.15, w * 0.13, h * 0.13, 0.92)
    line(grid, cx - w * 0.11, cy - h * 0.25, cx - w * 0.18, cy - h * 0.43, 0.95, 2)
    line(grid, cx + w * 0.11, cy - h * 0.25, cx + w * 0.18, cy - h * 0.43, 0.95, 2)
    line(grid, cx + w * 0.16, cy + h * 0.1, cx + w * 0.32, cy - h * 0.05, 0.8, 2)
    ellipse(grid, w * 0.78, h * 0.24, w * 0.11, h * 0.11, 0.72)
    return
  }

  if (motif === 'robot') {
    rect(grid, cx - w * 0.18, cy - h * 0.18, w * 0.36, h * 0.32, 0.86)
    rect(grid, cx - w * 0.24, cy + h * 0.16, w * 0.48, h * 0.26, 0.72)
    line(grid, cx, cy - h * 0.18, cx, cy - h * 0.34, 0.75, 1)
    ellipse(grid, cx, cy - h * 0.38, w * 0.03, h * 0.03, 0.96)
    put(grid, cx - w * 0.08, cy - h * 0.06, 1)
    put(grid, cx + w * 0.08, cy - h * 0.06, 1)
    return
  }

  if (motif === 'mountain') {
    line(grid, 0, h * 0.78, w * 0.27, h * 0.35, 0.9, 2)
    line(grid, w * 0.27, h * 0.35, w * 0.48, h * 0.74, 0.82, 2)
    line(grid, w * 0.35, h * 0.78, w * 0.62, h * 0.25, 0.95, 2)
    line(grid, w * 0.62, h * 0.25, w, h * 0.8, 0.82, 2)
    for (let y = Math.floor(h * 0.75); y < h; y += 2) line(grid, 0, y, w, y + random() * 2 - 1, 0.35, 1)
    return
  }

  if (motif === 'city') {
    for (let x = 2; x < w - 2; x += Math.floor(3 + random() * 5)) {
      const bw = 2 + Math.floor(random() * 5)
      const bh = Math.floor(h * (0.18 + random() * 0.44))
      rect(grid, x, h - bh - 2, bw, bh, 0.62 + random() * 0.22)
      for (let yy = h - bh; yy < h - 3; yy += 3) {
        for (let xx = x + 1; xx < x + bw; xx += 2) if (random() > 0.55) put(grid, xx, yy, 1)
      }
    }
    for (let i = 0; i < 8; i += 1) line(grid, random() * w, 0, random() * w, h, 0.18, 1)
    return
  }

  if (motif === 'ocean') {
    for (let y = h * 0.35; y < h; y += 3) {
      for (let x = 0; x < w; x += 1) {
        const yy = y + Math.sin(x * 0.18 + y * 0.2) * 1.6
        put(grid, x, yy, 0.72 - (y / h) * 0.16)
      }
    }
    ellipse(grid, w * 0.74, h * 0.2, w * 0.09, h * 0.09, 0.88)
    return
  }

  if (motif === 'flower') {
    for (let i = 0; i < 9; i += 1) {
      const angle = (Math.PI * 2 * i) / 9
      ellipse(grid, cx + Math.cos(angle) * w * 0.11, cy + Math.sin(angle) * h * 0.12, w * 0.08, h * 0.05, 0.84)
    }
    ellipse(grid, cx, cy, w * 0.06, h * 0.06, 1)
    line(grid, cx, cy + h * 0.06, cx - w * 0.05, h - 2, 0.66, 2)
    line(grid, cx - w * 0.03, h * 0.72, cx - w * 0.17, h * 0.62, 0.62, 1)
    return
  }

  if (motif === 'space') {
    ellipse(grid, cx, cy, w * 0.21, h * 0.16, 0.66)
    for (let i = 0; i < 14; i += 1) line(grid, cx, cy, random() * w, random() * h, 0.33 + random() * 0.28, 1)
    ellipse(grid, w * 0.72, h * 0.2, w * 0.08, h * 0.08, 0.95)
    return
  }

  if (motif === 'dragon') {
    for (let i = 0; i < 28; i += 1) {
      const t = i / 27
      const x = w * (0.16 + t * 0.68)
      const y = cy + Math.sin(t * Math.PI * 3) * h * 0.17
      ellipse(grid, x, y, w * 0.055, h * 0.045, 0.82)
    }
    line(grid, w * 0.74, cy - h * 0.08, w * 0.91, cy - h * 0.2, 0.9, 2)
    line(grid, w * 0.74, cy - h * 0.08, w * 0.88, cy + h * 0.02, 0.9, 2)
    return
  }

  if (motif === 'heart') {
    ellipse(grid, cx - w * 0.08, cy - h * 0.05, w * 0.11, h * 0.12, 0.88)
    ellipse(grid, cx + w * 0.08, cy - h * 0.05, w * 0.11, h * 0.12, 0.88)
    line(grid, cx - w * 0.19, cy, cx, cy + h * 0.28, 0.9, 2)
    line(grid, cx + w * 0.19, cy, cx, cy + h * 0.28, 0.9, 2)
    return
  }

  for (let i = 0; i < 7; i += 1) {
    ellipse(grid, cx + (random() - 0.5) * w * 0.36, cy + (random() - 0.5) * h * 0.36, w * (0.08 + random() * 0.18), h * (0.05 + random() * 0.14), 0.42 + random() * 0.5)
  }
}

function drawAtmosphere(grid, prompt, random) {
  const h = grid.length
  const w = grid[0].length
  if (/rain|雨/i.test(prompt)) {
    for (let i = 0; i < w * 1.2; i += 1) {
      const x = random() * w
      const y = random() * h
      line(grid, x, y, x - 2, y + 4, 0.58 + random() * 0.28, 1)
    }
  }
  if (/neon|ネオン|cyber|サイバー/i.test(prompt)) {
    line(grid, 0, h * 0.22, w, h * 0.2, 0.58, 1)
    line(grid, 0, h * 0.82, w, h * 0.78, 0.55, 1)
  }
}

function renderGrid(grid, options, random) {
  const chars = STYLES[options.style].chars
  const grain = STYLES[options.style].grain
  const contrast = options.contrast / 82
  const density = options.density / 100
  return grid.map((row) => row.map((raw) => {
    let value = clamp(((raw - 0.5) * contrast + 0.5) * density + (random() - 0.5) * grain, 0, 1)
    if (options.invert) value = 1 - value
    return chars[Math.round(value * (chars.length - 1))]
  }).join('').trimEnd()).join('\n')
}

function put(grid, x, y, value) {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (yi < 0 || yi >= grid.length || xi < 0 || xi >= grid[0].length) return
  grid[yi][xi] = clamp(Math.max(grid[yi][xi], value), 0, 1)
}

function line(grid, x1, y1, x2, y2, value, thickness = 1) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1)
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const x = x1 + (x2 - x1) * t
    const y = y1 + (y2 - y1) * t
    for (let dy = -thickness; dy <= thickness; dy += 1) {
      for (let dx = -thickness; dx <= thickness; dx += 1) {
        if (Math.hypot(dx, dy) <= thickness) put(grid, x + dx, y + dy, value)
      }
    }
  }
}

function rect(grid, x, y, width, height, value) {
  for (let yy = Math.floor(y); yy < y + height; yy += 1) {
    for (let xx = Math.floor(x); xx < x + width; xx += 1) put(grid, xx, yy, value)
  }
}

function ellipse(grid, cx, cy, rx, ry, value) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const distance = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
      if (distance <= 1) put(grid, x, y, value * (1 - distance * 0.18))
    }
  }
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
