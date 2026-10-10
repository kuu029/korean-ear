// コレクション: カード図鑑・ガチャ（カード＋スキン）・スキン・道具
import { h, btn, modal, toast, sleep, confirmBox } from '../core/ui.js';
import { S, save, saveNow } from '../core/store.js';
import { MEM_BOSS_CARDS, CARDS, SKINS, TOOLS, BOSS_CARD, SKIN_ITEMS, TOWER_TYPES, TOWER_LOOK, SKIN_MAX_STAR, skinExchangeCost, skinStarCost } from '../game/content.js';
import { UNIT } from '../units/registry.js';
import { backdrop } from '../ui/deco.js';
import { allyLv, allyUpCost, levelUpAlly, PITY, pityLeft, GACHA_TYPES, CONSUMABLE, toolStock, gachaTickets, gacha, gachaCost, GACHA_COST, GACHA5_COST, GACHA10_COST, exchangeSkin, starUpSkin, equipSkin, skinState, tickets, party, toggleParty, PARTY_MAX, equippedTool, equipTool } from '../game/progress.js';
import { SUMMON, gaugeNeed, allyDesc, ALLY_MAX_LV, DEPLOY } from '../game/engine.js';
import { cardSprite, towerSprite, spriteHTML, iconHTML, hasArt } from '../game/art.js';
import { go } from '../core/router.js';
import { topBar } from './home.js';
import { sfx } from '../core/sound.js';
import { CHAL_BETS, CHAL_MAX, chalLeft, startChal } from '../game/flowchal.js';
import { isEvent } from '../game/event.js';
import { chalTable } from './memory.js';
import { unlockCode, shortcutUrl, SHORTCUT_NAME } from '../game/unlock.js';
import { REWARD, EXCHANGE, RGACHA_COST, RGACHA_RATES, rewardState, rewardTickets, exchangeReward, rewardGacha, useReward } from '../game/reward.js';

const RARE = { 1: 'ノーマル', 2: 'レア', 3: 'スーパーレア', 4: 'レジェンド' };

function itemView(it) {
  if (it.kind === 'skin') {
    const sk = SKIN_ITEMS.find((x) => x.id === it.id);
    const star = it.star || 1;
    return {
      name: `${TOWER_LOOK[sk.type].name}のスキン「${sk.name}」`,
      html: `<span class="cell slot built ${sk.cls} sk-star-${star} prev-slot">${towerSprite(sk.type, 2, sk.design)}</span>`,
      text: it.starUp ? `★${star} に強化！ 光り方がもっと派手になった。` : 'タワーの見た目が変わる！ スキン欄で使えるよ。ダブると★が上がる。',
    };
  }
  if (it.kind === 'reward') return { name: REWARD[it.id].name, html: `<span class="rw-big">${iconHTML(`reward-${it.id}`, REWARD[it.id].emoji, REWARD[it.id].name)}</span>`, text: `カラーフィルタを ${REWARD[it.id].min}分 はずしてもらえる！「ごほうび」タブで使えるよ` };
  if (it.kind === 'gem') return { name: `はずれ… 💎${it.gems} もどった`, html: '<span class="rw-big">💎</span>', text: 'つぎこそ！' };
  const c = CARDS.find((x) => x.id === it.id);
  return { name: c.name, html: cardSprite(c.id), text: c.text };
}

