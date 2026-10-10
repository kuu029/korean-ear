// 書き取り: 聞いてハングルで入力 → 字母単位で採点・解説
import { S, save, recordGroup, recordRule, recordSpelling, markItem } from '../store.js';
import { groupById, RULES } from '../data/contrasts.js';
import { grade } from '../grader.js';
import { finalRep } from '../hangul.js';
import { speak } from '../tts.js';
import { html, esc, $ } from '../ui.js';
import { header, playButtons } from './pair.js';

const POS_NAME = { c: '最初の子音', v: '母音', f: 'パッチム' };
const jamo = (x) => (x ? x : 'なし');

// 回答の音節の並びに、元の空白を戻す（表示用）
function withSpaces(text, sylHtml) {
  const words = text.trim().split(/\s+/);
  const parts = [];
  let k = 0;
  for (const w of words) {
    const n = [...w.replace(/[.,!?~'"…·\-]/g, '')].length;
    parts.push(sylHtml.slice(k, k + n).join(''));
    k += n;
  }
  return parts.join(' ');
}
const markedSpaced = (text, sylls, bad) => withSpaces(text, sylls.map((s, k) => `<span class="${bad.has(k) ? 'bad' : ''}">${esc(s.ch)}</span>`));

export function explain(item, res) {
  const lines = [];
  const at = (e) => (res.exp.length > 1 ? `${e.i + 1}文字目の` : '');
  const rule = res.errors.filter((e) => e.kind === 'rule');
  if (rule.length) {
    lines.push(`<p class="ex rule"><b>発音どおりに書いています</b>聞こえ方は <span class="ko">[${esc(item.pron)}]</span>、綴りは <span class="ko">${esc(item.w)}</span>。</p>`);
    for (const r of item.rules) lines.push(`<p class="ex-sub"><b>${esc(RULES[r].name)}</b>　${esc(RULES[r].tip)}</p>`);
  }
  for (const e of res.errors.filter((x) => x.kind === 'spelling')) {
    const why = e.pos === 'v'
      ? `${e.got} と ${e.exp} は今の韓国語ではほぼ同じ音です。`
      : `パッチム ${e.got} と ${e.exp} はどちらも [${finalRep(e.exp)}] の音です。`;
    lines.push(`<p class="ex spelling"><b>同じ音の綴り違い</b>${at(e)}${POS_NAME[e.pos]}は <span class="ko">${esc(e.exp)}</span>。${esc(why)}耳では区別できないので、単語ごとに覚えましょう。</p>`);
  }
  for (const e of res.errors.filter((x) => x.kind === 'listen')) {
    if (e.what === 'missing') lines.push(`<p class="ex listen"><b>抜け</b>${e.i + 1}文字目の <span class="ko">${esc(res.exp[e.i].ch)}</span> が抜けています。</p>`);
    else if (e.what === 'extra') lines.push(`<p class="ex listen"><b>余分</b><span class="ko">${esc(res.got[e.j].ch)}</span> は要りません。</p>`);
    else {
      const g = e.group && groupById[e.group];
      lines.push(`<p class="ex listen"><b>聞き間違い</b>${at(e)}${POS_NAME[e.pos]}: <span class="ko">${esc(jamo(e.heard))}</span> を <span class="ko">${esc(jamo(e.got))}</span> と書いています。${g ? `<br><small><b>${esc(g.label)}</b>　${esc(g.tip)}</small>` : ''}</p>`);
    }
  }
  return lines.join('');
}

export function render(el, ctx) {
  const { q } = ctx;
  const item = q.item;
  const s = S();
  const say = (rate) => speak(item.w, rate);

  html(el, `
    ${header(ctx, '書き取り')}
    <p class="ask">聞こえたとおりにハングルで書こう</p>
    ${playButtons()}
    <p class="hint">意味: ${esc(item.ja)}</p>
    <form id="form" autocomplete="off">
      <input id="ans" class="answer" lang="ko" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="ここに入力" enterkeyhint="done">
      <div class="row">
        <button type="button" class="btn ghost" id="giveup">わからない</button>
        <button type="submit" class="btn primary" id="check">答え合わせ</button>
      </div>
    </form>
    <div id="after"></div>
  `);

  $(el, '#quit').addEventListener('click', ctx.quit);
  $(el, '#play').addEventListener('click', () => say(s.rate));
  $(el, '#slow').addEventListener('click', () => say(0.6));
  say(s.rate);

  const input = $(el, '#ans');
  let answered = false;

  function finish(answer, gaveUp) {
    if (answered) return;
    answered = true;
    input.blur();
    input.readOnly = true;
    const res = grade(item, answer);
    const correct = !gaveUp && res.correct;
    if (!gaveUp) {
      for (const e of res.errors) {
        if (e.kind === 'listen' && e.group) recordGroup(e.group, true);
        if (e.kind === 'spelling') recordSpelling(true);
      }
      const ruleMiss = res.errors.some((e) => e.kind === 'rule');
      for (const r of item.rules) recordRule(r, ruleMiss);
    }
    markItem(q.id, correct);
    save();
    ctx.done({ correct, answer, res, gaveUp });

    const badExp = new Set(res.errors.filter((e) => e.i >= 0 && e.i !== undefined).map((e) => e.i));
    const badGot = new Set(res.errors.filter((e) => e.j >= 0 && e.j !== undefined).map((e) => e.j));
    $(el, '#form .row').remove();
    html($(el, '#after'), `
      <div class="feedback ${correct ? 'ok' : 'ng'}">
        <p class="verdict">${correct ? '正解！' : gaveUp ? '正解はこれ' : 'おしい！'}</p>
        <p class="big-ko">${gaveUp || correct ? esc(item.w) : markedSpaced(item.w, res.exp, badExp)}</p>
        ${item.pron !== item.w ? `<p class="pron">発音 <span class="ko">[${esc(item.pron)}]</span></p>` : ''}
        ${!correct && !gaveUp && res.got.length ? `<p class="yours">あなた: <span class="ko">${markedSpaced(answer, res.got, badGot)}</span></p>` : ''}
        ${correct || gaveUp ? (item.rules.length ? item.rules.map((r) => `<p class="ex-sub"><b>${esc(RULES[r].name)}</b>　${esc(RULES[r].tip)}</p>`).join('') : '') : explain(item, res)}
        <button class="btn ghost small-btn" id="again">▶ もう一度聞く</button>
      </div>
      <button class="btn primary big" id="next">次へ</button>
    `);
    $(el, '#again').addEventListener('click', () => say(s.rate));
    $(el, '#next').addEventListener('click', ctx.next);
  }

  $(el, '#form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (answered) return;
    if (!input.value.trim()) { input.focus(); return; }
    finish(input.value, false);
  });
  $(el, '#giveup').addEventListener('click', () => finish('', true));
}
