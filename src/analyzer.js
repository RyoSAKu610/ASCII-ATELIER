export const BATTERIES = [
  { id: 'A12', owner: 'Gate 18', label: '10000mAh 3.7V', condition: 'clean label / no deformation', collected: false },
  { id: 'B07', owner: 'Intl transfer', label: '26800mAh 3.7V', condition: 'scratched shell / warm', collected: false },
  { id: 'C31', owner: 'Security lane 4', label: 'No label', condition: 'swollen corner / dented', collected: true },
  { id: 'D44', owner: 'Crew desk', label: '5000mAh 5V', condition: 'normal', collected: false },
  { id: 'E90', owner: 'Lost & found', label: '32000mAh 3.7V', condition: 'burn mark / cracked case', collected: true },
];

export const PRIZES = [
  { tier: 'S', name: 'Rare Earth Recovery Pass', message: 'リサイクル資源トークンを付与。協力者向けに特別な感謝演出を表示します。' },
  { tier: 'A', name: 'Green Boarding Badge', message: '空港サステナビリティ施策への参加バッジを発行します。' },
  { tier: 'B', name: 'Coffee Coupon Mock', message: 'デモ用クーポンを表示。実運用では提携店舗やマイルに接続できます。' },
];

export function parseCapacity(label = '') {
  const mah = label.match(/(\d{4,6})\s*mAh/i)?.[1];
  const volt = label.match(/(\d+(?:\.\d+)?)\s*V/i)?.[1];
  if (!mah || !volt) return { mah: null, volt: null, wh: null };
  const wh = (Number(mah) * Number(volt)) / 1000;
  return { mah: Number(mah), volt: Number(volt), wh: Number(wh.toFixed(1)) };
}

export function analyzeBattery(battery) {
  const text = `${battery.label} ${battery.condition}`.toLowerCase();
  const capacity = parseCapacity(battery.label);
  const signs = [];
  if (/swollen|膨張/.test(text)) signs.push('膨張');
  if (/burn|焦げ/.test(text)) signs.push('焦げ跡');
  if (/crack|割れ/.test(text)) signs.push('外装割れ');
  if (/dent|へこみ/.test(text)) signs.push('強いへこみ');
  if (/warm|熱/.test(text)) signs.push('発熱');
  if (/no label|unlabeled|ラベルなし/.test(text)) signs.push('ラベル不明');

  let verdict = '持ち込み可能';
  let level = 'safe';
  let action = '通常レーンへ戻す';
  if ((capacity.wh && capacity.wh > 100) || signs.includes('発熱') || signs.includes('ラベル不明')) {
    verdict = '確認が必要';
    level = 'review';
    action = '係員確認・航空会社ルール照合';
  }
  if (signs.some((s) => ['膨張', '焦げ跡', '外装割れ'].includes(s))) {
    verdict = '今すぐ隔離';
    level = 'isolate';
    action = '耐火ボックスへ回収し、資源化トレーサビリティを開始';
  }
  return { ...battery, capacity, signs, verdict, level, action };
}

export function drawCollectionReward(collectionCount, rng = Math.random) {
  const isWinner = collectionCount > 0 && collectionCount % 10 === 0;
  if (!isWinner) return { win: false, progress: collectionCount % 10, remaining: 10 - (collectionCount % 10) };
  const prize = PRIZES[Math.floor(rng() * PRIZES.length)] ?? PRIZES[0];
  return { win: true, progress: 10, remaining: 0, prize };
}

export function makeBriefing(result, collectionCount = 0) {
  const reward = drawCollectionReward(collectionCount, () => 0.2);
  return {
    flightSafety: result.verdict,
    wh: result.capacity.wh ?? 'unknown',
    riskSignals: result.signs,
    nextAction: result.action,
    collectionReward: reward.win ? `${reward.prize.tier}: ${reward.prize.name}` : `${reward.remaining}回収で次の抽選`,
  };
}