// 並べ替えチャレンジ: 教科と、かける💎をえらんで始める
async function chalStart(s) {
  if (chalLeft() <= 0) return toast('今日のチャレンジは3回やったよ。また明日！', 2000);
  let subj = 'soc';
  let bet = CHAL_BETS.find((b) => s.gems >= b) ? CHAL_BETS.filter((b) => s.gems >= b)[0] : CHAL_BETS[0];
  const body = h('div', { class: 'modal-body fc-start' });
  const paint = () => {
    const seg = (items, cur, set) => h('div', { class: 'ac-seg' }, items.map(([v, label, ok = true]) => h('button', { class: `ac-opt${cur === v ? ' on' : ''}${ok ? '' : ' poor'}`, type: 'button', onclick: () => { set(v); sfx('tap'); paint(); } }, label)));
    body.replaceChildren(
      h('p', { class: 'note' }, '「流れでつなげる」（年表・時代・原因と結果など）を10問。正解数で、かけた💎が何倍かになって返ってくる。まちがいが多いと、へる…！ 順番ガイドはなし。'),
      h('b', {}, '教科'), seg([['soc', '🗾 社会'], ['sci', '🔬 理科']], subj, (v) => { subj = v; }),
      h('b', {}, `かける💎（持っている 💎${s.gems}）`), seg(CHAL_BETS.map((b) => [b, `💎${b}`, s.gems >= b]), bet, (v) => { bet = v; }),
      h('b', {}, '正解数と倍率'), chalTable(),
      h('small', { class: 'note' }, `とちゅうでやめると、かけた💎はもどらない。1日${CHAL_MAX}回まで（今日あと${chalLeft()}回）`));
  };
  paint();
  const go1 = await modal({ title: '🎲 並べ替えチャレンジ', body, buttons: [{ label: 'やめる', value: false }, { label: 'チャレンジ！', value: true, cls: 'primary' }] });
  if (!go1) return;
  if (s.gems < bet) return toast(`💎が足りない（あと ${bet - s.gems}）`);
  if (!startChal(bet)) return toast('今日はもうできないよ');
  save();
  sfx('coin');
  go('memory', { phase: 'flow', subject: subj, bet });
}

