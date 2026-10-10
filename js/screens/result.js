// 1回分の結果: 点数、連続日数、今日まちがえた音
import { S, shownStreak } from '../store.js';
import { groupById, RULES } from '../data/contrasts.js';
import { speak } from '../tts.js';
import { html, esc, $, on } from '../ui.js';

export function render(el, { log, home, again }) {
  const score = log.filter((x) => x.correct).length;
  const misses = log.filter((x) => !x.correct);

  // 今日まちがえた音（似た音グループと規則）
  const tags = new Map();
  const add = (k, label) => tags.set(k, { label, n: (tags.get(k)?.n || 0) + 1 });
  for (const x of misses) {
    if (x.q.type === 'pair') add(`g:${x.q.g}`, groupById[x.q.g].label);
    else if (x.res && !x.gaveUp) {
      for (const e of x.res.errors) {
        if (e.kind === 'listen' && e.group) add(`g:${e.group}`, groupById[e.group].label);
        if (e.kind === 'spelling') add('spelling', '同じ音の綴り');
      }
      if (x.res.errors.some((e) => e.kind === 'rule')) for (const r of x.q.item.rules) add(`r:${r}`, RULES[r].name);
    }
  }

  const row = (x) => {
    if (x.q.type === 'pair') {
      return `<li><button class="say" data-say="${esc(x.q.answer)}">▶</button>
        <span>聞き分け <span class="ko">${esc(x.q.answer)}</span> を <span class="ko">${esc(x.answer)}</span> と選んだ</span></li>`;
    }
    const it = x.q.item;
    return `<li><button class="say" data-say="${esc(it.w)}">▶</button>
      <span>書き取り <span class="ko">${esc(it.w)}</span>${x.gaveUp ? '（わからない）' : ` ← <span class="ko">${esc(x.answer)}</span>`}</span></li>`;
  };

  html(el, `
    <section class="card hero">
      <p class="lead">おつかれさま！</p>
      <p class="score"><b>${score}</b> / ${log.length}</p>
      <p class="streak-line">🔥 ${shownStreak()}日連続</p>
    </section>
    ${tags.size ? `<section class="card">
      <h2>今日まちがえた音</h2>
      <div class="chips">${[...tags.values()].sort((a, b) => b.n - a.n).map((t) => `<span class="chip">${esc(t.label)}${t.n > 1 ? ` ×${t.n}` : ''}</span>`).join('')}</div>
      <p class="muted small">次回からこの音が多めに出ます</p>
    </section>` : ''}
    ${misses.length ? `<section class="card">
      <h2>まちがえた問題</h2>
      <ul class="misses">${misses.map(row).join('')}</ul>
    </section>` : `<section class="card"><p>全問正解！ 🎉</p></section>`}
    <div class="row">
      <button class="btn ghost" id="home">ホームへ</button>
      <button class="btn primary" id="again">もう1セット</button>
    </div>
  `);
  on(el, '.say', 'click', (e, b) => speak(b.dataset.say, S().rate));
  $(el, '#home').addEventListener('click', home);
  $(el, '#again').addEventListener('click', again);
}
