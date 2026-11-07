// Scrolling sheet-music view (Simply Piano style): grand staff, fixed playhead, notes slide right→left.
import { spell, keySigCount, keyAccidentalMap, KEYSIG_STEPS, swaraLabel, swaraName, beatsPerBar, RAGA_BY_ID, ragaLetterMap, keyLetter, keyTonicPc } from './theory.js';
import { COLORS, roundRect } from './keyboard.js';

const TREBLE_TOP = 38, BASS_TOP = 26; // diatonic step of the top staff line (F5 / A3)

function headType(d) {
  if (d >= 3.75) return { kind: 'whole', dot: false };
  if (d >= 2.75) return { kind: 'half', dot: true };
  if (d >= 1.75) return { kind: 'half', dot: false };
  if (d >= 1.25) return { kind: 'quarter', dot: true };
  if (d >= 0.875) return { kind: 'quarter', dot: false };
  if (d >= 0.625) return { kind: 'eighth', dot: true };
  if (d >= 0.375) return { kind: 'eighth', dot: false };
  return { kind: 'sixteenth', dot: false };
}

export class StaffView {
  constructor(canvas) { this.c = canvas; this.g = canvas.getContext('2d'); this.song = null; }

  setSong(song) {
    this.song = song;
    const notes = song.notes;
    this.hasR = notes.some((n) => n.h === 'R');
    this.hasL = notes.some((n) => n.h === 'L');
    if (!this.hasR && !this.hasL) this.hasR = true;
    this.grand = this.hasR && this.hasL;
    this.sig = keySigCount(song.key);
    this.pref = song.spelling || null;
    this.raga = song.raga ? RAGA_BY_ID[song.raga] : null;
    this.letterMap = this.raga && !song.spelling ? ragaLetterMap(this.raga, song.sa ?? keyTonicPc(song.key), keyLetter(song.key)) : null;
    this.bpb = beatsPerBar(song.ts);
    const kmap = keyAccidentalMap(this.sig);
    const staffOf = (n) => (this.grand ? (n.h === 'L' ? 'bass' : 'treble') : this.hasR ? 'treble' : 'bass');
    // per-note layout info
    this.info = notes.map((n, i) => {
      const sp = spell(n.m, this.sig, this.pref, this.letterMap);
      return { i, n, sp, staff: staffOf(n), ht: headType(n.d), acc: null, xoff: 0, stem: 0 };
    });
    // accidentals per measure & staff
    ['treble', 'bass'].forEach((st) => {
      let measure = -1, state = {};
      this.info.filter((x) => x.staff === st).sort((a, b) => a.n.t - b.n.t).forEach((x) => {
        const mi = Math.floor(x.n.t / this.bpb + 1e-6);
        if (mi !== measure) { measure = mi; state = {}; }
        const key = x.sp.step;
        const expected = key in state ? state[key] : kmap[x.sp.letter] || 0;
        if (x.sp.acc !== expected) x.acc = x.sp.acc === 1 ? '♯' : x.sp.acc === -1 ? '♭' : x.sp.acc === 0 ? '♮' : x.sp.acc > 1 ? '𝄪' : '𝄫';
        state[key] = x.sp.acc;
      });
    });
    // clusters (same start, same staff) share a stem
    const map = new Map();
    this.info.forEach((x) => { const k = x.staff + '@' + x.n.t.toFixed(3); if (!map.has(k)) map.set(k, []); map.get(k).push(x); });
    this.clusters = [...map.values()].map((xs) => {
      xs.sort((a, b) => a.sp.step - b.sp.step);
      const mid = xs[0].staff === 'treble' ? 34 : 22;
      const avg = xs.reduce((s, x) => s + x.sp.step, 0) / xs.length;
      const up = avg < mid;
      // seconds: offset alternate heads
      for (let k = 1; k < xs.length; k++) if (xs[k].sp.step - xs[k - 1].sp.step === 1 && !xs[k - 1].xoff) xs[k].xoff = up ? 1 : -1;
      const ht = xs.reduce((best, x) => (x.n.d < best.n.d ? x : best), xs[0]).ht;
      return { xs, up, t: xs[0].n.t, staff: xs[0].staff, ht };
    }).sort((a, b) => a.t - b.t);
    this.clusters.forEach((c) => c.xs.forEach((x) => (x.cluster = c)));
    this.sorted = this.info.slice().sort((a, b) => a.n.t - b.n.t);
  }

