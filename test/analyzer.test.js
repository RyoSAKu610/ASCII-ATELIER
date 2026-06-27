import { describe, expect, it } from 'vitest';
import { analyzeBattery, drawCollectionReward, parseCapacity } from '../src/analyzer.js';

describe('Pocket Mine analyzer', () => {
  it('converts mAh and volts into watt hours', () => {
    expect(parseCapacity('10000mAh 3.7V')).toEqual({ mah: 10000, volt: 3.7, wh: 37 });
  });

  it('isolates visibly damaged batteries', () => {
    const result = analyzeBattery({ id: 'X', label: '10000mAh 3.7V', condition: 'swollen with burn mark' });
    expect(result.verdict).toBe('今すぐ隔離');
    expect(result.signs).toContain('膨張');
  });

  it('awards a prize on every tenth collection', () => {
    const reward = drawCollectionReward(10, () => 0);
    expect(reward.win).toBe(true);
    expect(reward.prize.tier).toBe('S');
  });
});
