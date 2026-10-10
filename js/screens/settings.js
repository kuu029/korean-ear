// 設定: 音、ニックネーム、バックアップ（ファイル/文字列）、データ初期化
import { h, btn, modal, toast, confirmBox } from '../core/ui.js';
import { S, save, exportText, importText, resetAll, today } from '../core/store.js';
import { go } from '../core/router.js';
import { refreshBgm } from '../core/bgm.js';
import { topBar } from './home.js';

// アプリの版: このスマホに入っている版と、サーバー（GitHub）の最新の版をくらべる
function versionBox() {
  const box = h('div', { class: 'ver-box' }, h('p', { class: 'note' }, '確認中…'));
  (async () => {
    let local = null;
    let missing = [];
    let server = null;
    try {
      const keys = (await caches.keys()).filter((k) => k.startsWith('brain-escape-'));
      local = keys.map((k) => k.replace('brain-escape-', '')).join(', ') || null;
      const r = await caches.match('__missing.json');
      if (r) missing = (await r.json()).missing || [];
    } catch { /* キャッシュが使えない */ }
    try {
      const t = await (await fetch(`./sw.js?t=${Date.now()}`, { cache: 'no-store' })).text();
      server = (t.match(/const VERSION = '([^']+)'/) || [])[1] || null;
    } catch { /* オフライン */ }
    const same = local && server && local.split(', ').includes(server);
    box.replaceChildren(...[
      h('p', { class: 'note' }, `このスマホの版: ${local || '（なし）'}　／　サーバーの最新: ${server || '（オフラインで確認できない）'}`),
      server && h('p', { class: `note ${same ? '' : 'warn-text'}` }, same ? '✅ 最新の版です。' : '⚠️ 新しい版があります。下の「最新版にする」を押してね。'),
      missing.length > 0 && h('p', { class: 'note warn-text' }, `⚠️ サーバーに見つからないファイルがあります（アップロードもれ・フォルダちがいかも）: ${missing.map((u) => u.replace(/^\.\//, '')).join('、')}`),
    ].filter(Boolean));
  })();
  return box;
}
// ごほうびの合言葉: 入れるときだけ見える。保存したあとは「設定ずみ」とだけ出す
function unlockBox(s) {
  const box = h('div', { class: 'up-btns' });
  const paint = () => {
    box.replaceChildren(s.settings.unlockSecret
      ? h('p', { class: 'note' }, '✅ 合言葉は設定ずみ（変えると、ショートカットの合言葉も変える必要がある）')
      : h('p', { class: 'note warn-text' }, 'まだ設定されていない（設定するまでは、これまでどおり「おうちの人に見せる」方式）'),
    btn(s.settings.unlockSecret ? '合言葉を変える' : '合言葉を設定する', async () => {
      const inp = h('input', { class: 'mr-input', type: 'password', autocomplete: 'off', placeholder: '8文字以上（英数字）' });
      const ok = await modal({ title: '🔐 合言葉', body: h('div', { class: 'modal-body' }, h('p', { class: 'note' }, '弟さんに見られないように入れてください。ショートカットにも同じ合言葉を入れます。'), inp), buttons: [{ label: 'やめる', value: false }, { label: '保存', value: true, cls: 'primary' }] });
      if (!ok) return;
      const v = inp.value.trim();
      if (v.length < 8 || !/^[A-Za-z0-9]+$/.test(v)) return toast('英数字8文字以上にしてね', 2200);
      s.settings.unlockSecret = v;
      save();
      toast('合言葉を保存した');
      paint();
    }, 'ghost'));
  };
  paint();
  return box;
}

// 最新版にする: キャッシュとオフライン用の仕組みを消して、サーバーから読みこみ直す（勉強の記録は消えない）
async function forceUpdate() {
  if (!(await confirmBox('最新版にする', 'アプリのファイルをサーバーから読みこみ直します。勉強の記録・💎・コレクションは消えません。', '読みこみ直す', 'やめる'))) return;
  try {
    for (const r of await navigator.serviceWorker?.getRegistrations?.() || []) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  } catch { /* そのまま読みこみ直す */ }
  location.replace(`./?v=${Date.now()}`);
}

async function saveFile() {
  const text = exportText();
  const name = `brain-escape-backup-${today()}.json`;
  const file = new File([text], name, { type: 'application/json' });
  // iPhone は共有シート →「"ファイル"に保存」が確実
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'ブレイン脱獄 バックアップ' });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copyText() {
  const text = exportText();
  try {
    await navigator.clipboard.writeText(text);
    toast('コピーした！ メモアプリなどに貼りつけて保存してね', 2600);
  } catch {
    const ta = h('textarea', { class: 'backup-text', readonly: true });
    ta.value = text;
    await modal({ title: 'この文字を全部コピーして保存', body: h('div', {}, ta, h('p', { class: 'note' }, '長押し →「すべてを選択」→「コピー」')) });
  }
}

async function restore(text) {
  const ok = await confirmBox('バックアップから復元する？', 'いまのデータは上書きされるよ。', '復元する', 'やめる', true);
  if (!ok) return;
  const r = importText(text);
  if (r.ok) {
    await modal({ title: '復元できた！', body: `おかえり、${S().nickname}。` });
    go('home');
  } else modal({ title: '復元できなかった', body: r.error });
}

