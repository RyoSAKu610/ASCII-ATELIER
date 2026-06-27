import {
  APPEARANCE_OPTIONS,
  DEMO_BATTERIES,
  buildGeminiPrompt,
  classifyBattery,
  createIncidentRecord,
  evaluateFlightQuery,
  makeUploadedBattery,
} from './analyzer.js'
import { downloadJson, downloadTextReport } from './export.js'

const STORAGE_KEY = 'pocket-mine-inspections-v2'
const MASCOT_SRC = './src/assets/pocket-mine-mascot.png'
const SCAN_STEPS = [
  'Scanning shape...',
  'Reading label...',
  'Checking swelling...',
  'Estimating Wh...',
  'Looking for damage...',
]
const FLOW_STEPS = ['Scan', 'Detect', 'Analyze', 'Result', 'Evidence']

const state = {
  selectedId: 'pm-005',
  uploaded: null,
  result: null,
  incident: null,
  scanning: false,
  scanStep: -1,
  cameraStream: null,
  flightQuery: {
    wh: '99',
    appearance: 'swollen',
    isSpare: true,
    bag: 'carry-on',
  },
  history: safeParse(STORAGE_KEY, []),
}

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="Pocket Mine">
      <span class="brand-mark"><span></span></span>
      <span><b>Pocket Mine</b><small>AI BATTERY RISK DETECTION</small></span>
    </a>
    <nav class="top-actions" aria-label="Controls">
      <button class="ghost-button" id="demoMoment"><span class="material-symbols-rounded">bolt</span><span>Demo Moment</span></button>
      <button class="ghost-button" id="openCameraTop"><span class="material-symbols-rounded">photo_camera</span><span>Camera</span></button>
      <button class="icon-button" id="resetDemo" title="Reset"><span class="material-symbols-rounded">restart_alt</span></button>
    </nav>
  </header>

  <main>
    <section class="mission-console" aria-labelledby="appTitle">
      <div class="mission-head">
        <div>
          <p class="eyebrow"><span></span> AI Battery Risk Detection for Airports</p>
          <h1 id="appTitle">Pocket Mine</h1>
          <p class="mission-line">Scan the pocket. Find the mine. Save the flight.</p>
        </div>
        <div class="live-status">
          <span class="pulse"></span>
          <b>AI goggles online</b>
          <small>One scan. One score. One safer flight.</small>
        </div>
      </div>

      <div class="flow-strip" id="flowStrip"></div>

      <div class="app-grid">
        <section class="camera-panel" aria-label="Camera scan">
          <div class="panel-heading">
            <div>
              <p class="panel-kicker">SCAN</p>
              <h2>Point camera at a power bank</h2>
            </div>
            <span class="secure-chip"><span class="material-symbols-rounded">radar</span> AI VISION</span>
          </div>

          <div class="camera-view" id="cameraView"></div>

          <div class="scan-console">
            <div class="scan-steps" id="scanSteps"></div>
            <label class="label-console" for="labelInput">
              <span>OCR / Wh label</span>
              <textarea id="labelInput" rows="3" spellcheck="false"></textarea>
            </label>
            <div class="control-row">
              <label class="upload-button" for="photoInput">
                <input id="photoInput" type="file" accept="image/png,image/jpeg,image/webp" />
                <span class="material-symbols-rounded">add_a_photo</span>
                <span>Photo</span>
              </label>
              <button class="ghost-button" id="openCamera"><span class="material-symbols-rounded">photo_camera</span><span>Camera</span></button>
              <button class="primary-button" id="runScan"><span class="material-symbols-rounded">document_scanner</span><span>Start Scan</span></button>
            </div>
          </div>
        </section>

        <section class="analysis-panel" aria-label="Risk result">
          <div class="mascot-panel" id="mascotPanel"></div>
          <div class="result-hero" id="resultHero"></div>
          <div class="factor-grid" id="factorGrid"></div>
          <div class="evidence-panel" id="evidencePanel"></div>
          <div class="result-actions">
            <button class="secondary-button" id="copyReport"><span class="material-symbols-rounded">content_copy</span><span>Briefing</span></button>
            <button class="secondary-button" id="exportJson"><span class="material-symbols-rounded">download</span><span>Evidence JSON</span></button>
          </div>
        </section>
      </div>

      <div class="intelligence-grid">
        <section class="fly-panel" aria-labelledby="flyTitle">
          <div class="panel-heading">
            <div>
              <p class="panel-kicker">CAN IT FLY?</p>
              <h2 id="flyTitle">Instant battery carry decision</h2>
            </div>
            <span class="secure-chip"><span class="material-symbols-rounded">travel</span> SEARCH</span>
          </div>
          <div class="fly-search">
            <label>
              <span>Wh</span>
              <input id="flyWh" type="number" min="0" step="1" inputmode="decimal" />
            </label>
            <label>
              <span>Appearance</span>
              <select id="flyAppearance">
                ${APPEARANCE_OPTIONS.map((option) => `<option value="${option.id}">${option.label}</option>`).join('')}
              </select>
            </label>
            <label class="toggle-field">
              <input id="flySpare" type="checkbox" />
              <span>Spare battery</span>
            </label>
            <div class="bag-toggle" id="bagToggle" aria-label="Bag placement">
              <button type="button" data-bag="carry-on"><span class="material-symbols-rounded">luggage</span>Carry-on</button>
              <button type="button" data-bag="checked"><span class="material-symbols-rounded">business_center</span>Checked</button>
            </div>
          </div>
          <div class="fly-result" id="flyResult"></div>
        </section>

        <section class="atlas-panel" aria-labelledby="atlasTitle">
          <div class="section-title">
            <p class="eyebrow"><span></span> Field learning loop</p>
            <h2 id="atlasTitle">Danger Battery Atlas</h2>
          </div>
          <div class="atlas-stats" id="atlasStats"></div>
          <div class="atlas-grid" id="atlasGrid"></div>
        </section>
      </div>
    </section>

    <section class="sample-strip" aria-labelledby="sampleTitle">
      <div class="section-title">
        <p class="eyebrow"><span></span> Demo pockets</p>
        <h2 id="sampleTitle">Power bank samples</h2>
      </div>
      <div class="sample-grid" id="sampleGrid"></div>
    </section>

    <section class="pitch-section" aria-labelledby="pitchTitle">
      <div class="pitch-copy">
        <p class="eyebrow"><span></span> Pitch line</p>
        <h2 id="pitchTitle">Today, airport staff inspect batteries with their eyes.</h2>
        <p>Pocket Mine gives them AI eyes.</p>
      </div>
      <div class="pitch-grid">
        <article>
          <span>01</span>
          <b>User points camera at power bank</b>
          <p>Power Bank detected. Risk analysis started.</p>
        </article>
        <article>
          <span>02</span>
          <b>AI checks shape, swelling, damage, heat, label</b>
          <p>Damage, Wh limit, and unreadable labels stay visible as evidence.</p>
        </article>
        <article>
          <span>03</span>
          <b>Result becomes one of three decisions</b>
          <p>Clear to Fly. Needs Human Check. Do Not Board.</p>
        </article>
      </div>
    </section>
  </main>

  <dialog id="cameraDialog">
    <div class="dialog-head">
      <h2>Camera Capture</h2>
      <button class="icon-button" id="closeCamera" title="Close"><span class="material-symbols-rounded">close</span></button>
    </div>
    <video id="cameraVideo" autoplay playsinline muted></video>
    <div class="dialog-actions">
      <button class="secondary-button" id="capturePhoto"><span class="material-symbols-rounded">camera</span><span>Capture</span></button>
    </div>
  </dialog>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`

const $ = (selector) => document.querySelector(selector)

function safeParse(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function getActiveBattery() {
  if (state.selectedId === 'uploaded' && state.uploaded) return state.uploaded
  return DEMO_BATTERIES.find((battery) => battery.id === state.selectedId) || DEMO_BATTERIES[0]
}

function render() {
  renderFlow()
  renderCamera()
  renderScanSteps()
  renderResult()
  renderFlightSearch()
  renderAtlas()
  renderSamples()
  $('#labelInput').value = getActiveBattery().labelText
}

function renderFlow() {
  const activeIndex = state.result ? 4 : state.scanning ? Math.min(2, Math.floor((state.scanStep + 1) / 2) + 1) : 0
  $('#flowStrip').innerHTML = FLOW_STEPS.map((step, index) => `
    <span class="${index < activeIndex ? 'done' : ''} ${index === activeIndex ? 'active' : ''}">
      <i>${String(index + 1).padStart(2, '0')}</i>${step}
    </span>
  `).join('')
}

function renderCamera() {
  const battery = getActiveBattery()
  const preview = classifyBattery(battery)
  const result = state.result
  const tone = result ? result.tone : state.scanning ? preview.tone : 'idle'
  const confidence = result || state.scanning ? preview.confidence : 0
  const copy = cameraCopy(result, state.scanning)
  const stepText = state.scanning ? SCAN_STEPS[Math.max(0, state.scanStep)] : result ? 'Risk analysis complete.' : 'Show me the power bank.'

  $('#cameraView').className = [
    'camera-view',
    tone,
    state.scanning ? 'scanning' : '',
    result || state.scanning ? 'detected' : '',
    battery.signals?.includes('swelling') ? 'has-swelling' : '',
    battery.signals?.length ? 'has-markers' : '',
  ].filter(Boolean).join(' ')

  $('#cameraView').innerHTML = `
    <div class="camera-grid" aria-hidden="true"></div>
    <div class="radar-sweep" aria-hidden="true"></div>
    <div class="reticle" aria-hidden="true"></div>
    <div class="target-wrap">
      <div class="target-object ${escapeHtml(battery.shape)}" style="--battery:${escapeHtml(battery.color)}">
        ${renderBatteryObject(battery)}
        ${(result || state.scanning) ? renderSignalMarkers(battery) : ''}
      </div>
      <div class="target-frame">
        <span></span><span></span><span></span><span></span>
        <i class="scan-line"></i>
        <i class="swell-line one"></i>
        <i class="swell-line two"></i>
      </div>
    </div>
    <div class="detection-card">
      <b>${result || state.scanning ? 'POWER BANK FOUND' : 'CAMERA READY'}</b>
      <span>Confidence ${confidence || '--'}%</span>
    </div>
    <div class="scan-copy">
      <b>${copy.title}</b>
      <span>${copy.detail}</span>
    </div>
    <div class="scan-caption">${escapeHtml(stepText)}</div>
  `
}

function renderBatteryObject(battery) {
  if (battery.dataUrl) {
    return `<div class="uploaded-preview"><img src="${battery.dataUrl}" alt="${escapeHtml(battery.name)}" /></div>`
  }

  return `
    <div class="battery-visual ${escapeHtml(battery.shape)}">
      <span class="battery-label"></span>
      <span class="battery-port"></span>
      <span class="battery-light"></span>
    </div>
  `
}

function renderSignalMarkers(battery) {
  const labels = {
    swelling: 'SWELL',
    dent: 'DENT',
    heat: 'HEAT',
    leak: 'LEAK',
    terminal: 'PIN',
    label: 'LABEL',
  }
  return (battery.signals || []).map((signal, index) => `
    <span class="damage-pin pin-${index + 1}" data-signal="${escapeHtml(signal)}">${labels[signal] || 'RISK'}</span>
  `).join('')
}

function cameraCopy(result, scanning) {
  if (scanning) {
    return { title: 'Power Bank detected.', detail: 'Risk analysis started.' }
  }
  if (!result) {
    return { title: 'Show me the power bank.', detail: "I'll find the mine." }
  }
  if (result.decision === 'carry') {
    return { title: 'Power Bank detected.', detail: 'Looks clean. This one can fly.' }
  }
  if (result.decision === 'review') {
    return { title: 'Power Bank detected.', detail: 'Human check needed.' }
  }
  return { title: 'Pocket Mine detected.', detail: 'Not a bomb. Still a problem.' }
}

function renderScanSteps() {
  $('#scanSteps').innerHTML = SCAN_STEPS.map((step, index) => {
    const done = state.result || (state.scanning && index <= state.scanStep)
    const active = state.scanning && index === state.scanStep
    return `
      <span class="${done ? 'done' : ''} ${active ? 'active' : ''}">
        <i>${index + 1}</i>${escapeHtml(step)}
      </span>
    `
  }).join('')
}

function renderResult() {
  const battery = getActiveBattery()
  const result = state.result
  const incident = state.incident

  renderMascot(result)

  if (!result) {
    $('#resultHero').innerHTML = `
      <div class="risk-meter empty" style="--score-angle:0deg">
        <div><span>RISK SCORE</span><b>--</b><em>/ 100</em></div>
      </div>
      <div class="decision-block idle">
        <small>READY</small>
        <strong>Point camera at a power bank</strong>
        <p>Start Scan</p>
      </div>
    `
    $('#factorGrid').innerHTML = ['Damage', 'Swelling', 'Heat', 'Wh Limit', 'Label'].map((label) => `
      <div class="factor neutral"><span>${label}</span><b>Waiting</b></div>
    `).join('')
    $('#evidencePanel').innerHTML = `
      <h3>Evidence</h3>
      <div class="evidence-list">
        <span><i></i>Photo pending</span>
        <span><i></i>AI notes pending</span>
        <span><i></i>Inspection ID pending</span>
      </div>
    `
    return
  }

  const riskBand = result.riskScore >= 70 ? 'HIGH RISK' : result.riskScore >= 42 ? 'MEDIUM RISK' : 'LOW RISK'
  $('#resultHero').innerHTML = `
    <div class="risk-meter ${result.tone}" style="--score-angle:${result.riskScore * 3.6}deg">
      <div><span>RISK SCORE</span><b>${result.riskScore}</b><em>/ 100</em></div>
    </div>
    <div class="decision-block ${result.tone}">
      <small>${riskBand}</small>
      <strong>${escapeHtml(result.decisionLabel)}</strong>
      <p>${escapeHtml(result.action)}</p>
    </div>
  `

  $('#factorGrid').innerHTML = result.factors.map((factor) => `
    <div class="factor ${escapeHtml(factor.severity)}">
      <span>${escapeHtml(factor.label)}</span>
      <b>${escapeHtml(factor.value)}</b>
    </div>
  `).join('')

  $('#evidencePanel').innerHTML = `
    <h3>Evidence</h3>
    <div class="evidence-list">
      <span class="done"><i></i>Photo captured</span>
      <span class="done"><i></i>AI notes saved</span>
      <span class="done"><i></i>Inspection ID generated</span>
    </div>
    <dl>
      <dt>ID</dt><dd>${escapeHtml(incident.code)}</dd>
      <dt>Battery</dt><dd>${escapeHtml(battery.name)}</dd>
      <dt>Wh</dt><dd>${result.label.wh ?? 'Unknown'}</dd>
      <dt>Notes</dt><dd>${escapeHtml(result.reasons.join(' '))}</dd>
    </dl>
  `
}

function renderMascot(result) {
  const speech = mascotSpeech(result)
  $('#mascotPanel').innerHTML = `
    <img src="${MASCOT_SRC}" alt="Pocket Mine Inspector mascot" />
    <div>
      <small>Pocket Mine Inspector</small>
      <p>${escapeHtml(speech)}</p>
    </div>
  `
}

function mascotSpeech(result) {
  if (!result) return "Show me the power bank. I'll find the mine."
  if (!result.label.hasCapacity) return 'I cannot read the Wh label. Human check needed.'
  if (result.damage.items.some((item) => item.id === 'swelling')) return 'Hmm... this battery looks a little spicy.'
  if (result.decision === 'carry') return 'Looks clean. This one can fly.'
  if (result.decision === 'review') return 'Human check needed before this one flies.'
  return 'Nope. This pocket mine stays on the ground.'
}

function renderSamples() {
  const batteries = state.uploaded ? [state.uploaded, ...DEMO_BATTERIES] : DEMO_BATTERIES
  $('#sampleGrid').innerHTML = batteries.map((battery) => {
    const result = classifyBattery(battery)
    return `
      <button class="sample-card ${battery.id === state.selectedId ? 'active' : ''} ${result.tone}" data-battery="${battery.id}" style="--battery:${escapeHtml(battery.color)}">
        <span class="sample-id">${escapeHtml(battery.id.toUpperCase())}</span>
        <div class="sample-image">${renderBatteryObject(battery)}</div>
        <strong>${escapeHtml(battery.name)}</strong>
        <small>${escapeHtml(battery.labelText)}</small>
        <em>${escapeHtml(result.decisionLabel)}</em>
      </button>
    `
  }).join('')
}

function renderFlightSearch() {
  const query = state.flightQuery
  const result = evaluateFlightQuery(query)
  $('#flyWh').value = query.wh
  $('#flyAppearance').value = query.appearance
  $('#flySpare').checked = query.isSpare
  document.querySelectorAll('[data-bag]').forEach((button) => {
    button.classList.toggle('active', button.dataset.bag === query.bag)
  })

  $('#flyResult').innerHTML = `
    <div class="fly-answer ${result.tone}">
      <span>CAN IT FLY?</span>
      <b>${escapeHtml(result.answer)}</b>
      <em>${escapeHtml(result.decisionLabel)}</em>
    </div>
    <div class="fly-rules">
      <div><span>Carry-on</span><b>${result.carryOnAllowed ? 'Allowed' : 'No'}</b></div>
      <div><span>Checked bag</span><b>${result.checkedAllowed ? 'Allowed' : result.isSpare ? 'Not allowed' : 'No'}</b></div>
      <div><span>Appearance</span><b>${escapeHtml(result.appearanceLabel)}</b></div>
      <div><span>Wh</span><b>${result.wh ?? 'Unknown'}</b></div>
    </div>
    <p>${escapeHtml(result.reasons.join(' '))}</p>
  `
}

function renderAtlas() {
  const batteries = state.uploaded ? [state.uploaded, ...DEMO_BATTERIES] : DEMO_BATTERIES
  const entries = batteries
    .map((battery) => ({ battery, result: classifyBattery(battery) }))
    .sort((a, b) => b.result.riskScore - a.result.riskScore)
  const loggedCases = state.history.length
  const riskyCases = entries.filter((entry) => entry.result.decision !== 'carry').length + loggedCases
  const precision = Math.min(96, 78 + riskyCases * 2)
  const lessonLevel = Math.min(9, 1 + Math.floor((riskyCases + loggedCases) / 2))

  $('#atlasStats').innerHTML = `
    <div><span>Field detections</span><b>${loggedCases}</b><small>saved as evidence</small></div>
    <div><span>AI precision</span><b>${precision}%</b><small>demo learning signal</small></div>
    <div><span>Training level</span><b>Lv.${lessonLevel}</b><small>staff education</small></div>
  `

  $('#atlasGrid').innerHTML = entries.map(({ battery, result }) => `
    <button class="atlas-card ${result.tone}" data-battery="${escapeHtml(battery.id)}" style="--battery:${escapeHtml(battery.color)}">
      <div class="atlas-visual">${renderBatteryObject(battery)}</div>
      <div>
        <span>${escapeHtml(result.decisionLabel)}</span>
        <strong>${escapeHtml(atlasPatternName(battery, result))}</strong>
        <p>${escapeHtml(atlasLessonFor(battery, result))}</p>
      </div>
    </button>
  `).join('')
}

function atlasPatternName(battery, result) {
  if (battery.signals?.includes('swelling')) return 'Spicy Battery'
  if (battery.signals?.includes('heat')) return 'Heat Marker'
  if (battery.signals?.includes('label') || !result.label.hasCapacity) return 'Mystery Label'
  if (result.label.wh > 160) return 'Oversize Pack'
  if (result.label.wh > 100) return 'Approval Zone'
  return 'Clean Reference'
}

function atlasLessonFor(battery, result) {
  if (battery.signals?.includes('swelling')) return 'Swelling beats Wh. Stop it before the gate.'
  if (battery.signals?.includes('heat')) return 'Burn marks move the case into manual safety action.'
  if (battery.signals?.includes('label') || !result.label.hasCapacity) return 'Unreadable Wh labels become human-check training examples.'
  if (result.label.wh > 160) return 'Over-limit capacity becomes an instant no-board pattern.'
  if (result.label.wh > 100) return '100-160Wh teaches approval and airline policy checks.'
  return 'Clean cases improve the visual baseline for fast clearance.'
}

async function runScan(forceBatteryId) {
  if (forceBatteryId) state.selectedId = forceBatteryId
  const battery = getActiveBattery()
  state.scanning = true
  state.scanStep = -1
  state.result = null
  state.incident = null
  $('#runScan').disabled = true

  for (let index = 0; index < SCAN_STEPS.length; index += 1) {
    state.scanStep = index
    renderFlow()
    renderCamera()
    renderScanSteps()
    await wait(360)
  }

  const result = await analyzeWithOptionalGoogleEndpoint(battery)
  const incident = createIncidentRecord(battery, result)
  state.result = result
  state.incident = incident
  state.history = [incident, ...state.history].slice(0, 20)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history))

  state.scanning = false
  state.scanStep = -1
  $('#runScan').disabled = false
  render()
  toast(result.decision === 'isolate' ? 'Pocket mine detected. Manual action required.' : 'Scan complete.', result.tone)
}

async function analyzeWithOptionalGoogleEndpoint(battery) {
  const endpoint = window.POCKET_MINE_GOOGLE_ENDPOINT
  if (!endpoint) return classifyBattery(battery)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        image: battery.dataUrl || null,
        labelText: battery.labelText,
        prompt: buildGeminiPrompt(battery.labelText),
      }),
    })
    if (!response.ok) throw new Error(`Google endpoint ${response.status}`)
    return { ...classifyBattery(battery), ...(await response.json()) }
  } catch (error) {
    console.warn(error)
    toast('Google endpoint failed. Demo rules are active.', 'review')
    return classifyBattery(battery)
  }
}

function selectBattery(id) {
  state.selectedId = id
  state.result = null
  state.incident = null
  render()
}

function updateUploadedFromLabel() {
  if (state.selectedId !== 'uploaded') return
  state.uploaded = makeUploadedBattery({
    labelText: $('#labelInput').value,
    dataUrl: state.uploaded?.dataUrl,
  })
  state.result = null
  state.incident = null
  renderCamera()
  renderResult()
  renderSamples()
}

async function handlePhoto(file) {
  if (!file) return
  if (!file.type.startsWith('image/')) return toast('Choose an image file.', 'danger')
  const dataUrl = await readFileAsDataUrl(file)
  state.uploaded = makeUploadedBattery({
    labelText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    dataUrl,
  })
  selectBattery('uploaded')
  toast('Photo captured.')
}

async function openCamera() {
  const dialog = $('#cameraDialog')
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    $('#cameraVideo').srcObject = state.cameraStream
    dialog.showModal()
  } catch {
    toast('Camera is not available in this environment.', 'danger')
  }
}

function closeCamera() {
  state.cameraStream?.getTracks().forEach((track) => track.stop())
  state.cameraStream = null
  $('#cameraDialog').close()
}

function capturePhoto() {
  const video = $('#cameraVideo')
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 1280
  canvas.height = video.videoHeight || 720
  const ctx = canvas.getContext('2d')
  if (!ctx) return toast('Capture failed.', 'danger')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  state.uploaded = makeUploadedBattery({
    labelText: 'camera capture label unreadable',
    dataUrl: canvas.toDataURL('image/jpeg', 0.86),
  })
  closeCamera()
  selectBattery('uploaded')
  toast('Camera frame captured.')
}

function copyReport() {
  const battery = getActiveBattery()
  const result = state.result || classifyBattery(battery)
  const incident = state.incident || createIncidentRecord(battery, result)
  const factors = result.factors.map((factor) => `${factor.label}: ${factor.value}`).join(', ')
  const report = [
    `Pocket Mine decision: ${result.decisionLabel}`,
    `Target: ${battery.name}`,
    `Risk score: ${result.riskScore}/100`,
    `Capacity: ${result.label.wh ?? 'Unknown'}Wh`,
    `Action: ${result.action}`,
    `Factors: ${factors}`,
    `Inspection ID: ${incident.code}`,
  ].join('\n')
  navigator.clipboard?.writeText(report).then(
    () => toast('Briefing copied.'),
    () => downloadTextReport(report, `pocket-mine-${incident.code}.txt`),
  )
}

function exportJson() {
  const battery = getActiveBattery()
  const result = state.result || classifyBattery(battery)
  const incident = state.incident || createIncidentRecord(battery, result)
  downloadJson({ battery, result, incident }, `pocket-mine-${incident.code}.json`)
  toast('Evidence JSON exported.')
}

function resetDemo() {
  state.selectedId = 'pm-005'
  state.uploaded = null
  state.result = null
  state.incident = null
  state.scanning = false
  state.scanStep = -1
  render()
}

function bindEvents() {
  $('#sampleGrid').addEventListener('click', (event) => {
    const card = event.target.closest('[data-battery]')
    if (card) selectBattery(card.dataset.battery)
  })
  $('#atlasGrid').addEventListener('click', (event) => {
    const card = event.target.closest('[data-battery]')
    if (card) selectBattery(card.dataset.battery)
  })
  $('#flyWh').addEventListener('input', (event) => {
    state.flightQuery.wh = event.target.value
    renderFlightSearch()
  })
  $('#flyAppearance').addEventListener('change', (event) => {
    state.flightQuery.appearance = event.target.value
    renderFlightSearch()
  })
  $('#flySpare').addEventListener('change', (event) => {
    state.flightQuery.isSpare = event.target.checked
    renderFlightSearch()
  })
  $('#bagToggle').addEventListener('click', (event) => {
    const button = event.target.closest('[data-bag]')
    if (!button) return
    state.flightQuery.bag = button.dataset.bag
    renderFlightSearch()
  })
  $('#labelInput').addEventListener('input', () => {
    const battery = getActiveBattery()
    if (state.selectedId === 'uploaded') {
      updateUploadedFromLabel()
    } else {
      state.uploaded = {
        ...battery,
        id: 'uploaded',
        name: `${battery.name} copy`,
        labelText: $('#labelInput').value,
      }
      state.selectedId = 'uploaded'
      state.result = null
      state.incident = null
      renderCamera()
      renderResult()
      renderSamples()
    }
  })
  $('#photoInput').addEventListener('change', (event) => handlePhoto(event.target.files[0]))
  $('#openCamera').addEventListener('click', openCamera)
  $('#openCameraTop').addEventListener('click', openCamera)
  $('#closeCamera').addEventListener('click', closeCamera)
  $('#capturePhoto').addEventListener('click', capturePhoto)
  $('#runScan').addEventListener('click', () => runScan())
  $('#demoMoment').addEventListener('click', () => runScan('pm-005'))
  $('#copyReport').addEventListener('click', copyReport)
  $('#exportJson').addEventListener('click', exportJson)
  $('#resetDemo').addEventListener('click', resetDemo)
  $('#cameraDialog').addEventListener('close', () => {
    state.cameraStream?.getTracks().forEach((track) => track.stop())
    state.cameraStream = null
  })
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toast(message, tone = 'safe') {
  const element = $('#toast')
  element.textContent = message
  element.dataset.tone = tone
  element.classList.add('visible')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => element.classList.remove('visible'), 2600)
}

function escapeHtml(value) {
  const span = document.createElement('span')
  span.textContent = String(value ?? '')
  return span.innerHTML
}

render()
bindEvents()
