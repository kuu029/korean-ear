// ごほうび（カラーフィルタ解除）のコード: iPhone のショートカット「ごほうび解除」が確かめて、その分数だけ白黒を解除する
//   コード = 分数 - 時刻(HHmm) - 確認6けた
//   確認6けた = SHA-256「合言葉:日付(yyyyMMdd):時刻(HHmm):分数」の16進数の先頭6文字
//   合言葉はおうちの人が設定画面とショートカットの両方に入れる（アプリの中のプログラムには書かない）
const pad = (n, k = 2) => String(n).padStart(k, '0');
export const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
export const hm = (d) => `${pad(d.getHours())}${pad(d.getMinutes())}`;
export const codeSource = (secret, d, min) => `${secret}:${ymd(d)}:${hm(d)}:${min}`;

export async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function unlockCode(secret, d, min) {
  const h = await sha256hex(codeSource(secret, d, min));
  return `${min}-${hm(d)}-${h.slice(0, 6)}`;
}
// ショートカットを動かす URL（入力にコードを渡す）
export const SHORTCUT_NAME = 'ごほうび解除';
export const shortcutUrl = (code) => `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(code)}`;
