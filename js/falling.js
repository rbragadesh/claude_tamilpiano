// Falling-notes view: bars drop onto the keyboard below. Shares x-positions with the Keyboard.
import { COLORS, roundRect } from './keyboard.js';
import { spelledName, swaraName, swaraLabel, beatsPerBar, keySigCount, RAGA_BY_ID } from './theory.js';

export class FallingView {
  constructor(canvas, keyboard) { this.c = canvas; this.g = canvas.getContext('2d'); this.kb = keyboard; }
  setSong(song) {
    this.song = song; this.sorted = song.notes.map((n, i) => ({ n, i })).sort((a, b) => a.n.t - b.n.t);
    this.bpb = beatsPerBar(song.ts); this.sig = keySigCount(song.key); this.raga = song.raga ? RAGA_BY_ID[song.raga] : null;
  }
  draw(st) {
    if (!this.song) return;
    const dpr = window.devicePixelRatio || 1;
    const W = this.c.clientWidth, H = this.c.clientHeight;
    if (this.c.width !== Math.round(W * dpr) || this.c.height !== Math.round(H * dpr)) { this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr); }
    const g = this.g; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const ppb = st.ppbV || Math.max(60, H / 4.5);
    const Y = (beat) => H - (beat - st.beat) * ppb; // hit line at bottom
    const beat1 = st.beat + H / ppb + 0.5;
    // guides: C and F lines, bar lines
    g.fillStyle = 'rgba(246,241,231,0.04)';
    for (const [m, k] of this.kb.keys) if (!k.black && (m % 12 === 0 || m % 12 === 5)) g.fillRect(k.x, 0, 1, H);
    g.strokeStyle = 'rgba(246,241,231,0.12)'; g.lineWidth = 1;
    for (let b = Math.ceil(st.beat / this.bpb) * this.bpb; b < beat1; b += this.bpb) { const y = Y(b); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    (this.song.chords || []).forEach((c) => {
      const y = Y(c.t); if (y < 0 || y > H) return;
      g.fillStyle = 'rgba(46,196,182,0.8)'; g.font = '800 13px ui-rounded, system-ui'; g.textAlign = 'left'; g.fillText(c.name, 6, y - 4);
    });
    for (const { n, i } of this.sorted) {
      if (n.t > beat1) break;
      if (n.t + n.d < st.beat - 0.2) continue;
      const sp = this.kb.span(n.m); if (!sp) continue;
      const y0 = Y(n.t), y1 = Y(n.t + n.d);
      const state = st.states.get(i); const active = st.active.has(i);
      let col = n.h === 'L' ? COLORS.L : COLORS.R;
      if (state === 'hit') col = COLORS.good; else if (state === 'miss') col = COLORS.bad;
      const dim = state === 'auto' || (st.handsMask && !st.handsMask[n.h]);
      const pad = sp.w > 14 ? 2 : 1;
      g.globalAlpha = dim ? 0.35 : 1;
      if (active) { g.shadowColor = col; g.shadowBlur = 14; }
      g.fillStyle = col; roundRect(g, sp.x + pad, y1 + 1, sp.w - pad * 2, Math.max(6, y0 - y1 - 2), Math.min(6, sp.w / 3)); g.fill();
      g.shadowBlur = 0;
      if (st.labels !== 'none' && y0 - y1 > 16 && sp.w >= 12) {
        g.fillStyle = '#16112B'; g.font = `800 ${Math.min(13, sp.w * 0.5)}px ui-rounded, system-ui`; g.textAlign = 'center';
        const lab = st.labels === 'sargam' ? swaraName(n.m, st.sa, this.raga)[0] : spelledName(n.m, this.sig, this.song.spelling);
        g.fillText(lab, sp.x + sp.w / 2, y0 - 6);
        if (st.labels === 'both' && y0 - y1 > 32) { g.fillStyle = 'rgba(22,17,43,0.6)'; g.font = `700 ${Math.min(11, sp.w * 0.4)}px ui-rounded, system-ui`; g.fillText(swaraLabel(n.m, st.sa, this.raga, false), sp.x + sp.w / 2, y0 - 21); }
      }
      g.globalAlpha = 1;
    }
    // hit line glow
    const gr = g.createLinearGradient(0, H - 18, 0, H); gr.addColorStop(0, 'rgba(255,182,39,0)'); gr.addColorStop(1, 'rgba(255,182,39,0.35)');
    g.fillStyle = gr; g.fillRect(0, H - 18, W, 18);
    const nowMs = performance.now();
    (st.popups || []).forEach((p) => {
      const age = (nowMs - p.born) / 900; if (age > 1) return;
      g.globalAlpha = 1 - age; g.fillStyle = p.color; g.font = '900 22px ui-rounded, system-ui'; g.textAlign = 'center';
      g.fillText(p.text, W / 2, H * 0.35 - age * 20); g.globalAlpha = 1;
    });
  }
}
