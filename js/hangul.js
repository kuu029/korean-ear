// ハングルの音節 ⇔ 字母（初声・中声・終声）の分解と、音節単位の比較
export const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split('');
export const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'.split('');
export const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const BASE = 0xac00;
const LAST = 0xd7a3;

// パッチムの代表音（単独・子音の前で実際に聞こえる音）
const REP = {
  'ㄱ': 'ㄱ', 'ㄲ': 'ㄱ', 'ㅋ': 'ㄱ', 'ㄳ': 'ㄱ', 'ㄺ': 'ㄱ',
  'ㄴ': 'ㄴ', 'ㄵ': 'ㄴ', 'ㄶ': 'ㄴ',
  'ㄷ': 'ㄷ', 'ㅅ': 'ㄷ', 'ㅆ': 'ㄷ', 'ㅈ': 'ㄷ', 'ㅊ': 'ㄷ', 'ㅌ': 'ㄷ', 'ㅎ': 'ㄷ',
  'ㄹ': 'ㄹ', 'ㄼ': 'ㄹ', 'ㄽ': 'ㄹ', 'ㄾ': 'ㄹ', 'ㅀ': 'ㄹ',
  'ㅁ': 'ㅁ', 'ㄻ': 'ㅁ',
  'ㅂ': 'ㅂ', 'ㅍ': 'ㅂ', 'ㅄ': 'ㅂ', 'ㄿ': 'ㅂ',
  'ㅇ': 'ㅇ', '': '',
};
export const finalRep = (f) => (f in REP ? REP[f] : f);

export function decompose(ch) {
  const code = ch.codePointAt(0);
  if (code < BASE || code > LAST) return null;
  const n = code - BASE;
  return { c: CHO[Math.floor(n / 588)], v: JUNG[Math.floor((n % 588) / 28)], f: JONG[n % 28] };
}

export function compose({ c, v, f = '' }) {
  const ci = CHO.indexOf(c), vi = JUNG.indexOf(v), fi = JONG.indexOf(f);
  if (ci < 0 || vi < 0 || fi < 0) return null;
  return String.fromCodePoint(BASE + ci * 588 + vi * 28 + fi);
}

// 採点用に、空白・記号を除いた音節の列にする。
// 打ちかけの字母（ㄱ だけ など）も1文字として扱う。
export function toSyllables(str) {
  const out = [];
  for (const ch of (str || '').normalize('NFC')) {
    if (/[\s.,!?~'"…·\-]/.test(ch)) continue;
    const d = decompose(ch);
    if (d) out.push({ ch, ...d });
    else if (CHO.includes(ch)) out.push({ ch, c: ch, v: '', f: '' });
    else if (JUNG.includes(ch)) out.push({ ch, c: '', v: ch, f: '' });
    else out.push({ ch, c: ch, v: '', f: '' });
  }
  return out;
}

export const POS = ['c', 'v', 'f'];
const syllDiff = (a, b) => POS.reduce((n, p) => n + (a[p] !== b[p] ? 1 : 0), 0);

// 正解 exp と回答 got（どちらも toSyllables の結果）を音節単位で並べて比べる。
// 置き換え = 違う字母の数（0〜3）、抜け・余分 = 2。全部ちがう音節は「置き換え」として扱われる。
// 返り値: [{ op: 'same'|'sub'|'missing'|'extra', i, j }]（i は正解側、j は回答側の位置）
export function align(exp, got) {
  const n = exp.length, m = got.length, INDEL = 2;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) d[i][0] = i * INDEL;
  for (let j = 1; j <= m; j++) d[0][j] = j * INDEL;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j - 1] + syllDiff(exp[i - 1], got[j - 1]), d[i - 1][j] + INDEL, d[i][j - 1] + INDEL);
    }
  }
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + syllDiff(exp[i - 1], got[j - 1])) {
      ops.push({ op: syllDiff(exp[i - 1], got[j - 1]) ? 'sub' : 'same', i: i - 1, j: j - 1 });
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + INDEL) {
      ops.push({ op: 'missing', i: i - 1, j: -1 });
      i--;
    } else {
      ops.push({ op: 'extra', i: -1, j: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}
