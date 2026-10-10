// 1回分（聞き分け6問＋書き取り4問）の出題を選ぶ。苦手な音ほど出やすくする。
import { PAIRS } from './data/pairs.js';
import { DICTATION } from './data/dictation.js';
import { groupsIn } from './grader.js';
import { weakness } from './store.js';

export const PAIR_COUNT = 6;
export const DICT_COUNT = 4;
const MAX_PER_GROUP = 2;

PAIRS.forEach((p, i) => { p.id = `p:${i}`; });
const DICT_GROUPS = new Map(DICTATION.map((d) => [d.id, groupsIn(d)]));

// 重みつきで、重複なしに n 個選ぶ
function pickWeighted(items, weightOf, n, rand, ok = () => true) {
  const pool = items.map((x) => ({ x, w: weightOf(x) }));
  const out = [];
  while (out.length < n && pool.length) {
    const cand = pool.filter((p) => ok(p.x, out));
    if (!cand.length) break;
    let r = rand() * cand.reduce((s, p) => s + p.w, 0);
    let hit = cand[cand.length - 1];
    for (const p of cand) {
      r -= p.w;
      if (r <= 0) { hit = p; break; }
    }
    out.push(hit.x);
    pool.splice(pool.indexOf(hit), 1);
  }
  return out;
}

export function buildSession(state, rand = Math.random) {
  const recent = new Set(state.recent.slice(0, 20));
  const missed = new Set(state.missed);
  const fresh = (id) => (recent.has(id) ? 0.25 : 1);
  const again = (id) => (missed.has(id) ? 3 : 1);

  const pairs = pickWeighted(
    PAIRS,
    (p) => (0.15 + weakness(state.groups[p.g])) * fresh(p.id) * again(p.id),
    PAIR_COUNT,
    rand,
    (p, chosen) => chosen.filter((c) => c.g === p.g).length < MAX_PER_GROUP,
  );

  // 短い文は3回目から
  const levels = state.sessions < 2 ? [1, 2] : [1, 2, 3];
  const dict = pickWeighted(
    DICTATION.filter((d) => levels.includes(d.lv)),
    (d) => {
      const g = Math.max(0, ...DICT_GROUPS.get(d.id).map((id) => weakness(state.groups[id])));
      const r = Math.max(0, ...d.rules.map((id) => weakness(state.rules[id])));
      return (0.15 + Math.max(g, r)) * fresh(d.id) * again(d.id);
    },
    DICT_COUNT,
    rand,
  ).sort((a, b) => a.lv - b.lv);

  return [
    ...pairs.map((p) => {
      const k = Math.floor(rand() * p.words.length);
      const words = [...p.words];
      for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
      }
      return { type: 'pair', id: p.id, g: p.g, words, answer: p.words[k][0] };
    }),
    ...dict.map((d) => ({ type: 'dict', id: d.id, item: d })),
  ];
}
