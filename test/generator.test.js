import test from 'node:test'
import assert from 'node:assert/strict'
import { STYLES, detectMotif, generateAscii, hashText } from '../src/generator.js'

test('recognises Japanese and English motifs', () => {
  assert.equal(detectMotif('月を見上げる黒猫'), 'cat')
  assert.equal(detectMotif('cyberpunk city in the rain'), 'city')
  assert.equal(detectMotif('星の海を泳ぐドラゴン'), 'dragon')
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

test('all visual styles produce non-empty art', () => {
  for (const style of Object.keys(STYLES)) {
    const result = generateAscii('robot in a small room', { style, width: 44, height: 18 })
    assert.ok(result.art.trim().length > 50)
  }
})

test('empty prompts fall back safely', () => {
  const result = generateAscii('', { width: 36, height: 16, style: 'unknown' })
  assert.equal(result.motif, 'abstract')
  assert.equal(result.style, 'classic')
  assert.equal(result.art.split('\n').length, 16)
})
