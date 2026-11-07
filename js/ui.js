// Tiny DOM helpers: escaping, toasts, bottom sheets / full-screen overlays.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(msg, ms = 2600) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.innerHTML = esc(msg); el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
}

const stack = [];
/** open a layer. kind: 'sheet' (bottom sheet) | 'full' (full screen). Returns the layer element. */
export function openLayer(html, { kind = 'sheet', onClose = null, cls = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `layer layer-${kind} ${cls}`;
  wrap.innerHTML = kind === 'sheet'
    ? `<div class="scrim" data-close></div><div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`
    : `<div class="full" role="dialog">${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const entry = { el: wrap, onClose };
  stack.push(entry);
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeLayer(wrap); });
  return wrap;
}
export function closeLayer(el) {
  const i = stack.findIndex((x) => x.el === el || (!el && x === stack[stack.length - 1]));
  if (i < 0) return;
  const [entry] = stack.splice(i, 1);
  entry.el.classList.remove('open');
  try { entry.onClose && entry.onClose(); } catch (e) { console.error(e); }
  setTimeout(() => entry.el.remove(), 260);
}
export const topLayer = () => (stack.length ? stack[stack.length - 1].el : null);

export function confirmBox(msg, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const el = openLayer(`<div class="pad"><p class="confirm-msg">${esc(msg)}</p>
      <div class="row gap"><button class="btn ghost grow" data-no>${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'} grow" data-yes>${esc(ok)}</button></div></div>`,
    { onClose: () => resolve(false) });
    el.querySelector('[data-yes]').onclick = () => { resolve(true); closeLayer(el); };
    el.querySelector('[data-no]').onclick = () => closeLayer(el);
  });
}

export function stars(n, max = 3) {
  let s = '';
  for (let i = 0; i < max; i++) s += `<span class="star ${i < n ? 'on' : ''}">★</span>`;
  return `<span class="stars">${s}</span>`;
}

/** save/share a text file (uses the iOS share sheet when available) */
export async function shareFile(name, text, type = 'application/json') {
  const file = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => resolve(inp.files && inp.files[0] ? inp.files[0] : null);
    inp.click();
  });
}
