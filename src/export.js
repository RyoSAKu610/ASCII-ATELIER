function safeName(name, fallback = 'pocket-mine-report') {
  return String(name || fallback).trim().replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 72) || fallback
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadJson(payload, filename = 'pocket-mine-report.json') {
  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
    safeName(filename, 'pocket-mine-report.json'),
  )
}

export function downloadTextReport(report, filename = 'pocket-mine-report.txt') {
  download(new Blob([report], { type: 'text/plain;charset=utf-8' }), safeName(filename, 'pocket-mine-report.txt'))
}
