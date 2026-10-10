// 学習の記録（この端末の localStorage だけ）
const KEY = 'korean-ear-v1';

const fresh = () => ({
  groups: {},   // id → { seen, miss }       似た音グループの聞き分け
  rules: {},    // id → { seen, miss }       音の変化の規則
  spelling: { seen: 0, miss: 0 },          // 同じ音の綴り
  missed: [],   // 前に間違えた問題の id（正解したら外す）
  recent: [],   // 最近出した問題の id（続けて同じ問題を出さない）
  sessions: 0,
  streak: 0,
  lastDay: '',
  rate: 0.9,    // 読み上げの速さ
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* 読めないときは新しく始める */ }
  return fresh();
}

export const S = () => state;
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 容量不足など */ }
}

const bump = (map, id, miss) => {
  const r = (map[id] ||= { seen: 0, miss: 0 });
  r.seen++;
  if (miss) r.miss++;
};
export const recordGroup = (id, miss) => bump(state.groups, id, miss);
export const recordRule = (id, miss) => bump(state.rules, id, miss);
export function recordSpelling(miss) {
  state.spelling.seen++;
  if (miss) state.spelling.miss++;
}

export function markItem(id, correct) {
  state.missed = state.missed.filter((x) => x !== id);
  if (!correct) state.missed.push(id);
  state.missed = state.missed.slice(-60);
}

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function finishSession(ids) {
  state.sessions++;
  state.recent = [...ids, ...state.recent].slice(0, 30);
  const today = dayKey();
  if (state.lastDay !== today) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    state.streak = state.lastDay === dayKey(y) ? state.streak + 1 : 1;
    state.lastDay = today;
  }
  save();
}

// 今日まだやっていなくて、昨日もやっていなければ連続日数は 0 として表示
export function shownStreak() {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return state.lastDay === dayKey() || state.lastDay === dayKey(y) ? state.streak : 0;
}

// 苦手度（0〜1）。ラプラス補正つきの間違い率。まだ出していないものは 0.5
export const weakness = (r) => ((r?.miss || 0) + 1) / ((r?.seen || 0) + 2);

export function exportData() {
  return JSON.stringify({ app: 'korean-ear', v: 1, data: state });
}
export function importData(text) {
  const o = JSON.parse(text);
  if (o?.app !== 'korean-ear' || !o.data) throw new Error('このアプリのバックアップではありません');
  state = { ...fresh(), ...o.data };
  save();
}
export function resetAll() {
  state = fresh();
  save();
}
