// 小さな DOM ヘルパー
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function html(el, markup) {
  el.innerHTML = markup;
  return el;
}

export const $ = (root, sel) => root.querySelector(sel);
export const $$ = (root, sel) => [...root.querySelectorAll(sel)];

export function on(root, sel, type, fn) {
  for (const n of $$(root, sel)) n.addEventListener(type, (e) => fn(e, n));
}

// 画面下に出る小さなお知らせ
export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

// 確認ダイアログ（confirm() の代わり）
export function ask(message, okLabel = 'OK') {
  return new Promise((resolve) => {
    const d = document.createElement('div');
    d.className = 'modal';
    d.innerHTML = `<div class="modal-box"><p>${esc(message)}</p><div class="row"><button class="btn ghost" data-v="0">やめる</button><button class="btn danger" data-v="1">${esc(okLabel)}</button></div></div>`;
    d.addEventListener('click', (e) => {
      const v = e.target.closest('[data-v]')?.dataset.v;
      if (v === undefined && e.target !== d) return;
      d.remove();
      resolve(v === '1');
    });
    document.body.appendChild(d);
  });
}
