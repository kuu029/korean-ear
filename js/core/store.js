// 保存データ（この端末の localStorage のみ。外部へは一切送らない）
const KEY = 'brain-escape-save';
export const APP_ID = 'brain-escape';
export const VERSION = 1;

let storage = null;
let state = null;
let timer = null;

export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);

export function blank() {
  return {
    app: APP_ID,
    version: VERSION,
    created: Date.now(),
    nickname: '',
    onboarded: false,
    storySeen: false,
    settings: { sound: true, autoBuild: false, fxFast: false },
    units: {},
    reviewQueue: [],
    log: {},
    sessions: [],
    exams: [], // 模試の記録
    examDraft: null, // とちゅうの模試（アプリを閉じても続きから）
    memory: { cards: {}, mode: {}, day: null, course: 'standard', decks: {} }, // 暗号室（暗記）
    mistakes: [],
    streak: { count: 0, best: 0, last: null },
    gems: 0,
    collection: { cards: {}, skins: ['default'], skin: 'default', shards: 0 },
    tools: [],
    missions: { date: null, list: [] },
    diagnosis: { done: false, at: null, results: {} },
    diagnosisEn: { done: false, at: null, results: {} },
    stats: { correct: 0, asked: 0, bestCombo: 0, waves: 0, bosses: 0 },
  };
}

// 古い形式や欠けた項目を補う
function migrate(d) {
  const b = blank();
  const out = { ...b, ...d };
  for (const k of ['settings', 'streak', 'collection', 'missions', 'diagnosis', 'diagnosisEn', 'stats', 'memory']) out[k] = { ...b[k], ...(d[k] || {}) };
  out.version = VERSION;
  return out;
}

export function init(st = globalThis.localStorage) {
  storage = st;
  try {
    const raw = storage?.getItem(KEY);
    state = raw ? migrate(JSON.parse(raw)) : blank();
  } catch {
    state = blank();
  }
  return state;
}
export const S = () => state;

