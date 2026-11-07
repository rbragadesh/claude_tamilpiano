// On-screen piano keyboard (canvas). Shows hints, pressed keys, mic-detected note; also playable by touch.
import { isBlack, pc, spelledName, swaraLabel } from './theory.js';

export const COLORS = {
  R: '#FFB627', Rdim: 'rgba(255,182,39,0.35)', L: '#2EC4B6', Ldim: 'rgba(46,196,182,0.35)',
  good: '#4ADE80', bad: '#FF5A5F', white: '#F6F1E7', black: '#1A1530', ink: '#16112B', mic: '#B794F6',
};

export class Keyboard {
  constructor(canvas, { onDown, onUp } = {}) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.lo = 48; this.hi = 84; this.onDown = onDown; this.onUp = onUp;
    this.hints = new Map(); // midi -> 'R'|'L'
    this.pressed = new Map(); // midi -> color
    this.flash = new Map(); // midi -> {color, until}
    this.micNote = null; this.labels = 'both'; this.sa = 0; this.raga = null; this.sig = 0; this.spellPref = null;
    this.pointers = new Map();
    this.layout();
    const down = (e) => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      const m = this.keyAt(e.offsetX, e.offsetY);
      if (m == null) return;
      this.pointers.set(e.pointerId, m); this.onDown && this.onDown(m);
    };
    const move = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const m = this.keyAt(e.offsetX, e.offsetY); const old = this.pointers.get(e.pointerId);
      if (m != null && m !== old) { this.onUp && this.onUp(old); this.pointers.set(e.pointerId, m); this.onDown && this.onDown(m); }
    };
    const up = (e) => { const m = this.pointers.get(e.pointerId); if (m != null) { this.pointers.delete(e.pointerId); this.onUp && this.onUp(m); } };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setRange(lo, hi) {
    // extend to white-key boundaries: start on C or F, end on E or B
    while (isBlack(lo) || ![0, 5].includes(pc(lo))) lo--;
    while (isBlack(hi) || ![4, 11].includes(pc(hi))) hi++;
    this.lo = lo; this.hi = hi; this.layout();
  }

  layout() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.c.clientWidth || 300, h = this.c.clientHeight || 120;
    if (this.c.width !== Math.round(w * dpr) || this.c.height !== Math.round(h * dpr)) { this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr); }
    this.w = w; this.h = h; this.dpr = dpr;
    const whites = []; for (let m = this.lo; m <= this.hi; m++) if (!isBlack(m)) whites.push(m);
    this.ww = w / whites.length; this.bw = this.ww * 0.62; this.bh = h * 0.6;
    this.keys = new Map();
    whites.forEach((m, i) => this.keys.set(m, { x: i * this.ww, w: this.ww, black: false }));
    for (let m = this.lo; m <= this.hi; m++) if (isBlack(m)) {
      const left = this.keys.get(m - 1); if (!left) continue;
      const off = { 1: 0.6, 3: 0.4, 6: 0.62, 8: 0.5, 10: 0.38 }[pc(m)];
      this.keys.set(m, { x: left.x + this.ww - this.bw * off, w: this.bw, black: true });
    }
  }

  /** x-centre and width for a midi note (used by the falling-notes view) */
  span(m) { const k = this.keys.get(m); return k ? { x: k.x, w: k.w } : null; }

  keyAt(x, y) {
    if (y < this.bh) for (const [m, k] of this.keys) if (k.black && x >= k.x && x < k.x + k.w) return m;
    for (const [m, k] of this.keys) if (!k.black && x >= k.x && x < k.x + k.w) return m;
    return null;
  }

  flashKey(m, color, ms = 350) { this.flash.set(m, { color, until: performance.now() + ms }); }

  label(m) {
    const west = spelledName(m, this.sig, this.spellPref);
    const sw = swaraLabel(m, this.sa, this.raga, false);
    if (this.labels === 'letters') return [west];
    if (this.labels === 'sargam') return [sw];
    if (this.labels === 'none') return [];
    return [west, sw];
  }

  draw() {
    this.layout();
    const g = this.g, dpr = this.dpr, now = performance.now();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    const fillFor = (m, base) => {
      const f = this.flash.get(m);
      if (f && f.until > now) return f.color;
      if (this.pressed.has(m)) return this.pressed.get(m);
      const hnt = this.hints.get(m);
      if (hnt) return COLORS[hnt];
      return base;
    };
    // whites
    for (const [m, k] of this.keys) {
      if (k.black) continue;
      const col = fillFor(m, COLORS.white);
      g.fillStyle = col;
      roundRect(g, k.x + 1, 0, k.w - 2, this.h - 1, Math.min(7, k.w * 0.18), false, true); g.fill();
      if (col === COLORS.white) { // subtle shading
        const gr = g.createLinearGradient(0, this.h * 0.7, 0, this.h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)');
        g.fillStyle = gr; roundRect(g, k.x + 1, 0, k.w - 2, this.h - 1, Math.min(7, k.w * 0.18), false, true); g.fill();
      }
      if (this.micNote === m) { g.fillStyle = COLORS.mic; g.beginPath(); g.arc(k.x + k.w / 2, this.h * 0.62, Math.min(6, k.w * 0.18), 0, 7); g.fill(); }
      const lb = this.label(m);
      const fs = Math.max(8, Math.min(14, k.w * 0.36));
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if (lb[0]) { g.fillStyle = pc(m - this.sa) === 0 ? '#C2410C' : 'rgba(22,17,43,0.72)'; g.font = `700 ${fs}px ui-rounded, system-ui, sans-serif`; g.fillText(lb[0], k.x + k.w / 2, this.h - (lb[1] ? fs * 1.35 : 7)); }
      if (lb[1]) { g.fillStyle = 'rgba(22,17,43,0.5)'; g.font = `600 ${fs * 0.88}px ui-rounded, system-ui, sans-serif`; g.fillText(lb[1], k.x + k.w / 2, this.h - 6); }
    }
    // blacks
    for (const [m, k] of this.keys) {
      if (!k.black) continue;
      const col = fillFor(m, COLORS.black);
      g.fillStyle = col;
      roundRect(g, k.x, 0, k.w, this.bh, Math.min(4, k.w * 0.15), false, true); g.fill();
      if (col === COLORS.black) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(k.x + k.w * 0.18, 2, k.w * 0.64, this.bh * 0.82); }
      if (this.micNote === m) { g.fillStyle = COLORS.mic; g.beginPath(); g.arc(k.x + k.w / 2, this.bh * 0.7, Math.min(5, k.w * 0.25), 0, 7); g.fill(); }
      if (this.hints.has(m) && this.labels !== 'none') {
        const lb = this.label(m); const fs = Math.max(7, Math.min(11, k.w * 0.42));
        g.fillStyle = COLORS.ink; g.font = `700 ${fs}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center';
        g.fillText(lb[0] || '', k.x + k.w / 2, this.bh - 6);
      }
    }
    // top shadow line
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, this.w, 3);
  }
}

export function roundRect(g, x, y, w, h, r, top = true, bottom = true) {
  const rt = top ? r : 0, rb = bottom ? r : 0;
  g.beginPath();
  g.moveTo(x + rt, y); g.lineTo(x + w - rt, y); g.quadraticCurveTo(x + w, y, x + w, y + rt);
  g.lineTo(x + w, y + h - rb); g.quadraticCurveTo(x + w, y + h, x + w - rb, y + h);
  g.lineTo(x + rb, y + h); g.quadraticCurveTo(x, y + h, x, y + h - rb);
  g.lineTo(x, y + rt); g.quadraticCurveTo(x, y, x + rt, y); g.closePath();
}
