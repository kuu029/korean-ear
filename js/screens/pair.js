// 聞き分け: 読み上げた語をセットの中から選ぶ
import { S, save, recordGroup, markItem } from '../store.js';
import { groupById } from '../data/contrasts.js';
import { speak } from '../tts.js';
import { html, esc, $, $$, on } from '../ui.js';

export function header({ n, total }, kind) {
  return `<header class="qtop">
    <button class="icon-btn" id="quit" aria-label="やめる">✕</button>
    <div class="progress"><i style="width:${((n - 1) / total) * 100}%"></i></div>
    <span class="count">${n}/${total}</span>
  </header>
  <p class="kind">${kind}</p>`;
}

export function playButtons() {
  return `<div class="play">
    <button class="play-main" id="play" aria-label="もう一度聞く">▶</button>
    <button class="btn ghost" id="slow">ゆっくり</button>
  </div>`;
}

export function render(el, ctx) {
  const { q } = ctx;
  const s = S();
  const g = groupById[q.g];
  const say = (rate) => speak(q.answer, rate);

  html(el, `
    ${header(ctx, '聞き分け')}
    <p class="ask">聞こえたのはどれ？</p>
    ${playButtons()}
    <div class="choices n${q.words.length}">
      ${q.words.map(([w, ja]) => `<button class="choice" data-w="${esc(w)}"><span class="ko">${esc(w)}</span><span class="ja">${esc(ja)}</span></button>`).join('')}
    </div>
    <div id="after"></div>
  `);

  $(el, '#quit').addEventListener('click', ctx.quit);
  $(el, '#play').addEventListener('click', () => say(s.rate));
  $(el, '#slow').addEventListener('click', () => say(0.6));
  say(s.rate);

  let answered = false;
  on(el, '.choice', 'click', (e, btn) => {
    // 答えたあとは、ボタンを押すとその語を読み上げる（聞き比べ用）
    if (answered) { speak(btn.dataset.w, s.rate); return; }
    answered = true;
    const correct = btn.dataset.w === q.answer;
    recordGroup(q.g, !correct);
    markItem(q.id, correct);
    save();
    ctx.done({ correct, answer: btn.dataset.w });
    $(el, '.choices').classList.add('answered');
    for (const b of $$(el, '.choice')) {
      if (b.dataset.w === q.answer) b.classList.add('right');
      else if (b === btn) b.classList.add('wrong');
    }
    html($(el, '#after'), `
      <div class="feedback ${correct ? 'ok' : 'ng'}">
        <p class="verdict">${correct ? '正解！' : `正解は <span class="ko">${esc(q.answer)}</span>`}</p>
        ${correct ? '' : `<p class="tip"><b>${esc(g.label)}</b>　${esc(g.tip)}</p>`}
        <p class="muted small">語をタップすると、その音を聞き比べられます</p>
      </div>
      <button class="btn primary big" id="next">次へ</button>
    `);
    $(el, '#next').addEventListener('click', ctx.next);
  });
}