export function saveNow() {
  clearTimeout(timer);
  timer = null;
  try {
    storage?.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
export function save() {
  if (timer) return;
  timer = setTimeout(saveNow, 400);
}

export function unitState(id) {
  if (!state.units[id]) state.units[id] = { lessons: {}, trainingDone: false, practiced: 0, bossCleared: false, diagPassed: false, recent: [] };
  return state.units[id];
}

export function dayLog(date = today()) {
  if (!state.log[date]) state.log[date] = { seconds: 0, byUnit: {} };
  return state.log[date];
}
// 2時間ごとの枠の番号（0〜11。6〜8時なら 3）: 2時間ボーナス用に、勉強時間を枠ごとにも数える
export const slotOf = (d = new Date()) => Math.floor(d.getHours() / 2);
// n がマイナスのときは取り消し（放置していたぶんを引く）
export function addSeconds(n) {
  if (!state || !n) return;
  const lg = dayLog();
  lg.seconds = Math.max(0, lg.seconds + n);
  const sl = slotOf();
  lg.slots ||= {};
  lg.slots[sl] = Math.max(0, (lg.slots[sl] || 0) + n);
  if (active) active.seconds = Math.max(0, active.seconds + n);
  save();
}

// 挑戦の記録（ウェーブ1回・訓練1回ごと）。始めた時点で「中断」として残し、終わったら結果を書く
// info: { kind: 'practice'|'boss'|'review'|'diagnosis'|'training', subject, unit, lesson }
let active = null;
export function beginSession(info) {
  closeSession();
  if (!Array.isArray(state.sessions)) state.sessions = [];
  active = { at: Date.now(), date: today(), ...info, asked: 0, correct: 0, seconds: 0, result: 'quit' };
  state.sessions.push(active);
  if (state.sessions.length > 300) state.sessions.shift();
  save();
  return active;
}
// 1問の結果（最初の1回の答えだけ数える）
export function tallySession(correct) {
  if (!active) return;
  active.asked++;
  if (correct) active.correct++;
}
// result: 'win' | 'lose' | 'clear' | 'quit' | 'idle'
export function closeSession(result) {
  if (!active) return;
  if (result) active.result = result;
  // 1問も解かずにやめたものは残さない
  const at = state.sessions.indexOf(active);
  if (active.result === 'quit' && active.asked === 0 && active.seconds < 30 && at >= 0) state.sessions.splice(at, 1);
  active = null;
  save();
}

// 連続プレイ日数（問題を1問でも解いた日をカウント）
export function touchStreak() {
  const t = today();
  const s = state.streak;
  if (s.last === t) return;
  s.count = s.last && dayDiff(s.last, t) === 1 ? s.count + 1 : 1;
  s.best = Math.max(s.best || 0, s.count);
  s.last = t;
}
export function streakAlive() {
  const s = state.streak;
  if (!s.last) return 0;
  return dayDiff(s.last, today()) <= 1 ? s.count : 0;
}

// 1回の解答を記録。review: 復習キューから出た問題か
export function recordAnswer({ unit, generatorId, seed, correct, firstTry, review = false, noReview = false }) {
  touchStreak();
  if (firstTry) {
    tallySession(correct);
    const lg = dayLog();
    const bu = (lg.byUnit[unit] ||= { asked: 0, correct: 0 });
    bu.asked++;
    if (correct) bu.correct++;
    state.stats.asked++;
    if (correct) state.stats.correct++;
    const us = unitState(unit);
    us.recent.push(correct ? 1 : 0);
    if (us.recent.length > 20) us.recent.shift();
  }
  const qi = state.reviewQueue.findIndex((r) => r.generatorId === generatorId && r.seed === seed);
  if (review && qi >= 0 && firstTry) {
    const r = state.reviewQueue[qi];
    if (correct) {
      r.need--;
      if (r.need <= 0) state.reviewQueue.splice(qi, 1);
    } else r.need = 2;
  } else if (!correct && firstTry && qi < 0 && !noReview) {
    state.reviewQueue.push({ generatorId, seed, unit, need: 2, added: today() });
    if (state.reviewQueue.length > 60) state.reviewQueue.shift();
  }
  if (!correct && firstTry) {
    state.mistakes.push({ date: today(), unit, generatorId, seed });
    if (state.mistakes.length > 200) state.mistakes.shift();
  }
  save();
}

// 理解度: new（未着手）/ trained（訓練済み）/ practicing（演習中）/ mastered（定着）
export function mastery(id) {
  const u = state.units[id];
  if (!u) return 'new';
  const r = u.recent || [];
  const acc = r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
  if (u.bossCleared && r.length >= 10 && acc >= 0.8) return 'mastered';
  if (u.practiced > 0) return 'practicing';
  if (u.trainingDone || u.diagPassed || Object.keys(u.lessons || {}).length) return 'trained';
  return 'new';
}
export const MASTERY_LABEL = { new: '未着手', trained: '訓練済み', practicing: '演習中', mastered: '定着' };
export const cleared = (id) => !!(state.units[id] && (state.units[id].bossCleared || state.units[id].diagPassed));

// ---------- バックアップ ----------
export function exportText() {
  saveNow();
  // ごほうびの合言葉はバックアップに入れない（弟さんが文字のバックアップから読めてしまうので）
  const data = { ...state, settings: { ...state.settings, unlockSecret: undefined } };
  return JSON.stringify({ app: APP_ID, kind: 'backup', exportedAt: new Date().toISOString(), data });
}
export function importText(text) {
  let obj;
  try {
    obj = JSON.parse(String(text).trim());
  } catch {
    return { ok: false, error: 'バックアップの文字列が読めませんでした（コピーが途中で切れていない？）' };
  }
  const data = obj && obj.kind === 'backup' ? obj.data : obj;
  if (!data || data.app !== APP_ID || typeof data.units !== 'object' || typeof data.log !== 'object') {
    return { ok: false, error: 'このアプリのバックアップではないみたい。' };
  }
  if (data.version > VERSION) return { ok: false, error: '新しいバージョンのアプリで作ったバックアップです。' };
  const secret = state?.settings?.unlockSecret; // 合言葉は、いまの端末のものをそのまま使う
  state = migrate(data);
  if (secret) state.settings.unlockSecret = secret;
  saveNow();
  return { ok: true };
}
export function resetAll() {
  state = blank();
  saveNow();
}
