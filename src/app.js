import './styles.css';
import { BATTERIES, analyzeBattery, drawCollectionReward, makeBriefing } from './analyzer.js';

const state = { selected: BATTERIES[0], result: null, scanning: false, collectionCount: 9, reward: null };
const app = document.querySelector('#app');

function render() {
  const analyzed = BATTERIES.map(analyzeBattery);
  app.innerHTML = `
    <main class="shell">
      <section class="hero card">
        <p class="eyebrow">Airport AI Battery Intelligence</p>
        <h1>Pocket Mine</h1>
        <p class="lead">危険なモバイルバッテリーを搭乗前に判定し、回収を「資源化」と「参加したくなる体験」に変えるプロ向けデモ。</p>
        <div class="stack">
          <span>Gemini</span><span>Cloud Vision OCR</span><span>Vertex AI</span><span>Cloud Run</span><span>Firebase</span><span>BigQuery</span>
        </div>
      </section>
      <section class="dashboard">
        <aside class="card list"><h2>Live battery queue</h2>${analyzed.map((b) => `
          <button class="battery ${b.level} ${state.selected.id === b.id ? 'active' : ''}" data-id="${b.id}">
            <strong>${b.id}</strong><span>${b.owner}</span><em>${b.verdict}</em>
          </button>`).join('')}</aside>
        <section class="card scanner">
          <div class="device ${state.scanning ? 'scanning' : ''}">
            <div class="lens"></div><div class="battery-art">▭▭▭</div><div class="scanline"></div>
          </div>
          <div><h2>${state.selected.label}</h2><p>${state.selected.condition}</p></div>
          <div class="actions"><button id="scan">AI判定を実行</button><button id="collect">回収して抽選</button></div>
          ${state.result ? resultView(state.result) : '<p class="hint">バッテリーを選択してAI判定を開始してください。</p>'}
        </section>
        <aside class="card reward"><p class="eyebrow">Collection Experience</p><h2>10人に1人のびっくら本リワード</h2>
          <div class="meter"><span style="width:${(state.collectionCount % 10) * 10}%"></span></div>
          <p>現在 ${state.collectionCount % 10}/10。危険品回収を、協力したくなる空港体験へ。</p>
          ${rewardView()}
        </aside>
      </section>
    </main>`;
  bind();
}

function resultView(r) {
  const briefing = JSON.stringify(makeBriefing(r, state.collectionCount), null, 2);
  return `<div class="result ${r.level}"><h3>${r.verdict}</h3><p>${r.action}</p><dl><dt>Wh</dt><dd>${r.capacity.wh ?? '不明'}</dd><dt>検知</dt><dd>${r.signs.join(' / ') || '異常なし'}</dd></dl><pre>${briefing}</pre></div>`;
}

function rewardView() {
  if (!state.reward) return '<p class="hint">回収ボタンでデモ抽選。10回目は必ず当たりを表示します。</p>';
  if (!state.reward.win) return `<p class="hint">あと${state.reward.remaining}回収で抽選演出。</p>`;
  return `<div class="prize"><strong>🎉 ${state.reward.prize.tier}賞 ${state.reward.prize.name}</strong><span>${state.reward.prize.message}</span></div>`;
}

function bind() {
  document.querySelectorAll('.battery').forEach((btn) => btn.addEventListener('click', () => {
    state.selected = BATTERIES.find((b) => b.id === btn.dataset.id); state.result = null; state.reward = null; render();
  }));
  document.querySelector('#scan').addEventListener('click', () => { state.scanning = true; render(); setTimeout(() => { state.result = analyzeBattery(state.selected); state.scanning = false; render(); }, 700); });
  document.querySelector('#collect').addEventListener('click', () => { state.collectionCount += 1; state.reward = drawCollectionReward(state.collectionCount, () => 0.05); render(); });
}

render();