export function render(el) {
  const s = S();
  const sound = h('button', { class: `toggle ${s.settings.sound ? 'on' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(!!s.settings.sound), onclick: () => { s.settings.sound = !s.settings.sound; save(); go('settings'); } }, s.settings.sound ? '🔊 ON' : '🔇 OFF');
  const fileIn = h('input', { type: 'file', accept: '.json,application/json,text/plain', class: 'hidden' });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0];
    if (f) restore(await f.text());
    fileIn.value = '';
  });
  const pasteBox = async () => {
    const ta = h('textarea', { class: 'backup-text', placeholder: 'ここにバックアップの文字を貼りつけ' });
    const v = await modal({ title: '文字から復元', body: h('div', {}, ta), buttons: [{ label: 'やめる', value: null }, { label: '復元', value: 'go', cls: 'primary' }] });
    if (v === 'go') restore(ta.value);
  };
  const rename = async () => {
    const inp = h('input', { class: 'name-input', type: 'text', maxlength: '10' });
    inp.value = s.nickname;
    const v = await modal({ title: 'ニックネーム変更', body: h('div', {}, inp), buttons: [{ label: 'やめる', value: null }, { label: '決定', value: 'ok', cls: 'primary' }] });
    if (v === 'ok' && inp.value.trim()) { s.nickname = inp.value.trim().slice(0, 10); save(); go('settings'); }
  };
  const reset = async () => {
    if (!(await confirmBox('データを全部消す？', 'カード・記録・進み具合が全部消えるよ。先にバックアップをおすすめ。', '消す', 'やめる', true))) return;
    if (!(await confirmBox('ほんとうに？', 'もとに戻せません。', 'ほんとうに消す', 'やめる', true))) return;
    resetAll();
    go('onboarding', { step: 'title' });
  };

  el.append(topBar(() => go('home')),
    h('div', { class: 'settings' },
      h('section', { class: 'set-row' }, h('span', {}, '効果音'), sound),
      h('section', { class: 'set-row' }, h('span', {}, 'BGM'),
        h('button', { class: `toggle ${s.settings.bgm !== false ? 'on' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(s.settings.bgm !== false), onclick: () => { s.settings.bgm = s.settings.bgm === false; save(); refreshBgm(); go('settings'); } }, s.settings.bgm !== false ? '🎵 ON' : '🔇 OFF')),
      h('p', { class: 'note' }, 'BGMは効果音がONのときだけ鳴る。模試・タイムアタック・暗記中は、集中できるように鳴らないよ。'),
      h('section', { class: 'set-row' }, h('span', {}, '盤面の演出スピード'),
        h('button', { class: `toggle ${s.settings.fxFast ? 'on' : ''}`, type: 'button', onclick: () => { s.settings.fxFast = !s.settings.fxFast; save(); go('settings'); } }, s.settings.fxFast ? '⚡ はやい' : '🐢 ふつう')),
      h('section', { class: 'set-row' }, h('span', {}, `ニックネーム: ${s.nickname}`), btn('変更', rename, 'small')),
      // 入試の日（ホームに「あと○日」を出す）
      h('section', { class: 'set-row' }, h('span', {}, '📅 入試の日'), (() => {
        const inp = h('input', { class: 'date-input', type: 'date', value: s.settings.examDate || '' });
        inp.addEventListener('change', () => { s.settings.examDate = inp.value || null; save(); });
        return inp;
      })()),
      h('p', { class: 'note' }, '公立高校の一般選抜（学力検査）の日を入れると、ホームに「入試まであと○日」が出るよ。'),
      h('h3', { class: 'sec' }, '💾 バックアップ'),
      h('p', { class: 'note' }, 'データはこのスマホの中だけに保存されている。Safari の履歴・Webサイトデータを消すと消えちゃうので、ときどきバックアップしておこう。'),
      h('div', { class: 'up-btns' },
        btn('📄 ファイルに保存', saveFile, 'primary'),
        btn('📋 文字でコピー', copyText, 'ghost'),
        btn('📂 ファイルから復元', () => fileIn.click(), 'ghost'),
        btn('📝 文字から復元', pasteBox, 'ghost')),
      fileIn,
      h('h3', { class: 'sec' }, '🔐 ごほうびの合言葉（おうちの人用）'),
      h('p', { class: 'note' }, '解除券を使うと、この合言葉から「解除コード」を作る。iPhone のショートカット「ごほうび解除」に同じ合言葉を入れておくと、コードを確かめて、券の分数だけ白黒を解除する。'),
      unlockBox(s),
      h('h3', { class: 'sec' }, '📲 アプリの版'),
      h('p', { class: 'note' }, 'アップロードしたのに画面が変わらないときは、ここで確認して「最新版にする」を押す。'),
      versionBox(),
      h('div', { class: 'up-btns' }, btn('🔄 最新版にする', forceUpdate, 'primary')),
      h('h3', { class: 'sec' }, 'そのほか'),
      h('div', { class: 'up-btns' },
        btn('🔦 看守チェック（診断）をやり直す', () => go('diagnosis', { phase: 'intro' }), 'ghost'),
        btn('📜 オープニングをもう一度', () => go('onboarding', { step: 'story', i: 0 }), 'ghost'),
        btn('🗑️ データを初期化', reset, 'danger')),
      h('p', { class: 'note center' }, 'ブレイン脱獄 v1 ｜ 外部への送信は一切なし・オフラインで動作')));
}
