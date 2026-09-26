import {
  BIOMES,
  PLACEABLES,
  TILE,
  TILE_INFO,
  biomeForMotif,
  craftItem,
  createPlayer,
  defaultInventory,
  generateWorld,
  hashSeed,
  isSolid,
  mineTile,
  placeTile,
  restoreWorldState,
  serializeWorldState,
  tileAt,
} from './world.js'

const STORAGE_KEY = 'ascii-atelier-world-v1'
const HOLO_KEY = 'ascii-atelier-holo-v1'
const DAY_SECONDS = 210
const REACH = 7.5
const TAP_CORRECTION_RADIUS = 2
const ACTION_COOLDOWN_MINE = 0.18
const ACTION_COOLDOWN_PLACE = 0.28
const COYOTE_TIME = 0.12
const JUMP_BUFFER = 0.15
const JUMP_VELOCITY = -11.5
const JUMP_VELOCITY_WATER = -7
const AUTO_LIFT_THRESHOLD = 3.5

export function createAsciiWorldGame({ root, getSource, onFrame, notify = () => {} }) {
  if (!root) throw new Error('ASCII world root is required.')

  root.innerHTML = `
    <div class="world-app" role="application" aria-label="ATELIER WILDS ASCII sandbox">
      <div class="sibyl-bg sibyl-bg--world" aria-hidden="true">
        <div class="sibyl-rings"><i></i><i></i><i></i></div>
        <div class="sibyl-wave"></div>
        <div class="sibyl-scan"></div>
      </div>
      <header class="world-header">
        <div class="world-brand">
          <span class="world-brand-mark">@</span>
          <span><b>ATELIER WILDS</b><small>playable ASCII world</small></span>
        </div>
        <div class="world-readouts" aria-label="World status">
          <span id="worldBiome">--</span>
          <span id="worldClock">Dawn 01</span>
          <span id="worldCoords">x 0 · y 0</span>
        </div>
        <div class="world-header-actions">
          <button class="secondary-button" id="worldHolo" type="button" aria-pressed="true">Holo</button>
          <button class="secondary-button" id="worldPause" type="button" aria-pressed="false">Pause</button>
          <button class="secondary-button" id="worldRemix" type="button">Remix</button>
          <button class="primary-button" id="worldFrame" type="button">Frame Scene</button>
          <button class="secondary-button" id="worldSOS" type="button" aria-label="Emergency rescue to safe ground">SOS</button>
          <button class="icon-button" id="worldClose" type="button" aria-label="Close world">×</button>
        </div>
      </header>

      <main class="world-main">
        <section class="world-stage-shell" aria-label="ASCII world view">
          <canvas id="worldCanvas" tabindex="0" aria-label="ASCII sandbox. Use A and D to move, Space to jump, tap glyphs to mine or place."></canvas>
          <div class="world-stage-hud">
            <div class="world-lumen"><span>LUMEN</span><b id="worldLumen">◆◆◆◆◆</b></div>
            <div class="world-objective"><span>NEXT VERSE</span><b id="worldObjective">Touch the paper. Mine one glyph.</b></div>
          </div>
          <div class="world-event" id="worldEvent" role="status" aria-live="polite" hidden></div>
          <div class="world-target" id="worldTarget">Tap a glyph within reach.</div>
          <div class="world-paused" id="worldPaused" hidden>
            <b>WORLD PAUSED</b>
            <span>Your paper waits here.</span>
          </div>
        </section>

        <section class="world-console" aria-label="World controls">
          <div class="world-mode" role="group" aria-label="Action mode">
            <button class="active" id="worldMineMode" type="button" aria-pressed="true"><span>⛏</span> Mine</button>
            <button id="worldPlaceMode" type="button" aria-pressed="false"><span>▣</span> Place</button>
            <button class="world-craft-toggle" id="worldCraftToggle" type="button" aria-expanded="false"><span>✦</span> Craft</button>
          </div>

          <div class="world-hotbar" id="worldHotbar" role="toolbar" aria-label="Glyph inventory"></div>

          <div class="world-craft" aria-label="Crafting">
            <div class="world-craft-head">
              <b>GLYPH SYNTAX</b>
              <button class="icon-button" id="worldCraftClose" type="button" aria-label="Close crafting">×</button>
            </div>
            <button type="button" data-craft="plank"><b>= ×4</b><span>1 wood</span></button>
            <button type="button" data-craft="torch"><b>! ×3</b><span>1 wood + 1 coal</span></button>
            <button type="button" data-craft="beacon"><b>! ×8</b><span>3 crystal + 4 stone</span></button>
          </div>
        </section>

        <section class="world-touch" aria-label="Touch controls">
          <div class="world-move-controls">
            <button id="worldLeft" type="button" aria-label="Move left">←</button>
            <button id="worldJump" type="button" aria-label="Jump">↑</button>
            <button id="worldRight" type="button" aria-label="Move right">→</button>
          </div>
          <button class="world-action-button" id="worldAction" type="button"><span>⛏</span><b>MINE</b></button>
        </section>

        <div class="world-back-bar">
          <button class="secondary-button" id="worldBack" type="button">◀ Atelierに戻る</button>
        </div>

        <footer class="world-help">
          <span><kbd>A</kbd><kbd>D</kbd> move</span>
          <span><kbd>Space</kbd> jump</span>
          <span><kbd>X</kbd> mine</span>
          <span><kbd>C</kbd> place</span>
          <span>Tap/hold/drag glyphs to act</span>
          <span>SOS: rescue</span>
          <b id="worldSaveState">Saved locally</b>
        </footer>
      </main>
    </div>
  `

  const $ = (selector) => root.querySelector(selector)
  const canvas = $('#worldCanvas')
  const context = canvas.getContext('2d')
  const saved = restoreWorldState(localStorage.getItem(STORAGE_KEY))
  const initialSource = safeSource(getSource)
  let world = saved?.world || generateWorld(initialSource.prompt, biomeForMotif(initialSource.motif))
  let player = saved?.player ? { ...createPlayer(world), ...saved.player } : createPlayer(world)
  let inventory = { ...defaultInventory(), ...(saved?.inventory || {}) }
  let selected = saved?.selected || 'soil'
  let mode = saved?.mode === 'place' ? 'place' : 'mine'
  let worldTime = Number(saved?.time) || 0
  let discoveries = Array.isArray(saved?.discoveries) ? saved.discoveries : []
  let open = false
  let paused = false
  let frameId = 0
  let lastFrame = 0
  let accumulator = 0
  let dirty = false
  let lastSavedAt = performance.now()
  let target = { x: Math.floor(player.x + 2), y: Math.floor(player.y) }
  let camera = { x: player.x, y: player.y - 2 }
  let view = { cols: 42, rows: 22, cellW: 10, cellH: 16, cssWidth: 420, cssHeight: 352, dpr: 1 }
  let input = { left: false, right: false, jumpQueued: false, action: false, keyboardAction: false }
  let actionCooldown = 0
  let uiCooldown = 0
  let particles = []
  let minedCount = saved?.stats?.minedCount || 0
  let placedCount = saved?.stats?.placedCount || 0
  let firstOpen = !saved
  let announcementTimer = 0
  let coyoteTimer = 0
  let jumpBufferTimer = 0
  let lastGrounded = false
  let targetFlash = 0
  let audioCtx = null
  let dragMining = false
  let lastDragTarget = null

  function openWorld({ fromSource = false } = {}) {
    if (fromSource) {
      const source = safeSource(getSource)
      const hasProgress = minedCount + placedCount > 0 || Boolean(localStorage.getItem(STORAGE_KEY))
      if (!hasProgress || window.confirm('現在のATELIER WILDSを新しい作品世界で置き換えますか？')) {
        startNewWorld(source, false)
      }
    }
    open = true
    root.hidden = false
    root.setAttribute('aria-hidden', 'false')
    document.body.classList.add('world-open')
    document.documentElement.classList.add('world-open')
    setCraftOpen(false)
    setPaused(false, { save: false })
    requestAnimationFrame(() => {
      resizeCanvas()
      canvas.focus({ preventScroll: true })
      renderAllUi()
      startLoop()
    })
    if (firstOpen) {
      firstOpen = false
      announce('Welcome! Move with A/D, jump with Space, tap glyphs to mine. Hold to drag-mine.')
      notify('ATELIER WILDSへようこそ。A/Dで移動、Spaceでジャンプ、タップで採掘。長押しドラッグで連続採掘。')
    }
  }

  function closeWorld() {
    saveNow()
    open = false
    setPaused(true, { save: false })
    cancelAnimationFrame(frameId)
    root.hidden = true
    root.setAttribute('aria-hidden', 'true')
    document.body.classList.remove('world-open')
    document.documentElement.classList.remove('world-open')
    setCraftOpen(false)
    releaseInputs()
  }

  function startNewWorld(source, randomize = false) {
    const seedText = randomize ? `${source.prompt}|${Date.now()}|${Math.random()}` : source.prompt
    world = generateWorld(seedText, biomeForMotif(source.motif))
    player = createPlayer(world)
    inventory = defaultInventory()
    selected = 'soil'
    mode = 'mine'
    worldTime = 0
    discoveries = []
    minedCount = 0
    placedCount = 0
    target = { x: Math.floor(player.x + 2), y: Math.floor(player.y) }
    camera = { x: player.x, y: player.y - 2 }
    particles = []
    markDirty()
    saveNow()
    renderAllUi()
    announce(`${world.name} was written from “${source.prompt.slice(0, 36)}”.`)
  }

  function startLoop() {
    cancelAnimationFrame(frameId)
    lastFrame = performance.now()
    accumulator = 0
    frameId = requestAnimationFrame(loop)
  }

  function loop(now) {
    if (!open) return
    const elapsed = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000))
    lastFrame = now
    if (!paused) {
      accumulator += elapsed
      while (accumulator >= 1 / 60) {
        tick(1 / 60)
        accumulator -= 1 / 60
      }
    }
    draw()
    frameId = requestAnimationFrame(loop)
  }

  function tick(delta) {
    worldTime += delta
    actionCooldown = Math.max(0, actionCooldown - delta)
    uiCooldown = Math.max(0, uiCooldown - delta)
    targetFlash = Math.max(0, targetFlash - delta)
    const move = Number(input.right) - Number(input.left)
    if (move) {
      player.vx += move * 28 * delta
      player.facing = move
    } else {
      player.vx *= Math.pow(0.005, delta)
    }
    player.vx = clamp(player.vx, -6.4, 6.4)

    const inWater = tileAt(world, Math.floor(player.x), Math.floor(player.y)) === TILE.WATER
    const gravity = inWater ? 7 : 24
    player.vy = clamp(player.vy + gravity * delta, -12, inWater ? 4 : 14)

    // Coyote time: allow jump shortly after leaving ground
    const nowGrounded = player.grounded || inWater
    if (nowGrounded) {
      coyoteTimer = COYOTE_TIME
    } else {
      coyoteTimer = Math.max(0, coyoteTimer - delta)
    }

    // Jump buffer: queue jump input slightly before landing
    if (input.jumpQueued) {
      jumpBufferTimer = JUMP_BUFFER
      input.jumpQueued = false
    } else {
      jumpBufferTimer = Math.max(0, jumpBufferTimer - delta)
    }

    // Execute jump if buffered and coyote time available
    if (jumpBufferTimer > 0 && coyoteTimer > 0) {
      player.vy = inWater ? JUMP_VELOCITY_WATER : JUMP_VELOCITY
      player.grounded = false
      coyoteTimer = 0
      jumpBufferTimer = 0
      burst(player.x, player.y + 0.4, inWater ? '~' : '.', inWater ? '#64d8ff' : '#b6c5d8', 4)
    }

    lastGrounded = nowGrounded

    moveAxis('x', player.vx * delta)
    player.grounded = false
    moveAxis('y', player.vy * delta)

    // Auto-lift: if player is buried (solid above and below) or fallen far below surface, lift to nearest air
    if (isBuried(world, player.x, player.y) || player.y > world.height - AUTO_LIFT_THRESHOLD) {
      const safeY = findSafeY(world, player.x, player.y)
      if (safeY !== null) {
        player.y = safeY
        player.vy = 0
        announce('You were lifted to safety.')
      }
    }

    if (input.keyboardAction) aimAhead()
    if (input.action && actionCooldown <= 0) {
      performAction()
      actionCooldown = mode === 'mine' ? 0.22 : 0.32
    }

    camera.x += (player.x - camera.x) * Math.min(1, delta * 7)
    camera.y += (player.y - 2 - camera.y) * Math.min(1, delta * 6)
    camera.x = clamp(camera.x, view.cols / 2, world.width - view.cols / 2)
    camera.y = clamp(camera.y, view.rows / 2, world.height - view.rows / 2)

    particles = particles
      .map((particle) => ({ ...particle, y: particle.y - delta * particle.speed, life: particle.life - delta }))
      .filter((particle) => particle.life > 0)

    if (uiCooldown <= 0) {
      renderStatus()
      uiCooldown = 0.12
    }
    const saveInterval = dirty ? 1200 : 5000
    if (performance.now() - lastSavedAt > saveInterval) saveNow()
  }

  function isBuried(world, x, y) {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const above = isSolid(world, ix, iy - 1)
    const below = isSolid(world, ix, iy + 1)
    const current = isSolid(world, ix, iy)
    return (above && below) || current
  }

  function findSafeY(world, x, startY) {
    const ix = Math.floor(x)
    // Search upward for air with solid ground below
    for (let y = Math.floor(startY); y >= 2; y -= 1) {
      if (!isSolid(world, ix, y) && isSolid(world, ix, y + 1)) return y
    }
    // Fallback: find any air cell in column
    for (let y = 2; y < world.height - 2; y += 1) {
      if (!isSolid(world, ix, y) && isSolid(world, ix, y + 1)) return y
    }
    return null
  }

  function moveAxis(axis, amount) {
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.16))
    const step = amount / steps
    for (let index = 0; index < steps; index += 1) {
      const nextX = axis === 'x' ? player.x + step : player.x
      const nextY = axis === 'y' ? player.y + step : player.y
      if (collides(nextX, nextY)) {
        if (axis === 'x') player.vx = 0
        if (axis === 'y') {
          if (step > 0) player.grounded = true
          player.vy = 0
        }
        return
      }
      player.x = nextX
      player.y = nextY
    }
  }

  function collides(x, y) {
    const left = Math.floor(x - 0.28)
    const right = Math.floor(x + 0.28)
    const top = Math.floor(y - 0.74)
    const bottom = Math.floor(y + 0.42)
    return isSolid(world, left, top) || isSolid(world, right, top) || isSolid(world, left, bottom) || isSolid(world, right, bottom)
  }

  function performAction() {
    // Tap correction: find nearest mineable/placeable within correction radius
    const corrected = correctTarget(target.x, target.y)
    if (corrected) target = corrected

    if (!withinReach(target.x, target.y)) {
      announce('That glyph is beyond your reach.')
      return false
    }
    let result
    if (mode === 'mine') {
      result = mineTile(world, target.x, target.y, inventory)
      if (result.ok) {
        minedCount += 1
        triggerMineFeedback(target.x, target.y, result.tile)
        if (result.drop === 'crystal' && !discoveries.includes('echo-crystal')) {
          discoveries.push('echo-crystal')
          announce('Echo crystal found. The paper remembers your light.')
          notify('Echo crystalを発見しました。')
        } else {
          announce(`${TILE_INFO[result.tile].label} mined.`)
        }
      }
    } else {
      const placeable = PLACEABLES.find((entry) => entry.item === selected) || PLACEABLES[0]
      result = placeTile(world, target.x, target.y, placeable.tile, inventory, occupiedCells())
      if (result.ok) {
        placedCount += 1
        burst(target.x + 0.5, target.y + 0.5, TILE_INFO[result.tile].glyph, TILE_INFO[result.tile].color, 5)
        announce(`${TILE_INFO[result.tile].label} placed.`)
      }
    }
    if (!result?.ok) {
      const messages = {
        unbreakable: 'This glyph belongs to the foundation.',
        occupied: 'That cell already carries a glyph.',
        'player-space': 'You cannot write inside @.',
        empty: `No ${result?.item || selected} remains.`,
        floating: 'Place beside another glyph.',
      }
      announce(messages[result?.reason] || 'Nothing changed there.')
      return false
    }
    markDirty()
    renderHotbar()
    return true
  }

  function occupiedCells() {
    const x = Math.floor(player.x)
    const y = Math.floor(player.y)
    return [{ x, y }, { x, y: y - 1 }]
  }

  function correctTarget(tx, ty) {
    // Only correct in mine mode - find nearest mineable tile within radius
    if (mode !== 'mine') return null
    let best = null
    let bestDist = Infinity
    for (let dy = -TAP_CORRECTION_RADIUS; dy <= TAP_CORRECTION_RADIUS; dy += 1) {
      for (let dx = -TAP_CORRECTION_RADIUS; dx <= TAP_CORRECTION_RADIUS; dx += 1) {
        const x = tx + dx
        const y = ty + dy
        const tile = tileAt(world, x, y)
        const info = TILE_INFO[tile]
        if (info?.mineable && withinReach(x, y)) {
          const dist = Math.hypot(dx, dy)
          if (dist < bestDist) {
            bestDist = dist
            best = { x, y }
          }
        }
      }
    }
    return best
  }

  function triggerMineFeedback(x, y, tile) {
    const info = TILE_INFO[tile]
    burst(x + 0.5, y + 0.5, info.glyph, info.color, 7)
    // Target flash
    targetFlash = 0.18
    // Vibration
    try {
      if (navigator.vibrate) navigator.vibrate(40)
    } catch { /* ignore */ }
    // WebAudio blip
    playBlip()
  }

  function playBlip() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      if (audioCtx.state === 'suspended') audioCtx.resume()
      const now = audioCtx.currentTime
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(520, now)
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.08)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(now)
      osc.stop(now + 0.12)
    } catch { /* ignore */ }
  }

  function withinReach(x, y) {
    return Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y) <= REACH
  }

  function draw() {
    if (!canvas.width || !canvas.height) return
    const dpr = view.dpr
    const width = canvas.width
    const height = canvas.height
    const phase = (worldTime % DAY_SECONDS) / DAY_SECONDS
    const night = nightAmount(phase)
    const biome = BIOMES[world.biome]
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, mixColor(biome.sky, '#02030a', night * 0.76))
    gradient.addColorStop(1, mixColor(biome.horizon, '#050713', night * 0.66))
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    drawStars(night)

    const startX = Math.floor(camera.x - view.cols / 2)
    const startY = Math.floor(camera.y - view.rows / 2)
    const torches = visibleLights(startX, startY)
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `600 ${Math.floor(view.cellH * 0.82 * dpr)}px "DM Mono", ui-monospace, monospace`

    for (let row = 0; row < view.rows; row += 1) {
      const worldY = startY + row
      for (let col = 0; col < view.cols; col += 1) {
        const worldX = startX + col
        const tile = tileAt(world, worldX, worldY)
        if (tile === TILE.AIR) continue
        const info = TILE_INFO[tile]
        const light = cellLight(worldX, worldY, night, torches)
        const x = (col + 0.5) * view.cellW * dpr
        const y = (row + 0.53) * view.cellH * dpr
        let glyph = connectedGlyph(tile, worldX, worldY)
        if (tile === TILE.WATER && (worldX + Math.floor(worldTime * 3)) % 5 === 0) glyph = '≈'
        context.globalAlpha = clamp(light, 0.18, 1)
        context.fillStyle = info.color
        if (info.light || tile === TILE.CRYSTAL) {
          context.shadowColor = info.color
          context.shadowBlur = 10 * dpr
        } else {
          context.shadowBlur = 0
        }
        context.fillText(glyph, x, y)
      }
    }
    context.shadowBlur = 0
    context.globalAlpha = 1

    for (const particle of particles) {
      const col = particle.x - startX
      const row = particle.y - startY
      if (col < 0 || row < 0 || col >= view.cols || row >= view.rows) continue
      context.globalAlpha = clamp(particle.life * 1.8, 0, 1)
      context.fillStyle = particle.color
      context.fillText(particle.glyph, (col + 0.5) * view.cellW * dpr, (row + 0.5) * view.cellH * dpr)
    }

    const playerCol = player.x - startX
    const playerRow = player.y - startY
    context.globalAlpha = 1
    context.shadowColor = biome.accent
    context.shadowBlur = 14 * dpr
    context.fillStyle = '#f6ffff'
    context.font = `800 ${Math.floor(view.cellH * 0.94 * dpr)}px "DM Mono", ui-monospace, monospace`
    context.fillText('@', (playerCol + 0.5) * view.cellW * dpr, (playerRow + 0.43) * view.cellH * dpr)
    context.shadowBlur = 0

    const targetCol = target.x - startX
    const targetRow = target.y - startY
    if (targetCol >= 0 && targetRow >= 0 && targetCol < view.cols && targetRow < view.rows) {
      context.strokeStyle = withinReach(target.x, target.y) ? biome.accent : '#ff7d92'
      context.lineWidth = Math.max(1, dpr)
      context.setLineDash([3 * dpr, 3 * dpr])
      context.strokeRect(targetCol * view.cellW * dpr + dpr, targetRow * view.cellH * dpr + dpr, view.cellW * dpr - 2 * dpr, view.cellH * dpr - 2 * dpr)
      context.setLineDash([])
      // Target flash effect on successful mine
      if (targetFlash > 0) {
        context.globalAlpha = clamp(targetFlash * 3, 0, 1)
        context.fillStyle = biome.accent
        context.fillRect(targetCol * view.cellW * dpr, targetRow * view.cellH * dpr, view.cellW * dpr, view.cellH * dpr)
        context.globalAlpha = 1
      }
    }
  }

  function drawStars(night) {
    if (night <= 0.08) return
    context.save()
    context.globalAlpha = night * 0.82
    context.fillStyle = '#d9fbff'
    const count = Math.floor(view.cols * 0.42)
    for (let index = 0; index < count; index += 1) {
      const key = hashSeed(`${world.seed}|star|${index}`)
      const x = (key % 1000) / 1000 * canvas.width
      const y = ((key >>> 10) % 600) / 600 * canvas.height * 0.58
      const size = key % 17 === 0 ? 2.2 * view.dpr : 1.1 * view.dpr
      context.fillRect(x, y, size, size)
    }
    context.restore()
  }

  function visibleLights(startX, startY) {
    const lights = [{ x: player.x, y: player.y, radius: 5.5 }]
    for (let row = 0; row < view.rows; row += 1) {
      for (let col = 0; col < view.cols; col += 1) {
        const x = startX + col
        const y = startY + row
        const info = TILE_INFO[tileAt(world, x, y)]
        if (info?.light) lights.push({ x, y, radius: info.light })
      }
    }
    return lights
  }

  function cellLight(x, y, night, lights) {
    let value = 1 - night * 0.78
    for (const light of lights) value = Math.max(value, 1 - Math.hypot(x - light.x, y - light.y) / light.radius)
    if (TILE_INFO[tileAt(world, x, y)]?.light || tileAt(world, x, y) === TILE.CRYSTAL) value = 1
    return value
  }

  function connectedGlyph(tile, x, y) {
    if (tile === TILE.PLANK) {
      const horizontal = tileAt(world, x - 1, y) === TILE.PLANK || tileAt(world, x + 1, y) === TILE.PLANK
      const vertical = tileAt(world, x, y - 1) === TILE.PLANK || tileAt(world, x, y + 1) === TILE.PLANK
      if (horizontal && vertical) return '+'
      return horizontal ? '=' : '|'
    }
    if (tile === TILE.GRASS) return tileAt(world, x, y - 1) === TILE.AIR ? '"' : ':'
    return TILE_INFO[tile].glyph
  }

  function setMode(nextMode, { persist = true } = {}) {
    mode = nextMode === 'place' ? 'place' : 'mine'
    $('#worldMineMode').classList.toggle('active', mode === 'mine')
    $('#worldPlaceMode').classList.toggle('active', mode === 'place')
    $('#worldMineMode').setAttribute('aria-pressed', String(mode === 'mine'))
    $('#worldPlaceMode').setAttribute('aria-pressed', String(mode === 'place'))
    $('#worldAction').innerHTML = mode === 'mine' ? '<span>⛏</span><b>MINE</b>' : '<span>▣</span><b>PLACE</b>'
    $('#worldMineMode').title = mode === 'mine' ? 'Mine mode (X)' : 'Switch to Mine (X)'
    $('#worldPlaceMode').title = mode === 'place' ? 'Place mode (C)' : 'Switch to Place (C)'
    if (persist) markDirty()
    renderTarget()
  }

  function selectItem(item) {
    if (!PLACEABLES.some((entry) => entry.item === item)) return
    selected = item
    if (mode !== 'place') setMode('place')
    renderHotbar()
    markDirty()
    announce(`${TILE_INFO[PLACEABLES.find((entry) => entry.item === item).tile].label} selected.`)
  }

  function renderAllUi() {
    $('#worldBiome').textContent = `${BIOMES[world.biome].label} · ${world.name.split(' ').at(-1)}`
    renderHotbar()
    setMode(mode, { persist: false })
    syncWorldHolo()
    renderStatus()
  }

  function renderHotbar() {
    $('#worldHotbar').innerHTML = PLACEABLES.map((entry, index) => {
      const info = TILE_INFO[entry.tile]
      const count = inventory[entry.item] || 0
      const active = selected === entry.item
      return `<button type="button" data-item="${entry.item}" class="${active ? 'active' : ''}" aria-pressed="${active}">
        <span style="--tile-color:${info.color}">${info.glyph}</span>
        <b>${info.label}</b>
        <small>${count}</small>
        <kbd>${index + 1}</kbd>
      </button>`
    }).join('')
  }

  function renderStatus() {
    const phase = (worldTime % DAY_SECONDS) / DAY_SECONDS
    const day = Math.floor(worldTime / DAY_SECONDS) + 1
    const period = phase < 0.14 ? 'Dawn' : phase < 0.58 ? 'Day' : phase < 0.72 ? 'Dusk' : 'Night'
    $('#worldClock').textContent = `${period} ${String(day).padStart(2, '0')}`
    $('#worldCoords').textContent = `x ${Math.floor(player.x)} · y ${Math.floor(player.y)}`
    $('#worldLumen').textContent = '◆'.repeat(player.hearts) + '◇'.repeat(Math.max(0, 5 - player.hearts))
    $('#worldObjective').textContent = objectiveText()
    renderTarget()
  }

  function objectiveText() {
    if (minedCount === 0) return 'Tap a glyph to mine it.'
    if ((inventory.wood || 0) < 5) return 'Gather 5 wood from | trees.'
    if ((inventory.stone || 0) < 4) return 'Collect 4 stone from #.'
    if ((inventory.torch || 0) < 3) return 'Craft 3 torches (!) for night.'
    if (!discoveries.includes('echo-crystal')) return 'Find * Echo crystal underground.'
    if (placedCount < 5) return 'Place 5 glyphs to build shelter.'
    return 'Frame this scene or keep writing.'
  }

  function renderTarget() {
    const tile = tileAt(world, target.x, target.y)
    const info = TILE_INFO[tile]
    const reach = withinReach(target.x, target.y) ? '✓' : '✗'
    const buried = isBuried(world, player.x, player.y) ? ' · BURIED' : ''
    $('#worldTarget').textContent = `${mode === 'mine' ? '⛏ Mine' : `▣ Place ${selected}`} · ${info.label} ${reach}${buried}`
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const desiredCellW = clamp(rect.width / (rect.width < 520 ? 36 : 62), 8, 13)
    const cellH = desiredCellW * 1.55
    view = {
      cssWidth: rect.width,
      cssHeight: rect.height,
      dpr,
      cellW: desiredCellW,
      cellH,
      cols: Math.max(28, Math.floor(rect.width / desiredCellW)),
      rows: Math.max(16, Math.floor(rect.height / cellH)),
    }
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    draw()
  }

  function setTargetFromPointer(event) {
    const rect = canvas.getBoundingClientRect()
    const col = Math.floor((event.clientX - rect.left) / rect.width * view.cols)
    const row = Math.floor((event.clientY - rect.top) / rect.height * view.rows)
    target = {
      x: Math.floor(camera.x - view.cols / 2) + col,
      y: Math.floor(camera.y - view.rows / 2) + row,
    }
    renderTarget()
  }

  function aimAhead() {
    const x = clamp(Math.floor(player.x + player.facing * 1.8), 0, world.width - 1)
    const y = clamp(Math.floor(player.y), 0, world.height - 1)
    const candidates = mode === 'mine'
      ? [{ x, y }, { x, y: y + 1 }, { x, y: y - 1 }]
      : [{ x, y }, { x, y: y - 1 }, { x, y: y + 1 }]
    const chosen = mode === 'mine'
      ? candidates.find((point) => TILE_INFO[tileAt(world, point.x, point.y)]?.mineable)
      : candidates.find((point) => tileAt(world, point.x, point.y) === TILE.AIR)
    target = chosen || candidates[0]
    renderTarget()
  }

  function handleCanvasPointer(event) {
    if (paused) return
    setTargetFromPointer(event)
    if (event.type === 'pointerdown') {
      dragMining = true
      lastDragTarget = { x: target.x, y: target.y }
      performAction()
      actionCooldown = mode === 'mine' ? ACTION_COOLDOWN_MINE : ACTION_COOLDOWN_PLACE
    }
  }

  function handleCanvasPointerMove(event) {
    if (paused || !dragMining) return
    setTargetFromPointer(event)
    // Only act if target changed (drag to new cell)
    if (target.x !== lastDragTarget.x || target.y !== lastDragTarget.y) {
      lastDragTarget = { x: target.x, y: target.y }
      if (actionCooldown <= 0) {
        performAction()
        actionCooldown = mode === 'mine' ? ACTION_COOLDOWN_MINE : ACTION_COOLDOWN_PLACE
      }
    }
  }

  function handleCanvasPointerUp(event) {
    dragMining = false
    lastDragTarget = null
  }

  function handleKeyDown(event) {
    if (!open) return
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'a', 'd', 'w', 'x', 'c', '1', '2', '3', '4', '5', '6', 'Escape'].includes(event.key)) event.preventDefault()
    if (event.key === 'a' || event.key === 'ArrowLeft') input.left = true
    if (event.key === 'd' || event.key === 'ArrowRight') input.right = true
    if ((event.key === 'w' || event.key === 'ArrowUp' || event.key === ' ') && !event.repeat) input.jumpQueued = true
    if (event.key === 'x') {
      setMode('mine')
      input.action = true
      input.keyboardAction = true
      aimAhead()
      if (!event.repeat) {
        performAction()
        actionCooldown = ACTION_COOLDOWN_MINE
      }
    }
    if (event.key === 'c') {
      setMode('place')
      input.action = true
      input.keyboardAction = true
      aimAhead()
      if (!event.repeat) {
        performAction()
        actionCooldown = ACTION_COOLDOWN_PLACE
      }
    }
    if (/^[1-6]$/.test(event.key)) selectItem(PLACEABLES[Number(event.key) - 1]?.item)
    if (event.key === 'Escape' && !event.repeat) togglePause()
  }

  function handleKeyUp(event) {
    if (event.key === 'a' || event.key === 'ArrowLeft') input.left = false
    if (event.key === 'd' || event.key === 'ArrowRight') input.right = false
    if (event.key === 'x' || event.key === 'c') {
      input.action = false
      input.keyboardAction = false
    }
  }

  function bindHold(button, property, { onPress } = {}) {
    const start = (event) => {
      if (paused) return
      event.preventDefault()
      button.setPointerCapture?.(event.pointerId)
      input[property] = true
      button.classList.add('pressed')
      onPress?.()
    }
    const stop = (event) => {
      input[property] = false
      button.classList.remove('pressed')
      if (event?.pointerId != null && button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId)
    }
    button.addEventListener('pointerdown', start)
    button.addEventListener('pointerup', stop)
    button.addEventListener('pointercancel', stop)
    button.addEventListener('lostpointercapture', stop)
  }

  function bindPulse(button, onPress) {
    const start = (event) => {
      if (paused) return
      event.preventDefault()
      button.setPointerCapture?.(event.pointerId)
      button.classList.add('pressed')
      onPress()
    }
    const stop = (event) => {
      button.classList.remove('pressed')
      if (event?.pointerId != null && button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId)
    }
    button.addEventListener('pointerdown', start)
    button.addEventListener('pointerup', stop)
    button.addEventListener('pointercancel', stop)
    button.addEventListener('lostpointercapture', stop)
  }

  function togglePause() {
    setPaused(!paused)
  }

  function setPaused(value, { save = true } = {}) {
    paused = Boolean(value)
    $('#worldPaused').hidden = !paused
    $('#worldPause').textContent = paused ? 'Resume' : 'Pause'
    $('#worldPause').setAttribute('aria-pressed', String(paused))
    releaseInputs()
    if (paused && save) saveNow()
  }

  function releaseInputs() {
    input.left = false
    input.right = false
    input.action = false
    input.keyboardAction = false
    input.jumpQueued = false
    root.querySelectorAll('.pressed').forEach((node) => node.classList.remove('pressed'))
  }

  function handleCraft(event) {
    const button = event.target.closest('[data-craft]')
    if (!button) return
    const result = craftItem(button.dataset.craft, inventory)
    if (result.ok) {
      markDirty()
      renderHotbar()
      announce(`Crafted ${result.count} ${result.item}.`)
    } else {
      announce(`Missing ${result.item || 'materials'} for that syntax.`)
    }
  }

  function setCraftOpen(value) {
    const expanded = Boolean(value)
    $('.world-craft').classList.toggle('open', expanded)
    $('#worldCraftToggle').setAttribute('aria-expanded', String(expanded))
  }

  function worldHoloState() {
    return document.body.dataset.holo === 'off' ? 'off' : 'on'
  }

  function syncWorldHolo() {
    const on = worldHoloState() === 'on'
    $('#worldHolo').setAttribute('aria-pressed', String(on))
    $('#worldHolo').textContent = on ? 'Holo' : 'Holo OFF'
  }

  function toggleWorldHolo() {
    const next = worldHoloState() === 'on' ? 'off' : 'on'
    document.body.dataset.holo = next
    try { localStorage.setItem(HOLO_KEY, next) } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('ascii-holo-change', { detail: next }))
    syncWorldHolo()
  }

  function triggerSOS() {
    const safeY = findSafeY(world, player.x, player.y)
    if (safeY !== null) {
      player.y = safeY
      player.vy = 0
      player.vx = 0
      announce('Emergency rescue! Returned to safe ground.')
    } else {
      // Ultimate fallback: respawn at world spawn
      player.x = world.spawn.x
      player.y = world.spawn.y
      player.vx = 0
      player.vy = 0
      announce('Respawned at world entrance.')
    }
  }

  function frameScene() {
    const frame = captureVisibleAscii()
    onFrame?.({
      ...frame,
      title: `${world.name} / Day ${Math.floor(worldTime / DAY_SECONDS) + 1}`,
      prompt: `ATELIER WILDS: ${world.name}`,
      biome: world.biome,
      seed: world.seed,
    })
    closeWorld()
    notify('ATELIER WILDSの景色を編集キャンバスへ送りました。')
  }

  function captureVisibleAscii() {
    const cols = Math.min(96, view.cols)
    const rows = Math.min(42, view.rows)
    const startX = Math.floor(camera.x - cols / 2)
    const startY = Math.floor(camera.y - rows / 2)
    const lines = []
    for (let row = 0; row < rows; row += 1) {
      let line = ''
      for (let col = 0; col < cols; col += 1) {
        const x = startX + col
        const y = startY + row
        if (Math.floor(player.x) === x && Math.floor(player.y) === y) line += '@'
        else line += connectedGlyph(tileAt(world, x, y), x, y)
      }
      lines.push(line.trimEnd())
    }
    return { art: lines.join('\n'), width: cols, height: rows }
  }

  function markDirty() {
    dirty = true
    $('#worldSaveState').textContent = 'Saving…'
  }

  function saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, serializeWorldState({
        world,
        player,
        inventory,
        selected,
        mode,
        time: worldTime,
        discoveries,
        stats: { minedCount, placedCount },
      }))
      dirty = false
      lastSavedAt = performance.now()
      $('#worldSaveState').textContent = 'Saved locally'
    } catch {
      $('#worldSaveState').textContent = 'Save full'
      announce('Local save space is full. Frame your scene before leaving.')
      notify('ローカル保存容量がいっぱいです。Frame Sceneで作品化してください。')
    }
  }

  function announce(message) {
    const eventNode = $('#worldEvent')
    eventNode.textContent = message
    eventNode.hidden = false
    clearTimeout(announcementTimer)
    announcementTimer = window.setTimeout(() => {
      eventNode.hidden = true
      eventNode.textContent = ''
    }, 2400)
  }

  function burst(x, y, glyph, color, count) {
    for (let index = 0; index < count; index += 1) {
      particles.push({ x: x + (Math.random() - 0.5) * 0.7, y: y + (Math.random() - 0.5) * 0.4, glyph, color, life: 0.35 + Math.random() * 0.45, speed: 0.2 + Math.random() * 0.8 })
    }
  }

  $('#worldClose').addEventListener('click', closeWorld)
  $('#worldBack').addEventListener('click', closeWorld)
  $('#worldPause').addEventListener('click', togglePause)
  $('#worldHolo').addEventListener('click', toggleWorldHolo)
  window.addEventListener('ascii-holo-change', syncWorldHolo)
  $('#worldRemix').addEventListener('click', () => {
    if (window.confirm('新しい地形へリミックスしますか？ 現在の世界は置き換わります。')) startNewWorld(safeSource(getSource), true)
  })
  $('#worldFrame').addEventListener('click', frameScene)
  $('#worldSOS').addEventListener('click', triggerSOS)
  $('#worldMineMode').addEventListener('click', () => setMode('mine'))
  $('#worldPlaceMode').addEventListener('click', () => setMode('place'))
  $('#worldCraftToggle').addEventListener('click', () => setCraftOpen(!$('.world-craft').classList.contains('open')))
  $('#worldCraftClose').addEventListener('click', () => setCraftOpen(false))
  $('#worldHotbar').addEventListener('click', (event) => {
    const button = event.target.closest('[data-item]')
    if (button) selectItem(button.dataset.item)
  })
  $('.world-craft').addEventListener('click', handleCraft)
  canvas.addEventListener('pointerdown', handleCanvasPointer)
  canvas.addEventListener('pointermove', handleCanvasPointerMove)
  canvas.addEventListener('pointerup', handleCanvasPointerUp)
  canvas.addEventListener('pointercancel', handleCanvasPointerUp)
  canvas.addEventListener('contextmenu', (event) => event.preventDefault())
  bindHold($('#worldLeft'), 'left')
  bindHold($('#worldRight'), 'right')
  bindHold($('#worldAction'), 'action', {
    onPress: () => {
      performAction()
      actionCooldown = mode === 'mine' ? ACTION_COOLDOWN_MINE : ACTION_COOLDOWN_PLACE
    },
  })
  bindPulse($('#worldJump'), () => { input.jumpQueued = true })
  window.addEventListener('keydown', handleKeyDown, { passive: false })
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('blur', releaseInputs)
  window.addEventListener('pagehide', saveNow)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && open && !paused) togglePause()
    if (document.hidden) saveNow()
  })

  root.hidden = true
  root.setAttribute('aria-hidden', 'true')

  return {
    open: openWorld,
    close: closeWorld,
    save: saveNow,
    newFromSource: () => startNewWorld(safeSource(getSource), false),
    snapshot: () => ({ world, player, inventory, selected, mode, time: worldTime, discoveries }),
  }
}

function safeSource(getSource) {
  try {
    const source = getSource?.() || {}
    return {
      prompt: String(source.prompt || 'A quiet glyph meadow'),
      motif: String(source.motif || 'abstract'),
    }
  } catch {
    return { prompt: 'A quiet glyph meadow', motif: 'abstract' }
  }
}

function nightAmount(phase) {
  if (phase < 0.55) return 0
  if (phase < 0.72) return (phase - 0.55) / 0.17
  if (phase < 0.93) return 1
  return (1 - phase) / 0.07
}

function mixColor(first, second, amount) {
  const a = parseHex(first)
  const b = parseHex(second)
  const mix = a.map((value, index) => Math.round(value + (b[index] - value) * clamp(amount, 0, 1)))
  return `rgb(${mix.join(',')})`
}

function parseHex(value) {
  const clean = value.replace('#', '')
  return [0, 2, 4].map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16))
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
