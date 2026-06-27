export function downloadText(filename, text) {
  downloadBlob(safeName(filename), new Blob([text], { type: 'text/plain;charset=utf-8' }))
}

export function makeSvg(text, palette) {
  const lines = text.split('\n')
  const fontSize = 14
  const lineHeight = 17
  const padding = 28
  const width = Math.max(560, Math.max(...lines.map((line) => line.length)) * 8.4 + padding * 2)
  const height = Math.max(220, lines.length * lineHeight + padding * 2)
  const escaped = lines.map((line, index) => (
    `<text x="${padding}" y="${padding + (index + 1) * lineHeight}">${escapeXml(line)}</text>`
  )).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="25%" r="75%">
      <stop offset="0%" stop-color="${escapeXml(palette.glow)}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${escapeXml(palette.bg)}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" rx="24" fill="${escapeXml(palette.bg)}"/>
  <rect width="100%" height="100%" rx="24" fill="url(#glow)"/>
  <text font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="${fontSize}" fill="${escapeXml(palette.ink)}" xml:space="preserve">${escaped}</text>
</svg>`
}

export function downloadSvg(filename, text, palette) {
  downloadBlob(safeName(filename), new Blob([makeSvg(text, palette)], { type: 'image/svg+xml;charset=utf-8' }))
}

export async function downloadPng(filename, text, palette) {
  const svg = makeSvg(text, palette)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.decoding = 'async'
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
    image.src = url
  })
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2))
  const canvas = document.createElement('canvas')
  canvas.width = image.width * scale
  canvas.height = image.height * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.drawImage(image, 0, 0)
  URL.revokeObjectURL(url)
  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  downloadBlob(safeName(filename), pngBlob)
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, '-').slice(0, 90)
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
