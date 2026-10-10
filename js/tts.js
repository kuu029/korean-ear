// ブラウザ内蔵の読み上げ（Web Speech API）。韓国語の声を選んで読む。
// iOS では最初の1回をボタンを押した処理の中で呼ぶ必要がある。
let voice = null;
const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;

function pickVoice() {
  if (!synth) return;
  const ko = synth.getVoices().filter((v) => /^ko([-_]|$)/i.test(v.lang));
  voice = ko.find((v) => /yuna|유나/i.test(v.name)) || ko.find((v) => v.localService) || ko[0] || null;
}
if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export const hasSpeech = () => !!synth;
// 声の一覧がまだ読み込まれていないときは null（わからない）
export function hasKoreanVoice() {
  if (!voice) pickVoice();
  if (voice) return true;
  return synth && synth.getVoices().length ? false : null;
}
// 声の一覧が届いたら知らせる（ホームの警告を出し直すため）
export function onVoices(fn) {
  synth?.addEventListener?.('voiceschanged', fn, { once: true });
}
export const voiceName = () => voice?.name || '';

export function speak(text, rate = 0.9) {
  if (!synth) return Promise.resolve();
  return new Promise((resolve) => {
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onend = u.onerror = () => resolve();
    synth.speak(u);
  });
}
