// 書き取りの採点。字母単位で違いを出し、ミスを3種類に分ける:
//   rule     … 聞こえたとおり（発音どおり）に書いた。音の変化の規則を知らなかったミス
//   spelling … 耳では区別できない同じ音（ㅐ/ㅔ、낫/낮 など）の綴りの覚え違い
//   listen   … 聞き間違い。似た音のグループ（GROUPS）に記録する。当てはまらなければ group: null
import { toSyllables, align, finalRep, POS } from './hangul.js';
import { GROUPS, SAME_VOWELS } from './data/contrasts.js';

const sameVowel = (a, b) => SAME_VOWELS.some((s) => s.includes(a) && s.includes(b));

// pos の位置で、聞こえた音 heard と書いた音 got が属する似た音グループ
export function groupFor(pos, heard, got) {
  const norm = pos === 'f' ? finalRep : (x) => x;
  const h = norm(heard), g = norm(got);
  if (h === g) return null;
  const hit = GROUPS.find((gr) => gr.pos === pos && gr.members.includes(h) && gr.members.includes(g));
  return hit ? hit.id : null;
}

// item: { w, pron? }   answer: 回答の文字列
export function grade(item, answer) {
  const exp = toSyllables(item.w);
  const pron = toSyllables(item.pron || item.w);
  const got = toSyllables(answer);
  const ops = align(exp, got);
  const errors = [];
  for (const o of ops) {
    if (o.op === 'missing') errors.push({ kind: 'listen', group: null, i: o.i, what: 'missing' });
    else if (o.op === 'extra') errors.push({ kind: 'listen', group: null, j: o.j, what: 'extra' });
    else if (o.op === 'sub') {
      const e = exp[o.i], g = got[o.j], h = pron[o.i] || e;
      for (const pos of POS) {
        if (e[pos] === g[pos]) continue;
        const base = { i: o.i, j: o.j, pos, exp: e[pos], got: g[pos], heard: h[pos] };
        if (g[pos] === h[pos]) errors.push({ ...base, kind: 'rule' });
        else if (pos === 'v' && sameVowel(g[pos], h[pos])) errors.push({ ...base, kind: 'spelling' });
        else if (pos === 'f' && g[pos] && finalRep(g[pos]) === finalRep(h[pos])) errors.push({ ...base, kind: 'spelling' });
        else errors.push({ ...base, kind: 'listen', group: groupFor(pos, h[pos], g[pos]) });
      }
    }
  }
  return { correct: errors.length === 0 && got.length > 0, errors, ops, exp, got, pron };
}

// 書き取りの語が「どの似た音グループを含むか」（弱点に合わせて出題を重くするのに使う）
export function groupsIn(item) {
  const out = new Set();
  for (const s of toSyllables(item.pron || item.w)) {
    for (const gr of GROUPS) {
      if (gr.id === 'fl') continue; // 広すぎるので ㄹ パッチムのときだけ
      const x = gr.pos === 'f' ? finalRep(s.f) : s[gr.pos];
      if (x && gr.members.includes(x)) out.add(gr.id);
    }
    if (s.f === 'ㄹ') out.add('fl');
  }
  return [...out];
}
