import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGeminiPrompt,
  calculateWattHours,
  classifyBattery,
  evaluateFlightQuery,
  makeUploadedBattery,
  parseBatteryLabel,
} from '../src/analyzer.js'

test('converts mAh and voltage into watt hours', () => {
  assert.equal(calculateWattHours({ mah: 20000, voltage: 3.7 }), 74)
  assert.equal(calculateWattHours({ mah: 26800, voltage: 3.7 }), 99.2)
  assert.equal(calculateWattHours({ mah: null, voltage: 3.7 }), null)
})

test('parses explicit Wh before calculated capacity', () => {
  const label = parseBatteryLabel('30000mAh 3.7V 111Wh')
  assert.equal(label.wh, 111)
  assert.equal(label.mah, 30000)
  assert.equal(label.voltage, 3.7)
  assert.equal(label.hasCapacity, true)
})

test('classifies normal, review, and isolation cases', () => {
  assert.equal(classifyBattery({ labelText: '20000mAh 3.7V', signals: [], shape: 'slim' }).decision, 'carry')
  assert.equal(classifyBattery({ labelText: '30000mAh 3.7V 111Wh', signals: [], shape: 'large' }).decision, 'review')
  assert.equal(classifyBattery({ labelText: '50000mAh 3.7V 185Wh', signals: [], shape: 'brick' }).decision, 'isolate')
  assert.equal(classifyBattery({ labelText: '26800mAh 3.7V 99Wh', signals: ['swelling'], shape: 'swollen' }).decision, 'isolate')
})

test('exposes the final three airport decisions in presentation copy', () => {
  assert.equal(classifyBattery({ labelText: '10000mAh 3.7V', signals: [], shape: 'slim' }).decisionLabel, 'CLEAR TO FLY')
  assert.equal(classifyBattery({ labelText: '30000mAh 3.7V 111Wh', signals: [], shape: 'large' }).decisionLabel, 'NEEDS HUMAN CHECK')
  assert.equal(classifyBattery({ labelText: '50000mAh 3.7V 185Wh', signals: [], shape: 'brick' }).decisionLabel, 'DO NOT BOARD')
})

test('missing capacity stays in manual review', () => {
  const result = classifyBattery({ labelText: 'Li-ion power bank label damaged', signals: ['label'], shape: 'scratched' })
  assert.equal(result.decision, 'review')
  assert.equal(result.label.hasCapacity, false)
})

test('breaks risk into evidence factors', () => {
  const result = classifyBattery({ labelText: 'Li-ion power bank label damaged', signals: ['label'], shape: 'scratched' })
  assert.deepEqual(
    result.factors.map((factor) => [factor.label, factor.value]),
    [
      ['Damage', 'Medium'],
      ['Swelling', 'Low'],
      ['Heat', 'Low'],
      ['Wh Limit', 'Unknown'],
      ['Label', 'Unreadable'],
    ],
  )
})

test('uploaded helper infers damage hints from label text', () => {
  const uploaded = makeUploadedBattery({ labelText: '膨張 burn 20000mAh 3.7V', dataUrl: 'data:image/png;base64,test' })
  assert.deepEqual(uploaded.signals.sort(), ['heat', 'swelling'])
  assert.equal(uploaded.shape, 'uploaded')
})

test('Gemini prompt demands strict JSON and fixed decisions', () => {
  const prompt = buildGeminiPrompt('10000mAh 3.7V')
  assert.match(prompt, /strict JSON/)
  assert.match(prompt, /carry, review, isolate/)
  assert.match(prompt, /10000mAh/)
})

test('Can it fly search handles capacity, appearance, and spare battery placement', () => {
  assert.equal(evaluateFlightQuery({ wh: 74, appearance: 'clean', isSpare: true, bag: 'carry-on' }).answer, 'YES')
  assert.equal(evaluateFlightQuery({ wh: 111, appearance: 'clean', isSpare: true, bag: 'carry-on' }).answer, 'CHECK')
  assert.equal(evaluateFlightQuery({ wh: 185, appearance: 'clean', isSpare: true, bag: 'carry-on' }).answer, 'NO')
  assert.equal(evaluateFlightQuery({ wh: 74, appearance: 'swollen', isSpare: false, bag: 'carry-on' }).answer, 'NO')
  assert.equal(evaluateFlightQuery({ wh: 74, appearance: 'clean', isSpare: true, bag: 'checked' }).decision, 'review')
})
