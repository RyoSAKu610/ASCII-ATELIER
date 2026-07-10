export const WORLD_VERSION = 1
export const WORLD_WIDTH = 240
export const WORLD_HEIGHT = 72

export const TILE = Object.freeze({
  AIR: 0,
  GRASS: 1,
  SOIL: 2,
  STONE: 3,
  COAL: 4,
  CRYSTAL: 5,
  WOOD: 6,
  LEAVES: 7,
  WATER: 8,
  TORCH: 9,
  PLANK: 10,
  FLOWER: 11,
  BEDROCK: 12,
  SHRINE: 13,
})

export const TILE_INFO = Object.freeze({
  [TILE.AIR]: { key: 'air', label: 'Air', glyph: ' ', color: '#09111b', solid: false, mineable: false },
  [TILE.GRASS]: { key: 'grass', label: 'Grass', glyph: '"', color: '#8ff58b', solid: true, mineable: true, drop: 'soil' },
  [TILE.SOIL]: { key: 'soil', label: 'Soil', glyph: ':', color: '#c88b5f', solid: true, mineable: true, drop: 'soil' },
  [TILE.STONE]: { key: 'stone', label: 'Stone', glyph: '#', color: '#9aa6b7', solid: true, mineable: true, drop: 'stone' },
  [TILE.COAL]: { key: 'coal', label: 'Coal', glyph: 'c', color: '#596273', solid: true, mineable: true, drop: 'coal' },
  [TILE.CRYSTAL]: { key: 'crystal', label: 'Echo crystal', glyph: '*', color: '#77f8ff', solid: true, mineable: true, drop: 'crystal' },
  [TILE.WOOD]: { key: 'wood', label: 'Wood', glyph: '|', color: '#db9f62', solid: true, mineable: true, drop: 'wood' },
  [TILE.LEAVES]: { key: 'leaves', label: 'Leaves', glyph: '&', color: '#70dc83', solid: true, mineable: true, drop: 'leaves' },
  [TILE.WATER]: { key: 'water', label: 'Water', glyph: '~', color: '#55b8e8', solid: false, mineable: false },
  [TILE.TORCH]: { key: 'torch', label: 'Glyph torch', glyph: '!', color: '#ffd56a', solid: false, mineable: true, drop: 'torch', light: 8 },
  [TILE.PLANK]: { key: 'plank', label: 'Plank', glyph: '=', color: '#e2b978', solid: true, mineable: true, drop: 'plank' },
  [TILE.FLOWER]: { key: 'flower', label: 'Wild glyph', glyph: '+', color: '#ff91c8', solid: false, mineable: true, drop: 'flower' },
  [TILE.BEDROCK]: { key: 'bedrock', label: 'Bedrock', glyph: '%', color: '#445064', solid: true, mineable: false },
  [TILE.SHRINE]: { key: 'shrine', label: 'Ancient terminal', glyph: 'Ω', color: '#b898ff', solid: true, mineable: false, light: 5 },
})

export const PLACEABLES = Object.freeze([
  { item: 'soil', tile: TILE.SOIL },
  { item: 'stone', tile: TILE.STONE },
  { item: 'wood', tile: TILE.WOOD },
  { item: 'plank', tile: TILE.PLANK },
  { item: 'torch', tile: TILE.TORCH },
  { item: 'flower', tile: TILE.FLOWER },
])

export const BIOMES = Object.freeze({
  meadow: { label: 'Glyph Meadow', sky: '#07141c', horizon: '#123027', accent: '#8ff58b' },
  mountain: { label: 'Slash Peaks', sky: '#080d1b', horizon: '#1a2840', accent: '#d8e8ff' },
  ocean: { label: 'Tilde Coast', sky: '#071522', horizon: '#0b3750', accent: '#64d8ff' },
  city: { label: 'Lost Terminal', sky: '#09091a', horizon: '#211637', accent: '#86f7ff' },
  space: { label: 'Asterisk Moon', sky: '#050611', horizon: '#17152c', accent: '#c5a7ff' },
})

const MOTIF_BIOME = Object.freeze({
  mountain: 'mountain',
  tree: 'meadow',
  flower: 'meadow',
  cat: 'city',
  robot: 'city',
  city: 'city',
  ocean: 'ocean',
  dragon: 'mountain',
  space: 'space',
  bird: 'mountain',
})

export function biomeForMotif(motif = '') {
  return MOTIF_BIOME[motif] || 'meadow'
}

