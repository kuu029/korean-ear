// ホーム: 連続日数、今日の10問、苦手な音、設定
import { S, save, shownStreak, weakness, dayKey, exportData, importData, resetAll } from '../store.js';
import { GROUPS, RULES } from '../data/contrasts.js';
import { hasSpeech, hasKoreanVoice, speak, voiceName, onVoices } from '../tts.js';
import { html, esc, $, on, toast, ask } from '../ui.js';

const pct = (r) => Math.round((r.miss / r.seen) * 100);

function weakList(map, defs, label) {
  const rows = Object.entries(map)
    .filter(([id, r]) => defs[id] && r.seen >= 3 && r.miss > 0)
    .sort((a, b) => weakness(b[1]) - weakness(a[1]))
    .slice(0, 3);
  if (!rows.length) return '';
  return `<section class="card">
    <h2>${label}</h2>
    ${rows.map(([id, r]) => `<div class="weak">
      <div class="weak-head"><span class="weak-name">${esc(defs[id].label || defs[id].name)}</span><span class="muted">${pct(r)}% ミス（${r.seen}回）</span></div>
      <div class="bar"><i style="width:${Math.max(4, pct(r))}%"></i></div>
    </div>`).join('')}
  </section>`;
}

export function render(el, { start }) {
  const s = S();
  const streak = shownStreak();
  const doneToday = s.lastDay === dayKey();
  const groupDefs = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
  const ko = hasKoreanVoice();
  const noVoice = hasSpeech() && ko === false;
  if (ko === null) onVoices(() => { if (el.querySelector('#start') && !el.querySelector('.settings[open]')) render(el, { start }); });

  html(el, `
    <header class="top">
      <h1>귀트기<small>聞き分け＆書き取り</small></h1>
      <div class="streak ${streak ? 'on' : ''}" aria-label="連続日数"><b>${streak}</b><span>日連続</span></div>
    </header>

    ${!hasSpeech() ? `<section class="card warn">このブラウザは読み上げに対応していません。iPhone の Safari で開いてください。</section>` : ''}
    ${noVoice ? `<section class="card warn">韓国語の声が見つかりません。<br>iPhone の「設定 › アクセシビリティ › 読み上げコンテンツ › 声 › 韓国語」から声を追加してください。</section>` : ''}

    <section class="card hero">
      <p class="lead">${doneToday ? '今日の分はおわり。もう1セットやってもOK' : '今日の10問（約3分）'}</p>
      <button class="btn primary big" id="start">${doneToday ? 'もう1セット' : 'はじめる'}</button>
      <p class="muted small">聞き分け 6問 → 書き取り 4問</p>
    </section>

    ${weakList(s.groups, groupDefs, '苦手な音')}
    ${weakList(s.rules, RULES, '苦手な音の変化')}

    <details class="card settings">
      <summary>設定・使い方</summary>
      <div class="set-row">
        <label for="rate">読み上げの速さ</label>
        <select id="rate">
          ${[[0.7, 'ゆっくり'], [0.9, 'ふつう'], [1.05, '速め']].map(([v, l]) => `<option value="${v}" ${s.rate === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="set-row">
        <span>声のテスト${voiceName() ? `<br><small class="muted">${esc(voiceName())}</small>` : ''}</span>
        <button class="btn ghost" id="test">▶ 안녕하세요</button>
      </div>
      <div class="help">
        <p><b>韓国語キーボード</b>: 書き取りは iPhone の韓国語キーボードで入力します。まだなら「設定 › 一般 › キーボード › キーボード › 新しいキーボードを追加 › 韓国語 › 標準」で追加して、🌐 で切り替えます。</p>
        <p><b>ホーム画面に追加</b>: Safari の共有ボタン › 「ホーム画面に追加」でアプリのように使えます。</p>
        <p><b>記録</b>: 記録はこの iPhone の中だけに保存されます。機種変更の前には書き出しておいてください。</p>
      </div>
      <div class="set-row wrap">
        <button class="btn ghost" id="export">記録を書き出す</button>
        <label class="btn ghost">記録を読み込む<input type="file" id="import" accept=".json,application/json" hidden></label>
        <button class="btn ghost danger-text" id="reset">記録を消す</button>
      </div>
    </details>
  `);

  $(el, '#start').addEventListener('click', start);
  $(el, '#rate').addEventListener('change', (e) => { s.rate = Number(e.target.value); save(); });
  $(el, '#test').addEventListener('click', () => speak('안녕하세요', s.rate));
  $(el, '#export').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
    a.download = `korean-ear-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  on(el, '#import', 'change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      importData(await f.text());
      toast('記録を読み込みました');
      render(el, { start });
    } catch (err) {
      toast(err.message || '読み込めませんでした');
    }
  });
  $(el, '#reset').addEventListener('click', async () => {
    if (!(await ask('これまでの記録（苦手な音・連続日数）を全部消します。', '消す'))) return;
    resetAll();
    render(el, { start });
  });
}