// ごほうびタブ: 解除券の交換・ごほうびガチャ・使う（使ったら大きく表示して、おうちの人に見せる）
function rewardTab(s) {
  const T = rewardTickets();
  const log = rewardState().log;
  const fmt = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const use = async (id) => {
    const r = REWARD[id];
    if (!(await confirmBox(`${r.name}を使う？`, 'おうちの人に、この画面を見せてね。使うと1枚へるよ。', '使う！', 'やめる'))) return;
    const rec = useReward(id);
    if (!rec) return;
    sfx('win');
    // 合言葉が設定されていれば、ショートカット用の解除コードを出す（白黒の解除と、時間が来たら戻すのは iPhone のショートカットがする）
    const secret = S().settings.unlockSecret;
    if (secret) {
      const code = await unlockCode(secret, new Date(rec.at), rec.min);
      rec.code = code;
      saveNow();
      const copy = async () => { try { await navigator.clipboard.writeText(code); toast('コードをコピーした'); } catch { toast('コピーできなかった。コードを見て入力してね'); } };
      await copy();
      await modal({
        title: '🌈 カラーフィルタ解除',
        body: h('div', { class: 'modal-body center rw-show' },
          h('div', { class: 'rw-min' }, `${rec.min}分`),
          h('div', { class: 'rw-code' }, code),
          h('p', { class: 'note' }, `コードはコピーしたよ。ホーム画面の「${SHORTCUT_NAME}」をタップするか、下のボタンを押してね。`),
          h('small', { class: 'note' }, 'コードは10分以内・1回だけ使える。時間が来たら白黒にもどるよ。')),
        buttons: [{ label: 'とじる', value: false }, { label: '▶ ショートカットで解除', value: true, cls: 'primary' }],
      }).then((v) => { if (v) location.href = shortcutUrl(code); });
      go('collection', { tab: 'reward' });
      return;
    }
    await modal({
      title: '🌈 カラーフィルタ解除',
      body: h('div', { class: 'modal-body center rw-show' }, h('div', { class: 'rw-min' }, `${rec.min}分`), h('p', {}, `${fmt(rec.at)} に使用`), h('small', { class: 'note' }, 'おうちの人へ: この時間だけカラーフィルタをはずしてあげてください（時間はおうちの人が測ります）')),
      buttons: [{ label: 'OK', value: true, cls: 'primary' }],
    });
    go('collection', { tab: 'reward' });
  };
  const pullR = async () => {
    const res = rewardGacha();
    if (!res) return toast(`💎が足りない（あと ${RGACHA_COST - s.gems}）`);
    await gachaStage([res]);
    go('collection', { tab: 'reward' });
  };
  return h('div', { class: 'reward-box' },
    h('p', { class: 'note' }, 'スマホのカラーフィルタ（白黒）を、少しのあいだはずしてもらえる券。💎で確実に交換するか、ガチャで大当たりをねらうか！'),
    h('p', { class: 'center' }, `💎 ${s.gems}`),
    h('h3', { class: 'sec' }, '🎫 持っている券'),
    h('div', { class: 'rw-list' }, Object.entries(REWARD).map(([id, r]) => h('div', { class: `rw-row r${r.rarity}` },
      h('span', { class: 'rw-em', html: iconHTML(`reward-${id}`, r.emoji, r.name) }), h('div', {}, h('b', {}, r.name), h('small', {}, `× ${T[id] || 0} 枚`)),
      btn('使う', () => use(id), `small ${T[id] ? 'primary' : 'ghost'}`)))),
    h('h3', { class: 'sec' }, '💱 💎で交換（確実）'),
    h('div', { class: 'gacha-btns' }, Object.entries(EXCHANGE).map(([id, cost]) => btn(`${REWARD[id].name} 💎${cost}`, () => { if (exchangeReward(id)) { sfx('coin'); toast(`${REWARD[id].name}をゲット！`); go('collection', { tab: 'reward' }); } else toast(`💎が足りない（あと ${cost - s.gems}）`); }, s.gems >= cost ? 'primary' : 'ghost'))),
    h('h3', { class: 'sec' }, '🎰 ごほうびガチャ（一発勝負）'),
    btn(`1回 💎${RGACHA_COST}`, pullR, 'boss'),
    h('div', { class: 'rates' }, h('b', {}, '出るもの'), ...RGACHA_RATES.map((r) => h('div', {}, `${r.id === 'gem' ? `はずれ（💎${r.gems} もどる）` : REWARD[r.id].name}：${r.weight}%`))),
    log.length > 0 && h('h3', { class: 'sec' }, '📜 使った記録'),
    log.length > 0 && h('div', { class: 'rw-log' }, log.slice(0, 10).map((x) => h('div', {}, `${fmt(x.at)}　${x.min}分${x.code ? `　${x.code}` : ''}`))));
}

