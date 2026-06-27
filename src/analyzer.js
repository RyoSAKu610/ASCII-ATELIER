export const RULE_SOURCE_VERSION = 'demo-rules-2026-06'

export const DECISIONS = {
  carry: {
    label: 'CLEAR TO FLY',
    tone: 'safe',
    action: 'No visible risk detected.',
    icon: 'check_circle',
  },
  review: {
    label: 'NEEDS HUMAN CHECK',
    tone: 'review',
    action: 'Possible swelling or unreadable label.',
    icon: 'rule',
  },
  isolate: {
    label: 'DO NOT BOARD',
    tone: 'danger',
    action: 'High-risk battery condition detected.',
    icon: 'local_fire_department',
  },
}

export const DAMAGE_SIGNALS = [
  { id: 'swelling', label: '膨張の可能性', weight: 46 },
  { id: 'dent', label: '外装のへこみ', weight: 24 },
  { id: 'heat', label: '熱変色 / 焦げ跡', weight: 40 },
  { id: 'leak', label: '液漏れ / 異臭', weight: 48 },
  { id: 'terminal', label: '端子露出 / 破損', weight: 34 },
  { id: 'label', label: '容量ラベル不鮮明', weight: 14 },
]

export const GOOGLE_STACK = [
  { name: 'Gemini', detail: '画像全体から形状、損傷、ラベル文脈を推論' },
  { name: 'Cloud Vision OCR', detail: 'mAh / Wh / V 表記と注意文を抽出' },
  { name: 'Vertex AI', detail: '判定モデルとルールエンジンを管理' },
  { name: 'Cloud Run', detail: '空港端末からの推論APIを低遅延で実行' },
  { name: 'Firebase', detail: '認証、監査ログ、オフライン同期' },
  { name: 'BigQuery', detail: '検知傾向とヒヤリハットを分析' },
]

export const DEMO_BATTERIES = [
  {
    id: 'pm-001',
    name: 'PocketSafe 10K',
    labelText: '10000mAh 3.7V 37Wh Li-ion',
    shape: 'slim',
    color: '#2f6fbd',
    location: '保安検査場 A-2',
    signals: [],
    imageHint: 'clear-label',
  },
  {
    id: 'pm-002',
    name: 'TravelCell 20K',
    labelText: '20000 mAh / 3.7 V / 74 Wh',
    shape: 'rounded',
    color: '#3f7b56',
    location: '保安検査場 A-2',
    signals: [],
    imageHint: 'rounded',
  },
  {
    id: 'pm-003',
    name: 'LongTrip 30K',
    labelText: '30000mAh 3.7V 111Wh',
    shape: 'large',
    color: '#6b5bb7',
    location: '保安検査場 B-1',
    signals: [],
    imageHint: 'large-pack',
  },
  {
    id: 'pm-004',
    name: 'NoLabel Bank',
    labelText: 'Li-ion power bank label damaged',
    shape: 'scratched',
    color: '#6f7278',
    location: '保安検査場 B-1',
    signals: ['label'],
    imageHint: 'blurred-label',
  },
  {
    id: 'pm-005',
    name: 'Bulged Pack',
    labelText: '26800mAh 3.7V 99Wh',
    shape: 'swollen',
    color: '#a63e32',
    location: '保安検査場 C-4',
    signals: ['swelling', 'heat'],
    imageHint: 'swollen-red',
  },
  {
    id: 'pm-006',
    name: 'MegaBrick 50K',
    labelText: '50000mAh 3.7V 185Wh',
    shape: 'brick',
    color: '#202a33',
    location: '保安検査場 C-4',
    signals: [],
    imageHint: 'oversize',
  },
]

export const APPEARANCE_OPTIONS = [
  { id: 'clean', label: 'Clean exterior' },
  { id: 'unreadable', label: 'Unreadable label' },
  { id: 'scratched', label: 'Scratched / dented' },
  { id: 'swollen', label: 'Swelling suspected' },
  { id: 'heat', label: 'Heat mark / burn' },
  { id: 'leak', label: 'Leak / smell' },
  { id: 'terminal', label: 'Terminal damage' },
]

export function calculateWattHours({ mah, voltage }) {
  if (!Number.isFinite(mah) || !Number.isFinite(voltage) || mah <= 0 || voltage <= 0) return null
  return Math.round((mah * voltage) / 100) / 10
}