export function hashSeed(value = '') {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function generateWorld(seedInput = 'ASCII WORLD', biomeInput = 'meadow', width = WORLD_WIDTH, height = WORLD_HEIGHT) {
  const seed = typeof seedInput === 'number' ? seedInput >>> 0 : hashSeed(seedInput)
  const biome = BIOMES[biomeInput] ? biomeInput : 'meadow'
  const safeWidth = clamp(Math.round(width), 48, 480)
  const safeHeight = clamp(Math.round(height), 32, 120)
  const tiles = Array(safeWidth * safeHeight).fill(TILE.AIR)
  const world = { version: WORLD_VERSION, seed, biome, width: safeWidth, height: safeHeight, tiles }
  const random = mulberry32(seed)
  const surface = makeSurface(world, random)

  fillGround(world, surface, random)
  carveCaves(world, surface, seed)
  scatterOres(world, surface, seed)
  decorateSurface(world, surface, random)
  buildBiomeLandmark(world, surface, random)
  sealBedrock(world)

  const spawnX = clamp(12 + (seed % 17), 4, safeWidth - 5)
  const spawnY = findSpawnY(world, spawnX)
  clearSpawn(world, spawnX, spawnY)

  return {
    ...world,
    spawn: { x: spawnX, y: spawnY },
    name: `${BIOMES[biome].label} ${String(seed).slice(-4).padStart(4, '0')}`,
  }
}

export function tileAt(world, x, y) {
  if (!world || x < 0 || y < 0 || x >= world.width || y >= world.height) return TILE.BEDROCK
  return world.tiles[y * world.width + x]
}

export function setTile(world, x, y, tile) {
  if (!world || x < 0 || y < 0 || x >= world.width || y >= world.height) return false
  if (!TILE_INFO[tile]) return false
  world.tiles[y * world.width + x] = tile
  return true
}

export function isSolid(world, x, y) {
  return Boolean(TILE_INFO[tileAt(world, x, y)]?.solid)
}

export function findSpawnY(world, x) {
  for (let y = 2; y < world.height - 2; y += 1) {
    if (!isSolid(world, x, y) && isSolid(world, x, y + 1)) return y
  }
  return 2
}

export function mineTile(world, x, y, inventory = {}) {
  const tile = tileAt(world, x, y)
  const info = TILE_INFO[tile]
  if (!info?.mineable) return { ok: false, reason: 'unbreakable', tile }
  if (!setTile(world, x, y, TILE.AIR)) return { ok: false, reason: 'outside', tile }
  const drop = info.drop
  if (drop) inventory[drop] = (inventory[drop] || 0) + 1
  return { ok: true, tile, drop, count: drop ? inventory[drop] : 0 }
}

export function placeTile(world, x, y, tile, inventory = {}, occupied = []) {
  const info = TILE_INFO[tile]
  if (!info || tile === TILE.AIR || !PLACEABLES.some((entry) => entry.tile === tile)) return { ok: false, reason: 'not-placeable' }
  if (tileAt(world, x, y) !== TILE.AIR && tileAt(world, x, y) !== TILE.WATER) return { ok: false, reason: 'occupied' }
  if (occupied.some((point) => point.x === x && point.y === y)) return { ok: false, reason: 'player-space' }
  const item = info.drop || info.key
  if ((inventory[item] || 0) <= 0) return { ok: false, reason: 'empty', item }
  const hasNeighbor = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(world, x + dx, y + dy) !== TILE.AIR)
  if (!hasNeighbor) return { ok: false, reason: 'floating' }
  setTile(world, x, y, tile)
  inventory[item] -= 1
  return { ok: true, tile, item, count: inventory[item] }
}

export function craftItem(recipe, inventory = {}) {
  const recipes = {
    plank: { costs: { wood: 1 }, output: { item: 'plank', count: 4 } },
    torch: { costs: { wood: 1, coal: 1 }, output: { item: 'torch', count: 3 } },
    beacon: { costs: { crystal: 3, stone: 4 }, output: { item: 'torch', count: 8 } },
  }
  const selected = recipes[recipe]
  if (!selected) return { ok: false, reason: 'unknown-recipe' }
  const missing = Object.entries(selected.costs).find(([item, count]) => (inventory[item] || 0) < count)
  if (missing) return { ok: false, reason: 'missing', item: missing[0] }
  for (const [item, count] of Object.entries(selected.costs)) inventory[item] -= count
  inventory[selected.output.item] = (inventory[selected.output.item] || 0) + selected.output.count
  return { ok: true, ...selected.output }
}

export function createPlayer(world) {
  return {
    x: world.spawn.x,
    y: world.spawn.y,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    hearts: 5,
  }
}

export function defaultInventory() {
  return { soil: 8, stone: 0, coal: 0, crystal: 0, wood: 4, leaves: 0, plank: 0, torch: 2, flower: 0 }
}