  geom() {
    const dpr = window.devicePixelRatio || 1;
    const W = this.c.clientWidth || 300, H = this.c.clientHeight || 200;
    if (this.c.width !== Math.round(W * dpr) || this.c.height !== Math.round(H * dpr)) { this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr); }
    const lane = this.labelMode === 'both' && this.hasR ? 1 : 0;
    const chordRow = this.song && this.song.chords && this.song.chords.length ? 1 : 0;
    const rows = this.grand ? 20 + lane * 1.8 + chordRow * 1.2 : 12.5 + lane * 1.8 + chordRow * 1.2;
    const s = Math.max(7, Math.min(this.grand ? 17 : 24, H / rows));
    const top = (H - rows * s) / 2 + (chordRow ? 1.2 * s : 0) + 0.2 * s;
    let trebleY, bassY;
    if (this.grand) { trebleY = top + 3.4 * s; bassY = trebleY + 9 * s; }
    else if (this.hasR) { trebleY = top + 3.6 * s; }
    else { bassY = top + 3.6 * s; }
    const laneY = lane ? (this.grand ? bassY + 4 * s + 3.4 * s : (trebleY ?? bassY) + 4 * s + 3.6 * s) : null;
    const nsig = Math.abs(this.sig);
    const panelW = 3.4 * s + nsig * 0.95 * s + 2.4 * s;
    const playX = panelW + Math.max(36, (W - panelW) * 0.2);
    return { W, H, dpr, s, trebleY, bassY, laneY, chordY: top - 0.6 * s, panelW, playX };
  }

  y(step, staff, G) { return staff === 'treble' ? G.trebleY + (TREBLE_TOP - step) * G.s / 2 : G.bassY + (BASS_TOP - step) * G.s / 2; }

  /**
   * state: {beat, ppb, states: Map(noteIndex → 'hit'|'miss'|'auto'|'wrong'), active: Set(noteIndex), labels, sa,
   *         ghosts:[{m,until}], popups:[{text,color,born}], range:[a,b]|null, handsMask:{R,L}}
   */
  draw(st) {
    if (!this.song) return;
    this.labelMode = st.labels;
    const G = this.geom(); const g = this.g; const s = G.s;
    g.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    g.clearRect(0, 0, G.W, G.H);
    const ppb = st.ppb || Math.max(40, Math.min(s * 6.5, (G.W - G.playX) / 4.5));
    const X = (beat) => G.playX + (beat - st.beat) * ppb;
    const vis0 = st.beat - (G.playX - G.panelW) / ppb - 1, vis1 = st.beat + (G.W - G.playX) / ppb + 0.5;

    // loop range shading
    if (st.range) {
      g.fillStyle = 'rgba(255,255,255,0.035)';
      const a = Math.max(G.panelW, X(st.range[0])), b = Math.min(G.W, X(st.range[1]));
      if (b > a) g.fillRect(a, 0, b - a, G.H);
    }
    // staff lines
    const staves = [];
    if (G.trebleY != null) staves.push(['treble', G.trebleY]);
    if (G.bassY != null) staves.push(['bass', G.bassY]);
    g.strokeStyle = 'rgba(246,241,231,0.42)'; g.lineWidth = Math.max(1, s * 0.07);
    staves.forEach(([, y0]) => { for (let k = 0; k < 5; k++) { const y = y0 + k * s; g.beginPath(); g.moveTo(8, y); g.lineTo(G.W, y); g.stroke(); } });
    // bar lines
    const yTopAll = staves[0][1], yBotAll = staves[staves.length - 1][1] + 4 * s;
    g.strokeStyle = 'rgba(246,241,231,0.32)';
    for (let b = Math.max(0, Math.floor(vis0 / this.bpb)) * this.bpb; b <= vis1; b += this.bpb) {
      const x = X(b) - 0.9 * s; if (x < G.panelW) continue;
      g.beginPath(); g.moveTo(x, yTopAll); g.lineTo(x, yBotAll); g.stroke();
      g.fillStyle = 'rgba(246,241,231,0.35)'; g.font = `600 ${Math.max(9, s * 0.75)}px ui-rounded, system-ui`; g.textAlign = 'left';
      g.fillText(String(Math.round(b / this.bpb) + 1), x + 3, yTopAll - s * 0.5);
    }
    // sections and chords
    g.textAlign = 'left';
    (this.song.sections || []).forEach((sec) => {
      const x = X(sec.t); if (x < G.panelW - 40 || x > G.W) return;
      g.fillStyle = 'rgba(255,182,39,0.9)'; g.font = `800 ${Math.max(10, s * 0.8)}px ui-rounded, system-ui`;
      g.fillText(sec.name.toUpperCase(), Math.max(x - 0.9 * s + Math.max(14, s * 1.4), G.panelW + 2), yTopAll - s * 0.5);
    });
    (this.song.chords || []).forEach((c) => {
      const x = X(c.t); if (x < G.panelW - 30 || x > G.W) return;
      const on = st.beat >= c.t - 0.05 && st.beat < c.t + c.d - 0.05;
      g.fillStyle = on ? COLORS.L : 'rgba(46,196,182,0.75)'; g.font = `800 ${Math.max(11, s * 1.0)}px ui-rounded, system-ui`;
      g.fillText(c.name, x - 0.5 * s, G.chordY);
    });

    // notes
    const items = this.sorted;
    let lo = 0, hi = items.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (items[mid].n.t + items[mid].n.d < vis0 - 8) lo = mid + 1; else hi = mid; }
    const drawn = [];
    for (let k = lo; k < items.length; k++) {
      const x = items[k]; if (x.n.t > vis1) break;
      if (x.n.t + x.n.d < vis0) continue;
      drawn.push(x);
    }
    const colorOf = (x) => {
      const state = st.states.get(x.i);
      if (st.active.has(x.i)) return x.n.h === 'L' ? COLORS.L : COLORS.R;
      if (state === 'hit') return COLORS.good;
      if (state === 'miss') return COLORS.bad;
      if (state === 'auto' || (st.handsMask && !st.handsMask[x.n.h])) return 'rgba(246,241,231,0.38)';
      return '#F6F1E7';
    };
    // duration bars
    drawn.forEach((x) => {
      const x0 = X(x.n.t), x1 = X(x.n.t + x.n.d) - 0.9 * s;
      if (x1 - x0 < s * 1.4) return;
      const y = this.y(x.sp.step, x.staff, G);
      g.globalAlpha = st.active.has(x.i) ? 0.45 : 0.18; g.fillStyle = colorOf(x);
      roundRect(g, x0, y - 0.28 * s, x1 - x0, 0.56 * s, 0.28 * s); g.fill(); g.globalAlpha = 1;
    });
    // ledger lines
    g.strokeStyle = 'rgba(246,241,231,0.55)'; g.lineWidth = Math.max(1, s * 0.08);
    drawn.forEach((x) => {
      const cx = X(x.n.t) + x.xoff * 1.15 * s; const st0 = x.sp.step;
      const ledg = [];
      if (x.staff === 'treble') { for (let q = 28; q >= st0; q -= 2) ledg.push(q); for (let q = 40; q <= st0; q += 2) ledg.push(q); }
      else { for (let q = 16; q >= st0; q -= 2) ledg.push(q); for (let q = 28; q <= st0; q += 2) ledg.push(q); }
      ledg.forEach((q) => { const y = this.y(q, x.staff, G); g.beginPath(); g.moveTo(cx - 1.0 * s, y); g.lineTo(cx + 1.0 * s, y); g.stroke(); });
    });
    // stems & flags per cluster
    const seen = new Set();
    drawn.forEach((x) => {
      const c = x.cluster; if (seen.has(c)) return; seen.add(c);
      if (c.ht.kind === 'whole') return;
      const xs = c.xs; const col = colorOf(xs[0]);
      const cx = X(c.t);
      const yLo = this.y(xs[0].sp.step, c.staff, G), yHi = this.y(xs[xs.length - 1].sp.step, c.staff, G);
      const sx = c.up ? cx + 0.58 * s : cx - 0.58 * s;
      const yStart = c.up ? yLo : yHi;
      const yEnd = c.up ? Math.min(yHi - 3.3 * s, (c.staff === 'treble' ? G.trebleY : G.bassY) + 2 * s) : Math.max(yLo + 3.3 * s, (c.staff === 'treble' ? G.trebleY : G.bassY) + 2 * s);
      g.strokeStyle = col; g.lineWidth = Math.max(1.2, s * 0.12);
      g.beginPath(); g.moveTo(sx, yStart); g.lineTo(sx, yEnd); g.stroke();
      const flags = c.ht.kind === 'eighth' ? 1 : c.ht.kind === 'sixteenth' ? 2 : 0;
      g.fillStyle = col;
      for (let f = 0; f < flags; f++) {
        const dir = c.up ? 1 : -1; const fy = yEnd + dir * f * 0.85 * s;
        g.beginPath(); g.moveTo(sx, fy);
        g.bezierCurveTo(sx + 0.2 * s, fy + dir * 1.0 * s, sx + 1.3 * s, fy + dir * 1.3 * s, sx + 0.9 * s, fy + dir * 2.6 * s);
        g.bezierCurveTo(sx + 1.0 * s, fy + dir * 1.7 * s, sx + 0.4 * s, fy + dir * 1.35 * s, sx, fy + dir * 1.1 * s);
        g.closePath(); g.fill();
      }
    });
    // heads, accidentals, dots, labels
    const headRX = 0.66 * s, headRY = 0.47 * s;
    drawn.forEach((x) => {
      const cx = X(x.n.t) + x.xoff * 1.15 * s; const y = this.y(x.sp.step, x.staff, G);
      const col = colorOf(x); const active = st.active.has(x.i);
      if (active) { g.shadowColor = col; g.shadowBlur = s * 1.2; }
      g.fillStyle = col; g.strokeStyle = col;
      g.save(); g.translate(cx, y); g.rotate(-0.33);
      g.beginPath(); g.ellipse(0, 0, headRX, headRY, 0, 0, Math.PI * 2);
      const hollow = x.cluster.ht.kind === 'half' || x.cluster.ht.kind === 'whole';
      if (hollow) { g.lineWidth = Math.max(1.4, s * 0.17); g.stroke(); } else g.fill();
      g.restore(); g.shadowBlur = 0;
      if (x.acc) { g.fillStyle = col; g.font = `${1.7 * s}px "Apple Symbols", "Noto Music", "Segoe UI Symbol", serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(x.acc, cx - 1.55 * s, y + (x.acc === '♭' ? -0.15 * s : 0)); }
      if (x.cluster.ht.dot) { g.fillStyle = col; g.beginPath(); g.arc(cx + 1.05 * s, y - (x.sp.step % 2 === (x.staff === 'treble' ? 0 : 0) ? 0.25 * s : 0), 0.17 * s, 0, 7); g.fill(); }
      const lab = st.labels === 'letters' || st.labels === 'both' ? x.sp.letter : st.labels === 'sargam' ? swaraName(x.n.m, st.sa, this.raga)[0] : null;
      if (lab && s >= 9) {
        g.fillStyle = hollow ? col : '#16112B'; g.font = `800 ${Math.round(0.78 * s)}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(lab, cx, y + 0.04 * s);
      }
      if (x.n.f && s >= 9) { g.fillStyle = 'rgba(246,241,231,0.85)'; g.font = `700 ${Math.round(0.8 * s)}px ui-rounded, system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(x.n.f), cx, x.cluster.up ? y + 1.35 * s : y - 1.35 * s); }
      if (G.laneY != null && x.n.h === 'R' && x === x.cluster.xs[x.cluster.xs.length - 1]) {
        g.fillStyle = active ? COLORS.R : 'rgba(255,182,39,0.75)'; g.font = `700 ${Math.round(0.95 * s)}px ui-rounded, system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(swaraLabel(x.n.m, st.sa, this.raga, true), cx, G.laneY);
      }
      g.textBaseline = 'alphabetic';
    });
    // rests (from notation)
    (this.song.rests || []).forEach((r) => {
      if (r.t > vis1 || r.t + r.d < vis0) return;
      const staff = this.grand ? (r.h === 'L' ? 'bass' : 'treble') : this.hasR ? 'treble' : 'bass';
      const y0 = staff === 'treble' ? G.trebleY : G.bassY; const cx = X(r.t);
      g.fillStyle = 'rgba(246,241,231,0.7)'; g.strokeStyle = 'rgba(246,241,231,0.7)';
      if (r.d >= 3.75) g.fillRect(cx - 0.6 * s, y0 + 1 * s, 1.2 * s, 0.5 * s);
      else if (r.d >= 1.75) g.fillRect(cx - 0.6 * s, y0 + 1.5 * s, 1.2 * s, 0.5 * s);
      else if (r.d >= 0.875) { // quarter rest zig-zag
        g.lineWidth = s * 0.22; g.lineCap = 'round'; g.beginPath();
        g.moveTo(cx - 0.3 * s, y0 + 0.6 * s); g.lineTo(cx + 0.35 * s, y0 + 1.4 * s); g.lineTo(cx - 0.3 * s, y0 + 2.1 * s); g.lineTo(cx + 0.35 * s, y0 + 2.9 * s);
        g.quadraticCurveTo(cx - 0.6 * s, y0 + 2.6 * s, cx + 0.1 * s, y0 + 3.5 * s); g.stroke(); g.lineCap = 'butt';
      } else { g.beginPath(); g.arc(cx - 0.2 * s, y0 + 1.6 * s, 0.25 * s, 0, 7); g.fill(); g.lineWidth = s * 0.14; g.beginPath(); g.moveTo(cx - 0.2 * s, y0 + 1.75 * s); g.lineTo(cx + 0.45 * s, y0 + 1.5 * s); g.lineTo(cx, y0 + 3 * s); g.stroke(); }
    });
    // wrong-note ghosts at the playhead
    const nowMs = performance.now();
    (st.ghosts || []).forEach((gh) => {
      if (gh.until < nowMs) return;
      const sp = spell(gh.m, this.sig, this.pref, this.letterMap);
      const staff = this.grand ? (gh.m >= 60 ? 'treble' : 'bass') : this.hasR ? 'treble' : 'bass';
      const y = this.y(sp.step, staff, G);
      g.globalAlpha = Math.min(1, (gh.until - nowMs) / 250);
      g.strokeStyle = COLORS.bad; g.lineWidth = s * 0.2;
      g.save(); g.translate(G.playX, y); g.rotate(-0.33); g.beginPath(); g.ellipse(0, 0, headRX, headRY, 0, 0, 7); g.stroke(); g.restore();
      g.fillStyle = COLORS.bad; g.font = `800 ${Math.round(0.9 * s)}px ui-rounded, system-ui`; g.textAlign = 'left'; g.fillText(sp.letter + (sp.acc === 1 ? '♯' : sp.acc === -1 ? '♭' : ''), G.playX + 1.1 * s, y + 0.3 * s);
      g.globalAlpha = 1;
    });
    // fixed left panel with clefs / key / time signature
    const grd = g.createLinearGradient(G.panelW - 4, 0, G.panelW + 26, 0);
    grd.addColorStop(0, 'rgba(22,17,43,1)'); grd.addColorStop(1, 'rgba(22,17,43,0)');
    g.fillStyle = '#16112B'; g.fillRect(0, 0, G.panelW - 4, G.H);
    g.fillStyle = grd; g.fillRect(G.panelW - 4, 0, 30, G.H);
    g.strokeStyle = 'rgba(246,241,231,0.42)'; g.lineWidth = Math.max(1, s * 0.07);
    staves.forEach(([, y0]) => { for (let k = 0; k < 5; k++) { const y = y0 + k * s; g.beginPath(); g.moveTo(8, y); g.lineTo(G.panelW, y); g.stroke(); } });
    if (this.grand) { // brace line
      g.lineWidth = s * 0.18; g.beginPath(); g.moveTo(8, G.trebleY); g.lineTo(8, G.bassY + 4 * s); g.stroke();
    }
    g.fillStyle = '#F6F1E7'; g.strokeStyle = '#F6F1E7';
    if (G.trebleY != null) drawTreble(g, 10 + 1.2 * s, G.trebleY + 3 * s, s);
    if (G.bassY != null) drawBass(g, 10 + 0.4 * s, G.bassY + 1 * s, s);
    const n = Math.abs(this.sig);
    g.font = `${1.7 * s}px "Apple Symbols", "Noto Music", "Segoe UI Symbol", serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    staves.forEach(([staff]) => {
      const steps = KEYSIG_STEPS[staff][this.sig > 0 ? 'sharp' : 'flat'];
      for (let k = 0; k < n; k++) g.fillText(this.sig > 0 ? '♯' : '♭', 10 + 3.5 * s + k * 0.95 * s, this.y(steps[k], staff, G) + (this.sig < 0 ? -0.15 * s : 0));
    });
    const ts = this.song.ts || [4, 4];
    g.font = `900 ${2.1 * s}px Georgia, "Times New Roman", serif`; g.textBaseline = 'middle';
    staves.forEach(([, y0]) => {
      const tx = 10 + 3.6 * s + n * 0.95 * s + 0.6 * s;
      g.fillText(String(ts[0]), tx, y0 + 1 * s + 0.05 * s); g.fillText(String(ts[1]), tx, y0 + 3 * s + 0.05 * s);
    });
    g.textBaseline = 'alphabetic';
    // playhead
    const pg = g.createLinearGradient(G.playX - 14, 0, G.playX + 14, 0);
    pg.addColorStop(0, 'rgba(255,182,39,0)'); pg.addColorStop(0.5, 'rgba(255,182,39,0.16)'); pg.addColorStop(1, 'rgba(255,182,39,0)');
    g.fillStyle = pg; g.fillRect(G.playX - 14, yTopAll - 2.5 * s, 28, yBotAll - yTopAll + 5 * s);
    g.strokeStyle = 'rgba(255,182,39,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(G.playX, yTopAll - 2.5 * s); g.lineTo(G.playX, yBotAll + 2.5 * s); g.stroke();
    // feedback popups
    (st.popups || []).forEach((p) => {
      const age = (nowMs - p.born) / 900; if (age > 1) return;
      g.globalAlpha = 1 - age; g.fillStyle = p.color; g.font = `900 ${Math.max(14, s * 1.4)}px ui-rounded, system-ui`; g.textAlign = 'center';
      g.fillText(p.text, G.playX, Math.max(16, yTopAll - 2.8 * s - age * 18)); g.globalAlpha = 1;
    });
    this.lastG = G;
  }
}

// ---------- clef drawings (paths, so they render identically on every device) ----------
function drawTreble(g, x, yG, s) {
  // yG = y of the G4 line; units of staff spaces, y down
  const P = (px, py) => [x + px * s, yG + py * s];
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = s * 0.2;
  g.beginPath();
  g.moveTo(...P(0.45, -0.45));
  g.bezierCurveTo(...P(0.05, -0.85), ...P(-0.85, -0.55), ...P(-0.85, 0.2));
  g.bezierCurveTo(...P(-0.85, 0.95), ...P(-0.2, 1.25), ...P(0.3, 1.2));
  g.bezierCurveTo(...P(0.95, 1.12), ...P(1.25, 0.6), ...P(1.15, 0.05));
  g.bezierCurveTo(...P(1.05, -0.6), ...P(0.3, -0.85), ...P(-0.05, -1.4));
  g.bezierCurveTo(...P(-0.5, -2.1), ...P(-0.6, -2.9), ...P(-0.3, -3.7));
  g.bezierCurveTo(...P(-0.05, -4.35), ...P(0.45, -4.75), ...P(0.55, -4.25));
  g.bezierCurveTo(...P(0.7, -3.6), ...P(0.25, -3.0), ...P(-0.05, -2.6));
  g.bezierCurveTo(...P(-0.15, -1.4), ...P(0.45, 0.6), ...P(0.5, 2.1));
  g.bezierCurveTo(...P(0.55, 2.75), ...P(-0.15, 2.95), ...P(-0.35, 2.45));
  g.stroke();
  g.lineWidth = s * 0.34; // thicken the bowl
  g.beginPath(); g.moveTo(...P(-0.8, 0.0)); g.bezierCurveTo(...P(-0.85, 0.85), ...P(-0.25, 1.2), ...P(0.25, 1.18)); g.stroke();
  g.beginPath(); g.arc(...P(-0.15, 2.3), s * 0.32, 0, 7); g.fill();
  g.restore();
}
function drawBass(g, x, yF, s) {
  // yF = y of the F3 line (second from top)
  const P = (px, py) => [x + px * s, yF + py * s];
  g.save(); g.lineCap = 'round';
  g.beginPath(); g.arc(...P(0.35, 0.05), s * 0.36, 0, 7); g.fill();
  g.lineWidth = s * 0.3;
  g.beginPath(); g.moveTo(...P(0.1, -0.15));
  g.bezierCurveTo(...P(0.25, -1.0), ...P(1.7, -1.15), ...P(1.85, -0.1));
  g.bezierCurveTo(...P(1.95, 1.0), ...P(1.0, 2.0), ...P(0.05, 2.5));
  g.stroke();
  g.beginPath(); g.arc(...P(2.45, -0.5), s * 0.17, 0, 7); g.fill();
  g.beginPath(); g.arc(...P(2.45, 0.5), s * 0.17, 0, 7); g.fill();
  g.restore();
}
