import test from 'node:test'
import assert from 'node:assert/strict'
import { STYLES, detectMotif, generateAscii, hashText } from '../src/generator.js'
import { MASTERPIECE_TRAIL, getTrailEntry, makeInfiniteSamples, makeSamplePrompt, randomTrailIndex } from '../src/inspirations.js'

test('recognises Japanese and English motifs', () => {
  assert.equal(detectMotif('月を見上げる黒猫'), 'cat')
  assert.equal(detectMotif('cyberpunk city in the rain'), 'city')
  assert.equal(detectMotif('星の海を泳ぐドラゴン'), 'dragon')
  assert.equal(detectMotif('崩れた見張り塔を横長の端末スクリーンで'), 'city')
  assert.equal(detectMotif('深海の灯台と泡だけが見える潜水艇'), 'ocean')
})

test('hash and generation are deterministic for the same input', () => {
  assert.equal(hashText('ASCII ATELIER'), hashText('ASCII ATELIER'))
  const first = generateAscii('雨の東京をネオン調で')
  const second = generateAscii('雨の東京をネオン調で')
  assert.equal(first.art, second.art)
  assert.equal(first.seed, second.seed)
})

test('generates the requested canvas bounds', () => {
  const result = generateAscii('山の上の小屋', { width: 48, height: 20 })
  const lines = result.art.split('\n')
  assert.equal(lines.length, 20)
  assert.ok(lines.every((line) => line.length <= 48))
})

test('prioritises recognisable structure glyphs', () => {
  const cat = generateAscii('月を見上げる黒猫', { width: 72, height: 30, craft: 95 })
  assert.match(cat.art, /[()\/\\|_^o]/)
  assert.ok(cat.craftNotes.some((note) => note.includes('whiskers') || note.includes('structure')))
})

test('all visual styles produce non-empty art', () => {
  for (const style of Object.keys(STYLES)) {
    const result = generateAscii('robot in a small room', { style, width: 44, height: 18 })
    assert.ok(result.art.trim().length > 50)
  }
})

test('empty prompts fall back safely', () => {
  const result = generateAscii('', { width: 36, height: 16, style: 'unknown' })
  assert.equal(result.motif, 'abstract')
  assert.equal(result.style, 'etch')
  assert.equal(result.art.split('\n').length, 16)
})

test('masterpiece trail carries sourced study cards without embedded artwork', () => {
  assert.ok(MASTERPIECE_TRAIL.length >= 12)
  assert.ok(MASTERPIECE_TRAIL.some((entry) => /1st|won|winner/i.test(entry.rank)))
  for (const entry of MASTERPIECE_TRAIL) {
    assert.match(entry.sourceUrl, /^https:\/\//)
    assert.ok(entry.lesson.length > 24)
    assert.ok(entry.subjects.length >= 4)
    assert.ok(!entry.lesson.includes('\n'))
  }
})

test('infinite prompt sampler produces varied reusable prompts', () => {
  const first = makeSamplePrompt(100, getTrailEntry(0))
  const second = makeSamplePrompt(101, getTrailEntry(0))
  const batch = makeInfiniteSamples(4, 200, getTrailEntry(2))
  assert.notEqual(first.prompt, second.prompt)
  assert.equal(batch.length, 4)
  assert.equal(new Set(batch.map((sample) => sample.prompt)).size, 4)
  assert.ok(Object.keys(STYLES).includes(first.options.style))
  assert.ok(first.options.width >= 32)
  assert.ok(first.options.height >= 14)
})

test('trail randomizer avoids the current card when possible', () => {
  const next = randomTrailIndex(12345, 0)
  assert.notEqual(next, 0)
  assert.equal(getTrailEntry(next), MASTERPIECE_TRAIL[next])
})