export function serializeWorldState({ world, player, inventory, selected = 'soil', mode = 'mine', time = 0, discoveries = [], stats = {} }) {
  return JSON.stringify({
    version: WORLD_VERSION,
    world: {
      version: world.version,
      seed: world.seed,
      biome: world.biome,
      width: world.width,
      height: world.height,
      tiles: world.tiles,
      spawn: world.spawn,
      name: world.name,
    },
    player,
    inventory,
    selected,
    mode,
    time,
    discoveries,
    stats: {
      minedCount: Math.max(0, Math.floor(Number(stats.minedCount) || 0)),
      placedCount: Math.max(0, Math.floor(Number(stats.placedCount) || 0)),
    },
  })
}

export function restoreWorldState(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    const world = parsed?.world
    if (parsed?.version !== WORLD_VERSION || world?.version !== WORLD_VERSION) return null
    if (!Number.isInteger(world.width) || world.width < 48 || world.width > 480) return null
    if (!Number.isInteger(world.height) || world.height < 32 || world.height > 120) return null
    if (!Number.isInteger(world.seed) || world.seed < 0 || world.seed > 0xffffffff) return null
    if (!BIOMES[world.biome]) return null
    if (typeof world.name !== 'string' || !world.name.trim() || world.name.length > 120) return null
    if (!Array.isArray(world.tiles) || world.tiles.length !== world.width * world.height) return null
    if (!world.tiles.every((tile) => Number.isInteger(tile) && TILE_INFO[tile])) return null
    if (!isPoint(world.spawn) || !insideWorld(world, world.spawn.x, world.spawn.y)) return null
    if (!parsed.player || !['x', 'y', 'vx', 'vy', 'hearts'].every((key) => Number.isFinite(parsed.player[key]))) return null
    if (!insideWorld(world, parsed.player.x, parsed.player.y)) return null
    if (Math.abs(parsed.player.vx) > 100 || Math.abs(parsed.player.vy) > 100) return null
    if (parsed.player.hearts < 0 || parsed.player.hearts > 5) return null
    if (![1, -1].includes(parsed.player.facing)) return null
    if (typeof parsed.player.grounded !== 'boolean') return null
    if (!parsed.inventory || typeof parsed.inventory !== 'object' || Array.isArray(parsed.inventory)) return null
    const inventoryKeys = Object.keys(defaultInventory())
    if (!inventoryKeys.every((key) => Number.isInteger(parsed.inventory[key]) && parsed.inventory[key] >= 0 && parsed.inventory[key] <= 1000000)) return null
    if (!PLACEABLES.some((entry) => entry.item === parsed.selected)) return null
    if (!['mine', 'place'].includes(parsed.mode)) return null
    if (!Number.isFinite(parsed.time) || parsed.time < 0 || parsed.time > 1e9) return null
    if (!Array.isArray(parsed.discoveries) || parsed.discoveries.length > 64 || !parsed.discoveries.every((item) => typeof item === 'string' && item.length <= 80)) return null
    const stats = parsed.stats || { minedCount: 0, placedCount: 0 }
    if (!['minedCount', 'placedCount'].every((key) => Number.isInteger(stats[key]) && stats[key] >= 0 && stats[key] <= 100000000)) return null
    parsed.stats = stats
    return parsed
  } catch {
    return null
  }
}

function isPoint(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y)
}

function insideWorld(world, x, y) {
  return x >= 0 && y >= 0 && x < world.width && y < world.height
}

function makeSurface(world, random) {
  const result = []
  const base = world.biome === 'mountain' ? world.height * 0.47 : world.biome === 'ocean' ? world.height * 0.56 : world.height * 0.42
  let drift = 0
  for (let x = 0; x < world.width; x += 1) {
    drift = drift * 0.82 + (random() - 0.5) * (world.biome === 'mountain' ? 2.2 : 1.15)
    const longWave = Math.sin((x + world.seed % 31) / (world.biome === 'mountain' ? 10 : 19)) * (world.biome === 'mountain' ? 7 : 3.2)
    const shortWave = Math.sin((x + world.seed % 13) / 5.7) * 1.5
    let y = Math.round(base + longWave + shortWave + drift)
    if (world.biome === 'space') y = Math.round(world.height * 0.48 + longWave * 0.55 + shortWave)
    if (world.biome === 'city') y = Math.round(world.height * 0.45 + Math.sin(x / 14) * 2 + drift * 0.3)
    result.push(clamp(y, 12, world.height - 16))
  }
  return result
}

function fillGround(world, surface, random) {
  const seaLevel = Math.round(world.height * 0.48)
  for (let x = 0; x < world.width; x += 1) {
    const top = surface[x]
    for (let y = top; y < world.height; y += 1) {
      const depth = y - top
      let tile = depth === 0 ? TILE.GRASS : depth < 5 ? TILE.SOIL : TILE.STONE
      if (world.biome === 'space') tile = depth < 3 ? TILE.STONE : random() > 0.93 ? TILE.CRYSTAL : TILE.STONE
      setTile(world, x, y, tile)
    }
    if (world.biome === 'ocean' && top > seaLevel) {
      for (let y = seaLevel; y < top; y += 1) setTile(world, x, y, TILE.WATER)
    }
  }
}