export function parseBatteryLabel(labelText = '') {
  const text = String(labelText).replace(/,/g, '').replace(/\s+/g, ' ').trim()
  const whMatch = text.match(/(\d+(?:\.\d+)?)\s*w(?:att)?\s*h(?:ours?)?/i)
  const mahMatch = text.match(/(\d{3,6}(?:\.\d+)?)\s*m\s*a\s*h/i)
  const voltageMatch = text.match(/(\d+(?:\.\d+)?)\s*v(?:olts?)?/i)
  const wh = whMatch ? Number(whMatch[1]) : null
  const mah = mahMatch ? Number(mahMatch[1]) : null
  const voltage = voltageMatch ? Number(voltageMatch[1]) : null
  const calculatedWh = wh ?? calculateWattHours({ mah, voltage })

  return {
    text,
    wh: calculatedWh,
    explicitWh: wh,
    mah,
    voltage,
    hasCapacity: calculatedWh !== null,
  }
}

export function scoreDamage(signals = []) {
  const unique = [...new Set(signals)]
  const items = DAMAGE_SIGNALS.filter((signal) => unique.includes(signal.id))
  return {
    score: Math.min(100, items.reduce((total, signal) => total + signal.weight, 0)),
    items,
  }
}

export function classifyBattery(input) {
  const label = parseBatteryLabel(input.labelText)
  const damage = scoreDamage(input.signals)
  const reasons = []
  const checks = [
    { label: 'ラベル読取', value: label.hasCapacity ? `${label.wh}Wh` : '未確定', ok: label.hasCapacity },
    { label: '容量しきい値', value: label.hasCapacity ? capacityBand(label.wh) : '係員確認', ok: label.hasCapacity && label.wh <= 100 },
    { label: '形状チェック', value: shapeLabel(input.shape), ok: !['swollen', 'scratched'].includes(input.shape) },
    { label: '損傷サイン', value: damage.items.length ? damage.items.map((item) => item.label).join(' / ') : 'なし', ok: damage.score < 30 },
  ]

  let decision = 'carry'
  if (damage.score >= 40 || input.signals?.includes('swelling') || input.signals?.includes('leak')) {
    decision = 'isolate'
    reasons.push('目視できる損傷サインは容量に関係なく隔離対象です。')
  } else if (!label.hasCapacity) {
    decision = 'review'
    reasons.push('容量表記を読み取れないため、持ち込み可否を自動確定できません。')
  } else if (label.wh > 160) {
    decision = 'isolate'
    reasons.push('160Whを超えるため、旅客の機内持ち込み対象外として扱います。')
  } else if (label.wh > 100) {
    decision = 'review'
    reasons.push('100Wh超から160Wh以下のため、航空会社承認などの確認が必要です。')
  } else {
    reasons.push('100Wh以下で、損傷サインも見つかりません。')
  }

  if (label.mah && label.voltage && !label.explicitWh) {
    reasons.push(`${label.mah.toLocaleString()}mAh × ${label.voltage}V から ${label.wh}Wh と換算しました。`)
  }

  return {
    ...DECISIONS[decision],
    decisionLabel: DECISIONS[decision].label,
    decision,
    confidence: confidenceFor({ decision, label, damage }),
    riskScore: riskScoreFor({ decision, label, damage }),
    label,
    damage,
    factors: riskFactorsFor(input, label, damage),
    checks,
    reasons,
    ruleSourceVersion: RULE_SOURCE_VERSION,
    timestamp: new Date().toISOString(),
  }
}

export function evaluateFlightQuery({ wh, appearance = 'clean', isSpare = true, bag = 'carry-on' }) {
  const capacity = Number.parseFloat(wh)
  const hasWh = Number.isFinite(capacity) && capacity > 0
  const appearanceLabel = APPEARANCE_OPTIONS.find((option) => option.id === appearance)?.label || 'Unknown exterior'
  const reasons = []
  let decision = 'carry'

  if (['swollen', 'heat', 'leak', 'terminal'].includes(appearance)) {
    decision = 'isolate'
    reasons.push(`${appearanceLabel} is a visible high-risk condition.`)
  } else if (!hasWh) {
    decision = 'review'
    reasons.push('Wh is unknown or unreadable, so staff must verify the label.')
  } else if (capacity > 160) {
    decision = 'isolate'
    reasons.push('Battery capacity is over 160Wh.')
  } else if (capacity > 100) {
    decision = 'review'
    reasons.push('Battery is over 100Wh and needs airline approval check.')
  } else if (['unreadable', 'scratched'].includes(appearance)) {
    decision = 'review'
    reasons.push(`${appearanceLabel} reduces visual confidence.`)
  } else {
    reasons.push('Capacity is 100Wh or lower and no visible risk is selected.')
  }

  if (isSpare && bag === 'checked' && decision !== 'isolate') {
    decision = 'review'
    reasons.push('Spare lithium batteries should be moved to carry-on handling.')
  }

  const carryOnAllowed = decision === 'carry' || decision === 'review'
  const checkedAllowed = !isSpare && decision === 'carry'
  const answer = decision === 'carry' ? 'YES' : decision === 'review' ? 'CHECK' : 'NO'

  return {
    ...DECISIONS[decision],
    answer,
    decision,
    decisionLabel: DECISIONS[decision].label,
    tone: DECISIONS[decision].tone,
    wh: hasWh ? capacity : null,
    appearance,
    appearanceLabel,
    isSpare: Boolean(isSpare),
    bag,
    carryOnAllowed,
    checkedAllowed,
    reasons,
  }
}

