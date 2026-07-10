import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PLACEABLES,
  TILE,
  TILE_INFO,
  biomeForMotif,
  craftItem,
  createPlayer,
  defaultInventory,
  findSpawnY,
  generateWorld,
  isSolid,
  mineTile,
  placeTile,
  restoreWorldState,
  serializeWorldState,
  setTile,
  tileAt,
} from '../src/world.js'

test('world generation is deterministic for the same prompt and biome', () => {
  const first = generateWorld('月を見上げる黒猫', 'city', 96, 48)
  const second = generateWorld('月を見上げる黒猫', 'city', 96, 48)
  assert.equal(first.seed, second.seed)
  assert.deepEqual(first.tiles, second.tiles)
  assert.deepEqual(first.spawn, second.spawn)
})

test('different seeds create meaningfully different terrain', () => {
  const first = generateWorld('forest one', 'meadow', 96, 48)
  const second = generateWorld('forest two', 'meadow', 96, 48)
  const changed = first.tiles.filter((tile, index) => tile !== second.tiles[index]).length
  assert.ok(changed > first.tiles.length * 0.08)
})

test('generated worlds contain only registered tiles and a safe spawn', () => {
  for (const biome of ['meadow', 'mountain', 'ocean', 'city', 'space']) {
    const world = generateWorld(`safe-${biome}`, biome, 88, 46)
    assert.equal(world.tiles.length, world.width * world.height)
    assert.ok(world.tiles.every((tile) => TILE_INFO[tile]))
    assert.equal(findSpawnY(world, world.spawn.x), world.spawn.y)
    assert.equal(isSolid(world, world.spawn.x, world.spawn.y), false)
    assert.equal(isSolid(world, world.spawn.x, world.spawn.y + 1), true)
    assert.equal(tileAt(world, world.spawn.x, world.height - 1), TILE.BEDROCK)
  }
})

test('motifs map to distinct ASCII biomes', () => {
  assert.equal(biomeForMotif('city'), 'city')
  assert.equal(biomeForMotif('ocean'), 'ocean')
  assert.equal(biomeForMotif('space'), 'space')
  assert.equal(biomeForMotif('dragon'), 'mountain')
  assert.equal(biomeForMotif('abstract'), 'meadow')
})

test('mining changes a tile and adds its drop', () => {
  const world = generateWorld('mine-test', 'meadow', 64, 40)
  const inventory = defaultInventory()
  const x = 20
  const y = 20
  setTile(world, x, y, TILE.STONE)
  const before = inventory.stone
  const result = mineTile(world, x, y, inventory)
  assert.equal(result.ok, true)
  assert.equal(tileAt(world, x, y), TILE.AIR)
  assert.equal(inventory.stone, before + 1)
  assert.equal(mineTile(world, x, y, inventory).ok, false)
})

test('placement consumes inventory and rejects occupied or floating cells', () => {
  const world = generateWorld('place-test', 'meadow', 64, 40)
  const inventory = { ...defaultInventory(), stone: 2 }
  const x = 18
  const y = 12
  setTile(world, x, y + 1, TILE.SOIL)
  setTile(world, x, y, TILE.AIR)
  const placed = placeTile(world, x, y, TILE.STONE, inventory, [])
  assert.equal(placed.ok, true)
  assert.equal(tileAt(world, x, y), TILE.STONE)
  assert.equal(inventory.stone, 1)
  assert.equal(placeTile(world, x, y, TILE.STONE, inventory, []).reason, 'occupied')

  setTile(world, x + 8, y - 6, TILE.AIR)
  assert.equal(placeTile(world, x + 8, y - 6, TILE.STONE, inventory, []).reason, 'floating')
})

test('placement cannot overwrite the player cell', () => {
  const world = generateWorld('player-space', 'meadow', 64, 40)
  const inventory = { ...defaultInventory(), soil: 2 }
  const x = world.spawn.x
  const y = world.spawn.y
  setTile(world, x, y, TILE.AIR)
  setTile(world, x, y + 1, TILE.SOIL)
  const result = placeTile(world, x, y, TILE.SOIL, inventory, [{ x, y }])
  assert.equal(result.ok, false)
  assert.equal(result.reason, 'player-space')
  assert.equal(inventory.soil, 2)
})

test('crafting applies costs and output atomically', () => {
  const inventory = { ...defaultInventory(), wood: 2, coal: 1, torch: 0 }
  const crafted = craftItem('torch', inventory)
  assert.deepEqual(crafted, { ok: true, item: 'torch', count: 3 })
  assert.equal(inventory.wood, 1)
  assert.equal(inventory.coal, 0)
  assert.equal(inventory.torch, 3)
  const snapshot = { ...inventory }
  assert.equal(craftItem('torch', inventory).ok, false)
  assert.deepEqual(inventory, snapshot)
})

test('world save round-trips and rejects damaged data', () => {
  const world = generateWorld('save-test', 'space', 72, 42)
  const player = createPlayer(world)
  const inventory = defaultInventory()
  const serialized = serializeWorldState({
    world,
    player,
    inventory,
    selected: PLACEABLES[1].item,
    mode: 'place',
    time: 44,
    discoveries: ['echo-crystal'],
    stats: { minedCount: 7, placedCount: 3 },
  })
  const restored = restoreWorldState(serialized)
  assert.ok(restored)
  assert.deepEqual(restored.world.tiles, world.tiles)
  assert.deepEqual(restored.player, player)
  assert.equal(restored.mode, 'place')
  assert.equal(restored.time, 44)
  assert.deepEqual(restored.stats, { minedCount: 7, placedCount: 3 })
  assert.equal(restoreWorldState('not-json'), null)

  const damaged = JSON.parse(serialized)
  damaged.world.tiles.pop()
  assert.equal(restoreWorldState(damaged), null)

  const invalidBiome = JSON.parse(serialized)
  invalidBiome.world.biome = 'unknown'
  assert.equal(restoreWorldState(invalidBiome), null)

  const invalidPlayer = JSON.parse(serialized)
  invalidPlayer.player.x = Number.POSITIVE_INFINITY
  assert.equal(restoreWorldState(invalidPlayer), null)

  const invalidInventory = JSON.parse(serialized)
  invalidInventory.inventory.soil = -1
  assert.equal(restoreWorldState(invalidInventory), null)

  const legacyV1 = JSON.parse(serialized)
  delete legacyV1.stats
  assert.deepEqual(restoreWorldState(legacyV1).stats, { minedCount: 0, placedCount: 0 })
})