function carveCaves(world, surface, seed) {
  for (let y = 18; y < world.height - 3; y += 1) {
    for (let x = 2; x < world.width - 2; x += 1) {
      if (y < surface[x] + 5) continue
      const broad = Math.sin((x + seed % 43) * 0.12) + Math.cos((y - seed % 29) * 0.31)
      const pocket = noise2d(x, y, seed + 991)
      if (broad + pocket * 1.4 > 1.6) setTile(world, x, y, TILE.AIR)
    }
  }
}

function scatterOres(world, surface, seed) {
  for (let y = 20; y < world.height - 4; y += 1) {
    for (let x = 2; x < world.width - 2; x += 1) {
      if (tileAt(world, x, y) !== TILE.STONE || y < surface[x] + 5) continue
      const ore = noise2d(x * 3, y * 3, seed + 404)
      if (ore > 0.9) setTile(world, x, y, TILE.CRYSTAL)
      else if (ore > 0.72) setTile(world, x, y, TILE.COAL)
    }
  }
}

function decorateSurface(world, surface, random) {
  for (let x = 4; x < world.width - 4; x += 1) {
    const y = surface[x]
    if (tileAt(world, x, y) !== TILE.GRASS) continue
    if (random() < (world.biome === 'meadow' ? 0.12 : 0.035)) setTile(world, x, y - 1, TILE.FLOWER)
    if (!['meadow', 'mountain'].includes(world.biome) || random() > 0.045) continue
    const trunk = 3 + Math.floor(random() * 3)
    if (Math.abs(surface[x - 2] - y) > 2 || Math.abs(surface[x + 2] - y) > 2) continue
    for (let i = 1; i <= trunk; i += 1) setTile(world, x, y - i, TILE.WOOD)
    const crownY = y - trunk
    for (let oy = -2; oy <= 1; oy += 1) {
      for (let ox = -3; ox <= 3; ox += 1) {
        if (Math.abs(ox) + Math.abs(oy) > 4 || (ox === 0 && oy >= 0)) continue
        if (tileAt(world, x + ox, crownY + oy) === TILE.AIR) setTile(world, x + ox, crownY + oy, TILE.LEAVES)
      }
    }
    x += 5
  }
}

function buildBiomeLandmark(world, surface, random) {
  const x = clamp(Math.floor(world.width * (0.58 + random() * 0.16)), 20, world.width - 20)
  const y = surface[x]
  if (world.biome === 'city') {
    const width = 13
    const height = 7
    for (let ox = -Math.floor(width / 2); ox <= Math.floor(width / 2); ox += 1) {
      for (let oy = 1; oy <= height; oy += 1) {
        const edge = Math.abs(ox) === Math.floor(width / 2) || oy === 1 || oy === height
        if (edge) setTile(world, x + ox, y - oy, TILE.PLANK)
      }
    }
    setTile(world, x, y - 1, TILE.SHRINE)
    setTile(world, x - 3, y - 1, TILE.TORCH)
    setTile(world, x + 3, y - 1, TILE.TORCH)
  } else if (world.biome === 'ocean') {
    for (let oy = 1; oy <= 9; oy += 1) setTile(world, x, y - oy, TILE.STONE)
    for (let ox = -2; ox <= 2; ox += 1) setTile(world, x + ox, y - 10, TILE.PLANK)
    setTile(world, x, y - 11, TILE.TORCH)
  } else if (world.biome === 'space') {
    for (let ox = -4; ox <= 4; ox += 1) setTile(world, x + ox, y - 1, TILE.STONE)
    setTile(world, x, y - 2, TILE.SHRINE)
    setTile(world, x - 3, y - 2, TILE.CRYSTAL)
    setTile(world, x + 3, y - 2, TILE.CRYSTAL)
  } else {
    setTile(world, x, y - 1, TILE.SHRINE)
    setTile(world, x - 2, y - 1, TILE.TORCH)
    setTile(world, x + 2, y - 1, TILE.TORCH)
  }
}

function sealBedrock(world) {
  for (let x = 0; x < world.width; x += 1) {
    setTile(world, x, world.height - 1, TILE.BEDROCK)
    if (x % 3 !== 0) setTile(world, x, world.height - 2, TILE.BEDROCK)
  }
}

function clearSpawn(world, x, y) {
  for (let oy = -3; oy <= 0; oy += 1) {
    for (let ox = -2; ox <= 2; ox += 1) {
      if (tileAt(world, x + ox, y + oy) !== TILE.BEDROCK) setTile(world, x + ox, y + oy, TILE.AIR)
    }
  }
}

function noise2d(x, y, seed) {
  let value = Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1442695041, 2246822519) ^ seed
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

function mulberry32(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let next = value
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}