export function createIncidentRecord(battery, result) {
  const code = `${battery.id}-${Date.now().toString(36).slice(-6)}`.toUpperCase()
  return {
    code,
    location: battery.location || '保安検査場',
    batteryId: battery.id,
    batteryName: battery.name,
    decision: result.decision,
    action: result.action,
    wh: result.label.wh,
    signals: result.damage.items.map((item) => item.id),
    createdAt: result.timestamp,
  }
}

export function buildGeminiPrompt(labelText) {
  return [
    'You are Pocket Mine, an airport lithium battery screening assistant.',
    'Inspect one passenger battery image and return strict JSON.',
    'Fields: label_text, capacity_wh, visible_damage_signs, shape_notes, decision, confidence, reasons.',
    'Decisions must be one of: carry, review, isolate.',
    'Prioritize visible damage over capacity. Never invent unreadable label values.',
    `OCR text candidate: ${labelText || '(none)'}`,
  ].join('\n')
}

function capacityBand(wh) {
  if (wh <= 100) return '100Wh以下'
  if (wh <= 160) return '100Wh超-160Wh以下'
  return '160Wh超'
}

function shapeLabel(shape) {
  const labels = {
    slim: '薄型・正常',
    rounded: '角丸・正常',
    large: '大型',
    scratched: 'ラベル損傷',
    swollen: '膨張疑い',
    brick: '大型ブロック',
    uploaded: 'アップロード画像',
  }
  return labels[shape] || '未分類'
}

function riskScoreFor({ decision, label, damage }) {
  const capacityRisk = label.wh ? Math.max(0, Math.min(42, (label.wh - 80) * 0.7)) : 26
  const base = decision === 'isolate' ? 54 : decision === 'review' ? 32 : 8
  return Math.round(Math.min(100, base + capacityRisk + damage.score * 0.65))
}

function riskFactorsFor(input, label, damage) {
  const signals = new Set(input.signals || [])
  const damaged = damage.items.filter((item) => !['label'].includes(item.id))
  return [
    {
      label: 'Damage',
      value: damaged.length ? 'High' : signals.has('label') || input.shape === 'scratched' ? 'Medium' : 'Low',
      severity: damaged.length ? 'danger' : signals.has('label') || input.shape === 'scratched' ? 'review' : 'safe',
    },
    {
      label: 'Swelling',
      value: signals.has('swelling') || input.shape === 'swollen' ? 'Medium' : 'Low',
      severity: signals.has('swelling') || input.shape === 'swollen' ? 'review' : 'safe',
    },
    {
      label: 'Heat',
      value: signals.has('heat') ? 'High' : 'Low',
      severity: signals.has('heat') ? 'danger' : 'safe',
    },
    {
      label: 'Wh Limit',
      value: !label.hasCapacity ? 'Unknown' : label.wh > 160 ? 'Over limit' : label.wh > 100 ? 'Needs approval' : 'Within limit',
      severity: !label.hasCapacity || label.wh > 100 ? label.wh > 160 ? 'danger' : 'review' : 'safe',
    },
    {
      label: 'Label',
      value: label.hasCapacity && !signals.has('label') ? 'Readable' : 'Unreadable',
      severity: label.hasCapacity && !signals.has('label') ? 'safe' : 'review',
    },
  ]
}

function confidenceFor({ decision, label, damage }) {
  let confidence = 78
  if (label.hasCapacity) confidence += 10
  if (damage.items.length) confidence += 6
  if (decision === 'review') confidence -= 8
  return Math.max(58, Math.min(96, confidence))
}

export function makeUploadedBattery({ labelText, dataUrl }) {
  const lower = `${labelText}`.toLowerCase()
  const signals = []
  if (/膨|swoll|bulg/.test(lower)) signals.push('swelling')
  if (/焦|burn|heat|hot/.test(lower)) signals.push('heat')
  if (/液|leak/.test(lower)) signals.push('leak')
  if (/端子|terminal|broken/.test(lower)) signals.push('terminal')
  if (!parseBatteryLabel(labelText).hasCapacity) signals.push('label')
  return {
    id: 'uploaded',
    name: 'Uploaded Battery',
    labelText,
    shape: 'uploaded',
    color: '#3f72af',
    location: 'デモ端末',
    signals,
    imageHint: 'uploaded',
    dataUrl,
  }
}
