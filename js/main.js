// 起動と画面の切り替え
import { S, finishSession } from './store.js';
import { buildSession } from './scheduler.js';
import * as home from './screens/home.js';
import * as pair from './screens/pair.js';
import * as dictation from './screens/dictation.js';
import * as result from './screens/result.js';

const app = document.getElementById('app');
let session = null;

// 画面の切り替えはボタンの click の中で同期的に呼ぶ（iOS の読み上げを許可されたままにするため）
export function goHome() {
  session = null;
  home.render(app, { start });
}

function start() {
  session = { questions: buildSession(S()), idx: 0, log: [] };
  showQuestion();
}

function showQuestion() {
  const q = session.questions[session.idx];
  const ctx = {
    q,
    n: session.idx + 1,
    total: session.questions.length,
    done: (entry) => session.log.push({ q, ...entry }),
    next,
    quit: goHome,
  };
  (q.type === 'pair' ? pair : dictation).render(app, ctx);
  window.scrollTo(0, 0);
}

function next() {
  session.idx++;
  if (session.idx < session.questions.length) return showQuestion();
  finishSession(session.questions.map((q) => q.id));
  result.render(app, { log: session.log, home: goHome, again: start });
  window.scrollTo(0, 0);
}

goHome();
window.__booted = true;

// オフライン用 Service Worker（localhost で開発中は ?sw を付けたときだけ）
const devHost = location.hostname === 'localhost' && !location.search.includes('sw');
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !devHost) {
  const hadOld = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 新しい版が届いたら、ホームにいるときだけ読み込み直す（問題の途中では切り替えない）
    if (hadOld && !session) location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((r) => r.update()).catch(() => {});
}