// カプセルを開ける演出（全画面）
function gachaStage(results) {
  return new Promise((resolve) => {
    const best = Math.max(...results.map((r) => r.rarity));
    const caps = results.map((r, i) => {
      const cap = h('button', { class: `capsule r${r.rarity} tease${best >= 3 && r.rarity === best ? ' glowy' : ''}`, type: 'button', style: { animationDelay: `${i * 0.08}s` }, onclick: () => open(i) },
        h('span', { class: 'cap-top' }), h('span', { class: 'cap-bottom' }), h('span', { class: 'cap-q' }, '？'));
      return { r, cap, opened: false };
    });
    const grid = h('div', { class: `cap-grid n${results.length}` }, caps.map((c) => c.cap));
    const msg = h('p', { class: 'cap-msg' }, results.length > 1 ? 'カプセルをタップ！' : 'タップしてあける！');
    const allBtn = results.length > 1 ? btn('ぜんぶあける', async () => { for (let i = 0; i < caps.length; i++) { if (!caps[i].opened) { open(i); await sleep(260); } } }, 'ghost small') : null;
    const okBtn = btn('OK', () => { stage.remove(); resolve(); }, 'primary big hidden');
    const stage = h('div', { class: 'gacha-stage' }, h('div', { class: 'gs-rays' }), grid, msg, allBtn, okBtn);
    document.body.append(stage);
    sfx('rattle');

    function open(i) {
      const c = caps[i];
      if (c.opened) return;
      c.opened = true;
      const { r, cap } = c;
      const v = itemView(r);
      sfx('reveal', r.rarity);
      cap.classList.remove('tease');
      cap.classList.add('open');
      cap.innerHTML = '';
      cap.append(
        h('span', { class: 'cap-light' }),
        h('span', { class: 'cap-item', html: v.html }),
        h('span', { class: 'cap-stars' }, `${'★'.repeat(r.rarity)} ${RARE[r.rarity]}`),
        h('span', { class: 'cap-name' }, v.name),
        r.kind === 'reward' ? h('span', { class: 'cap-new' }, '大当たり！') : r.kind === 'gem' ? '' : r.isNew ? h('span', { class: 'cap-new' }, 'NEW!') : r.starUp ? h('span', { class: 'cap-new' }, `★${r.star}に強化！`) : h('span', { class: 'cap-dup' }, `ダブり → 🧩+${r.shards}`));
      for (let k = 0; k < 10; k++) {
        const p = h('span', { class: 'cap-spark' }, r.rarity >= 3 ? '✨' : '⭐');
        const ang = (Math.PI * 2 * k) / 10;
        p.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(ang) * 70}px), calc(-50% + ${Math.sin(ang) * 70}px)) scale(1)`, opacity: 0 }], { duration: 650, easing: 'ease-out' }).finished.then(() => p.remove());
        cap.append(p);
      }
      if (r.rarity >= 3) stage.classList.add(`flash-r${r.rarity}`);
      if (results.length === 1) msg.textContent = v.text;
      if (caps.every((x) => x.opened)) {
        msg.textContent = results.length > 1 ? 'ぜんぶあけた！' : v.text;
        allBtn?.remove();
        // 出たなかまキャラは、その場で「なかまにする」（コレクション画面まで行かなくていい）
        const allyIds = [...new Set(results.filter((x) => x.kind !== 'skin' && SUMMON[x.id]).map((x) => x.id))];
        if (allyIds.length) {
          const row = h('div', { class: 'cap-party' });
          const paint = () => row.replaceChildren(h('small', {}, `🤝 なかまにする（最大${PARTY_MAX}体）`), ...allyIds.map((id) => {
            const c = CARDS.find((x) => x.id === id);
            const on = party().includes(id);
            return btn(h('span', {}, h('span', { class: 'cp-face', html: cardSprite(id) }), on ? `✓ ${c.name}` : c.name), () => { toggleParty(id); sfx('build'); paint(); }, `small ${on ? 'primary' : 'ghost'}`);
          }));
          paint();
          okBtn.before(row);
        }
        okBtn.classList.remove('hidden');
      }
    }
  });
}

export function render(el, { tab = 'cards', gtype = 'normal', chal = 0 } = {}) {
  const s = S();
  const tabs = [['cards', '🃏 カード'], ['gacha', '🎰 ガチャ'], ['skins', '🎨 スキン'], ['tools', '🧰 道具'], ['reward', '🌈 ごほうび']];
  const owned = Object.keys(s.collection.cards).length;
  const shards = s.collection.shards || 0;
  const content = h('div', { class: 'coll' });
  if (tab === 'cards') {
    // ボスのカードは教科ごと、それ以外は「看守・なかま」
    const bossOf = Object.fromEntries(Object.entries(BOSS_CARD).map(([unit, card]) => [card, unit]));
    const groups = [
      ['看守・なかま', CARDS.filter((c) => !bossOf[c.id] && !MEM_BOSS_CARDS.includes(c.id))],
      ['数学のボス', CARDS.filter((c) => bossOf[c.id] && (UNIT[bossOf[c.id]]?.subject || 'math') === 'math')],
      ['英語棟のボス', CARDS.filter((c) => bossOf[c.id] && UNIT[bossOf[c.id]]?.subject === 'english')],
      ['国語棟のボス', CARDS.filter((c) => bossOf[c.id] && UNIT[bossOf[c.id]]?.subject === 'japanese')],
      ['理科棟のボス', CARDS.filter((c) => bossOf[c.id] && UNIT[bossOf[c.id]]?.subject === 'science')],
      ['社会棟のボス', CARDS.filter((c) => bossOf[c.id] && UNIT[bossOf[c.id]]?.subject === 'social')],
      ['暗号室のボス', CARDS.filter((c) => MEM_BOSS_CARDS.includes(c.id))],
    ];
    // なかまの技とレベルアップ（🧩かけらで Lv1→5。その場で数字が変わる）
    const allyBox = (id) => {
      const box = h('div', { class: 'ally-info' });
      const paint = () => {
        const cost = allyUpCost(id);
        const lv = allyLv(id);
        box.replaceChildren(
          h('b', {}, `🤝 なかまの技　Lv${lv}${lv >= ALLY_MAX_LV ? '（MAX）' : ''}`), h('p', {}, allyDesc(id)),
          h('small', {}, `ウェーブ中、正解 ${gaugeNeed(id)} 回でゲージ満タン → 召喚（チケット1枚）。のこり ×${tickets()[id] || 0}`),
          cost !== null && h('div', { class: 'lv-up' },
            h('small', {}, `次の Lv${lv + 1}: ${lv + 1 === 3 || lv + 1 === 5 ? 'ゲージ −1・' : ''}${DEPLOY[id] ? 'ダメージや体力が上がる' : '技が早く出せる'}`),
            btn(`⬆ レベルアップ 🧩${cost}（持っている ${s.collection.shards || 0}）`, () => { if (!levelUpAlly(id)) return toast(`🧩かけらが足りない（あと ${cost - (s.collection.shards || 0)}）`); sfx('upgrade'); paint(); }, (s.collection.shards || 0) >= cost ? 'primary small' : 'ghost small')));
      };
      paint();
      return box;
    };
    const cardView = (c) => {
      const n = s.collection.cards[c.id];
      // まだ持っていないカードはシルエットで見せる（正体はお楽しみ）
      const ally = !!SUMMON[c.id];
      const inParty = party().includes(c.id);
      const open = () => modal({
        title: `${c.name}`,
        body: h('div', { class: 'modal-body center' }, h('div', { class: 'card-big', html: cardSprite(c.id) }), h('div', { class: 'stars' }, '★'.repeat(c.rarity)), h('p', {}, c.text),
          ally && allyBox(c.id),
          h('small', { class: 'note' }, `所持 ${n}枚`)),
        buttons: ally ? [{ label: '閉じる', value: null }, { label: inParty ? 'なかまから外す' : `なかまにする（最大${PARTY_MAX}体）`, value: 'party', cls: 'primary' }] : undefined,
      }).then((v) => { if (v === 'party') { toggleParty(c.id); sfx('build'); go('collection', { tab: 'cards' }); } });
      return n
        ? h('button', { class: `card r${c.rarity}${inParty ? ' in-party' : ''}`, type: 'button', onclick: open },
          ally && allyLv(c.id) > 1 && h('span', { class: 'c-lv' }, `Lv${allyLv(c.id)}`),
          h('span', { class: 'c-stars' }, '★'.repeat(c.rarity)), inParty && h('span', { class: 'c-party' }, '🤝'), h('div', { class: 'c-art', html: cardSprite(c.id) }), h('div', { class: 'c-name' }, c.name), ally && h('small', { class: 'c-tix' }, `×${tickets()[c.id] || 0}`))
        : h('div', { class: `card unknown r${c.rarity}` }, h('span', { class: 'c-stars' }, '★'.repeat(c.rarity)), h('div', { class: 'c-art sil', html: cardSprite(c.id) }), h('div', { class: 'c-name' }, '？？？'));
    };
    content.append(
      h('div', { class: 'party-bar' }, h('b', {}, '🤝 なかま'), ...[0, 1].map((k) => { const id = party()[k]; const c = id && CARDS.find((x) => x.id === id); return h('span', { class: 'pb-slot' }, c ? h('span', { html: cardSprite(id) }) : '＋', c ? h('small', {}, `×${tickets()[id] || 0}`) : null); }), h('small', { class: 'pb-note' }, 'ガチャのキャラをタップ →「なかまにする」。ウェーブ中、正解でたまるゲージで召喚できる。')),
      h('div', { class: 'coll-prog' }, h('span', {}, `図鑑 ${owned} / ${CARDS.length}`), h('span', { class: 'cp-bar' }, h('i', { style: { width: `${(owned / CARDS.length) * 100}%` } })), h('b', {}, `${Math.round((owned / CARDS.length) * 100)}%`)),
      ...groups.flatMap(([name, list]) => [
        h('h3', { class: 'sec' }, `${name}（${list.filter((c) => s.collection.cards[c.id]).length}/${list.length}）`),
        h('div', { class: 'card-grid' }, list.map(cardView)),
      ]));
  } else if (tab === 'gacha') {
    // ガチャの種類をえらぶ（ノーマル／スキン特化／なかま特化）＋ごほうびガチャへの入口
    const type = GACHA_TYPES[gtype] ? gtype : 'normal';
    const T = GACHA_TYPES[type];
    const pull = async (n, ticket = false) => {
      const res = gacha(n, { ticket, type });
      if (!res) return toast(ticket ? '🎟 ガチャ券が足りない' : `💎が足りない（あと ${gachaCost(n, type) - s.gems}）`);
      await gachaStage(res);
      go('collection', { tab: 'gacha', gtype: type });
    };
    const total = T.rates.reduce((a, r) => a + r.weight, 0);
    const machine = (k) => spriteHTML(hasArt(`gacha-machine-${k}`) ? `gacha-machine-${k}` : 'gacha-machine', GACHA_TYPES[k].emoji, 'ガチャマシン');
    content.append(h('div', { class: 'gacha-box' },
      // ① ガチャの種類: 大きなカードで、えらんでいるものに色と「えらび中」
      isEvent('gachafes') && h('div', { class: 'ev-chip' }, '🎰 週末イベント「ガチャ祭り」開催中！ ぜんぶ2割引き'),
      h('h3', { class: 'g-sec' }, h('span', { class: 'g-num' }, '1'), 'ガチャをえらぶ'),
      h('div', { class: 'gt-pick' }, Object.entries(GACHA_TYPES).map(([k, t]) => h('button', { class: `gt-card gt-${k}${k === type ? ' on' : ''}`, type: 'button', 'aria-pressed': String(k === type), onclick: () => { sfx('tap'); go('collection', { tab: 'gacha', gtype: k }); } },
        k === type && h('span', { class: 'gt-badge' }, 'えらび中'),
        h('span', { class: 'gt-mini', html: machine(k) }), h('b', {}, t.name), h('small', {}, `1回 💎${gachaCost(1, k)}`)))),
      h('h3', { class: 'g-sec' }, h('span', { class: 'g-num' }, '2'), `${T.emoji} ${T.name}ガチャを回す`),
      h('div', { class: `gacha-pane gt-${type}` },
      h('div', { class: `gacha-machine gt-${type}`, html: spriteHTML(hasArt(`gacha-machine-${type}`) ? `gacha-machine-${type}` : 'gacha-machine', T.emoji, 'ガチャマシン') }),
      h('p', { class: 'gt-desc' }, T.desc),
      h('p', { html: `${iconHTML('icon-gem', '💎', 'ダイヤ')} ${s.gems}　${iconHTML('icon-ticket', '🎟', 'ガチャ券')} ガチャ券 ${gachaTickets()}　🧩 かけら ${shards}` }),
      // ガチャ券（ログインボーナス・ドロップ）: ノーマルだけ。1枚で1回。5枚あれば5連も
      type === 'normal' && gachaTickets() > 0 && h('div', { class: 'gacha-btns tix' },
        btn(`🎟 券で1回（のこり ${gachaTickets()}枚）`, () => pull(1, true), 'primary'),
        gachaTickets() >= 5 && btn('🎟 券5枚で5回', () => pull(5, true), 'boss')),
      // 天井: ★4 確定まであと何回か
      h('div', { class: 'pity' }, h('span', {}, '★4 確定まで'), h('span', { class: 'pity-bar' }, h('i', { style: { width: `${(1 - pityLeft(type) / PITY[type]) * 100}%` } })), h('b', {}, `あと ${pityLeft(type)} 回`)),
      h('div', { class: 'gacha-btns' }, Object.keys(T.cost).map((n) => [n, gachaCost(Number(n), type)]).map(([n, cost]) => btn(`${n}回 💎${cost}${n === '10' ? '（おトク）' : ''}`, () => pull(Number(n)), n === '1' ? 'primary' : `boss${n === '10' && s.gems >= cost ? ' ready10' : ''}`))),
      h('div', { class: 'rates' },
        h('b', {}, '出る確率'),
        h('div', {}, T.rates.map((r) => `★${r.rarity} ${Math.round((r.weight / total) * 100)}%`).join('　')),
        type === 'normal' && h('div', {}, '★1〜2 キャラ ／ ★3〜4 キャラかタワースキン'),
        type === 'ally' && h('div', {}, '★3・★4 のなかまは技が強い（ゲージが多くいる）'),
        h('div', {}, `${PITY[type]}回のうちに★4 が出なければ、${PITY[type]}回目は★4 確定（天井）`),
        h('div', {}, 'スキンがダブると★アップ（最大★5）。キャラのダブりは 🧩かけら＋召喚チケット'),
        h('div', {}, 'かけらはスキン欄で、スキンとの交換や★アップに使える'))),
      // ③ 💎をふやす・使う（ガチャとは別の遊び）
      h('h3', { class: 'g-sec' }, h('span', { class: 'g-num' }, '3'), 'ほかの遊び'),
      h('div', { class: 'g-extra' },
        h('button', { class: 'gx-card gx-chal', type: 'button', onclick: () => chalStart(s) },
          h('span', { class: 'gx-em' }, '🎲'), h('span', { class: 'gx-txt' }, h('b', {}, '並べ替えチャレンジ'), h('small', {}, `💎をかけて社会・理科の「流れ」10問。正解が多いほど最大3倍！（今日あと${chalLeft()}回）`))),
        h('button', { class: 'gx-card gx-rw', type: 'button', onclick: () => go('collection', { tab: 'reward' }) },
          h('span', { class: 'gx-em' }, '🌈'), h('span', { class: 'gx-txt' }, h('b', {}, 'ごほうび（解除券）'), h('small', {}, 'カラーフィルタを少しはずしてもらえる券'))))));
    if (chal) setTimeout(() => chalStart(s), 50);
  } else if (tab === 'skins') {
    // タワーごとにスキンを選ぶ。ダブり（またはかけら）で ★1→★5
    const ts = skinState();
    const stars = (n) => '★'.repeat(n) + '☆'.repeat(SKIN_MAX_STAR - n);
    const redo = () => go('collection', { tab: 'skins' });
    content.append(h('p', { class: 'note' }, `スキンはタワーごと。同じスキンがダブると★が上がって、光り方が派手になる（最大★${SKIN_MAX_STAR}）。🧩 かけら ${shards}`),
      ...TOWER_TYPES.map((type) => h('div', { class: 'skin-group' },
        h('h3', { class: 'sec' }, `${TOWER_LOOK[type].emoji || ''} ${TOWER_LOOK[type].name}`),
        h('div', { class: 'skin-list' }, SKINS.map((sk) => {
          const itemId = `${sk.id}:${type}`;
          const it = SKIN_ITEMS.find((x) => x.id === itemId);
          const star = sk.id === 'default' ? 0 : ts.owned[itemId] || 0;
          const have = sk.id === 'default' || star > 0;
          const on = (ts.on[type] || 'default') === sk.id;
          return h('div', { class: `skin-row ${on ? 'on' : ''} r${sk.rarity}${have ? '' : ' locked'}` },
            h('span', { class: `cell slot built ${sk.cls} sk-star-${star}`, html: towerSprite(type, 2, sk.id) }),
            h('div', { class: 'sk-name' }, h('b', {}, sk.name), sk.id !== 'default' && h('small', {}, have ? stars(star) : '未入手')),
            h('div', { class: 'sk-btns' },
              on ? h('span', { class: 'm-ok' }, '使用中') : have ? btn('使う', () => { equipSkin(type, sk.id); sfx('build'); redo(); }, 'small') : null,
              it && !have && btn(`🧩${skinExchangeCost(it)}`, () => { if (exchangeSkin(itemId)) { sfx('reveal', sk.rarity); redo(); } else toast(`かけらが足りない（あと ${skinExchangeCost(it) - shards}）`); }, `small ${shards >= skinExchangeCost(it) ? 'primary' : ''}`),
              it && have && star < SKIN_MAX_STAR && btn(`★UP 🧩${skinStarCost(it, star)}`, () => { if (starUpSkin(itemId)) { sfx('reveal', Math.min(4, star + 1)); toast(`★${star + 1} に強化！`); redo(); } else toast(`かけらが足りない（あと ${skinStarCost(it, star) - shards}）`); }, 'small ghost')));
        })))));
  } else if (tab === 'reward') {
    content.append(rewardTab(s));
  } else {
    // ウェーブに持っていけるのは1つだけ。タップでえらぶ
    const on = equippedTool();
    content.append(h('p', { class: 'note' }, '単元の訓練を全部クリアすると1つずつもらえる。ウェーブに持っていけるのは 1つだけ（1回使える）。へそくりは使い捨て。タップでえらぼう。'),
      h('div', { class: 'tool-list' }, Object.entries(TOOLS).map(([id, t]) => {
        const have = s.tools.includes(id);
        const left = CONSUMABLE[id] ? toolStock()[id] || 0 : null;
        const ok = have && (left === null || left > 0);
        // まだ持っていない道具は「どこでもらえるか」を出す（数学の単元を先に）
        const from = Object.values(UNIT).filter((u) => u.tool === id && !u.comingSoon).sort((a, b) => ((a.subject || 'math') === 'math' ? 0 : 1) - ((b.subject || 'math') === 'math' ? 0 : 1))[0];
        return h(ok ? 'button' : 'div', { class: `tool-row ${ok ? '' : 'locked'}${on === id ? ' on' : ''}`, ...(ok ? { type: 'button', onclick: () => { equipTool(id); sfx('build'); go('collection', { tab: 'tools' }); } } : {}) },
          h('span', { class: 'c-em', html: have ? iconHTML(`tool-${id}`, t.emoji, t.name) : '🔒' }),
          h('div', {}, h('b', {}, t.name, left !== null && have ? `（のこり ${left}枚・使い捨て）` : ''), h('small', {}, have ? t.desc : from ? `「${from.title}」の訓練を全部クリアでゲット` : t.desc),
            left === 0 && have && h('small', { class: 'warn-text' }, 'ウェーブに勝つと、たまにドロップするよ')),
          on === id && h('span', { class: 'm-ok tr-on' }, '🎒 持っていく'));
      })));
  }
  backdrop(el, 'cell', 'bg-collection');
  el.append(topBar(() => go('home')),
    h('div', { class: 'tabs' }, tabs.map(([id, label]) => h('button', { class: `tab ${id === tab ? 'on' : ''}`, type: 'button', onclick: () => go('collection', { tab: id }) }, label))),
    content);
}
