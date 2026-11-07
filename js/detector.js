// Microphone note detection.
//  • single notes: YIN pitch tracking on a short window (accurate, fast)
//  • chords: checks the spectrum for the *expected* notes (template matching — far more reliable than open transcription)
//  • onsets: level jumps, so repeated notes are recognised
// The pure functions (yin, notesPresent, segmentFrames) are exported for testing.
import { midiToFreq, freqToMidi, pc } from './theory.js';
import { getCtx, setSession } from './audio.js';

/** YIN fundamental-frequency estimator. Returns {freq, clarity} or null. */
export function yin(buf, sr, { threshold = 0.15, minF = 60, maxF = 1400, scratch = null } = {}) {
  const maxTau = Math.min(Math.floor(sr / minF), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sr / maxF));
  const W = buf.length - maxTau;
  if (W < 64) return null;
  const d = scratch && scratch.length > maxTau ? scratch : new Float32Array(maxTau + 1);
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + tau]; s += x * x; }
    running += s;
    d[tau] = running > 0 ? (s * tau) / running : 1;
  }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t; break;
    }
  }
  if (tau < 0) { // no dip under threshold: take global minimum if it is reasonably low
    let best = 1, bt = -1;
    for (let t = minTau; t <= maxTau; t++) if (d[t] < best) { best = d[t]; bt = t; }
    if (best > 0.35) return null;
    tau = bt;
  }
  let betterTau = tau;
  if (tau > 1 && tau < maxTau) {
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const den = a + c - 2 * b;
    if (den !== 0) betterTau = tau + (a - c) / (2 * den);
  }
  return { freq: sr / betterTau, clarity: 1 - d[tau] };
}

/**
 * Are the expected notes present in a magnitude spectrum?
 * @param {Float32Array} mags linear magnitudes  @param {number} binHz  @param {number[]} midis
 * @returns {{ok:boolean, found:number, need:number, detail:boolean[]}}
 */
export function notesPresent(mags, binHz, midis, { lenient = true, rel = 0.035, snr = 7, allowMissing = null } = {}) {
  const maxBin = Math.min(mags.length - 1, Math.floor(4200 / binHz));
  const minBin = Math.max(1, Math.floor(70 / binHz));
  let gmax = 0;
  const sample = [];
  for (let b = minBin; b <= maxBin; b++) { const v = mags[b]; if (v > gmax) gmax = v; if ((b & 7) === 0) sample.push(v); }
  sample.sort((a, b) => a - b);
  const floor = sample[Math.floor(sample.length / 2)] || 1e-9;
  const peakAt = (f) => {
    const lo = Math.max(1, Math.floor((f * 0.986) / binHz)), hi = Math.min(maxBin, Math.ceil((f * 1.014) / binHz));
    let p = 0; for (let b = lo; b <= hi; b++) if (mags[b] > p) p = mags[b];
    // must be a local peak, not the skirt of a neighbouring note
    const l2 = Math.max(1, lo - 2), h2 = Math.min(maxBin, hi + 2);
    const edge = Math.max(mags[l2], mags[h2]);
    return p > edge * 1.05 ? p : 0;
  };
  const strong = (m) => {
    const f = midiToFreq(m);
    const a = peakAt(f);
    return a > floor * snr && a > gmax * rel;
  };
  const exact = midis.map(strong);
  // an octave-shifted match only counts if it isn't just an overtone of another note that is sounding
  const funds = midis.filter((_, i) => exact[i]).map(midiToFreq);
  const overtone = (m) => {
    const f = midiToFreq(m);
    return funds.some((f0) => { const h = f / f0, r = Math.round(h); return r >= 2 && r <= 8 && Math.abs(h - r) / r < 0.015; });
  };
  const detail = midis.map((m, i) => exact[i] || (lenient && [m - 12, m + 12].some((c) => strong(c) && !overtone(c))));
  const found = detail.filter(Boolean).length;
  const need = midis.length - (allowMissing ?? (midis.length >= 4 ? 1 : 0));
  return { ok: gmax > 0 && found >= need, found, need, detail };
}

export class MicDetector {
  constructor() { this.running = false; this.gateDb = -48; this.listeners = new Set(); }

  async start() {
    if (this.running) return;
    const ctx = getCtx();
    setSession('play-and-record');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* */ } }
    this.src = ctx.createMediaStreamSource(this.stream);
    this.hp = ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 55;
    this.aT = ctx.createAnalyser(); this.aT.fftSize = 2048; this.aT.smoothingTimeConstant = 0;
    this.aF = ctx.createAnalyser(); this.aF.fftSize = 16384; this.aF.smoothingTimeConstant = 0;
    this.src.connect(this.hp); this.hp.connect(this.aT); this.hp.connect(this.aF);
    this.sr = ctx.sampleRate;
    this.buf = new Float32Array(this.aT.fftSize);
    this.spec = new Float32Array(this.aF.frequencyBinCount);
    this.mags = new Float32Array(this.aF.frequencyBinCount);
    this.scratch = new Float32Array(2048);
    this.binHz = this.sr / this.aF.fftSize;
    this.hist = []; this.lastOnset = 0; this.prevMidi = null; this.stableCount = 0;
    this.running = true;
    this.last = { db: -100, midi: null, stable: null, freq: 0, clarity: 0, onset: false, t: 0 };
  }

  stop() {
    this.running = false;
    try { this.stream && this.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* */ }
    try { this.src && this.src.disconnect(); } catch (e) { /* */ }
    this.stream = null; setSession('playback');
  }

  /** call once per animation frame */
  frame() {
    if (!this.running) return this.last;
    const ctx = getCtx();
    const t = ctx.currentTime;
    this.aT.getFloatTimeDomainData(this.buf);
    let s = 0; for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(s / this.buf.length);
    const db = 20 * Math.log10(rms + 1e-9);
    // onset: a sharp rise (≥2.5 dB since the previous frame) that ends ≥6 dB above the recent minimum, above the gate
    const prevDb = this.hist.length ? this.hist[this.hist.length - 1] : -100;
    this.hist.push(db); if (this.hist.length > 8) this.hist.shift();
    const recentMin = Math.min(...this.hist.slice(0, -1));
    let onset = false;
    if (db > this.gateDb && db - prevDb >= 2.5 && db - recentMin > 6 && t - this.lastOnset > 0.1) { onset = true; this.lastOnset = t; }
    let midi = null, freq = 0, clarity = 0;
    if (db > this.gateDb) {
      const r = yin(this.buf, this.sr, { scratch: this.scratch });
      if (r && r.clarity > 0.82 && r.freq > 50 && r.freq < 2100) {
        freq = r.freq; clarity = r.clarity;
        midi = Math.round(freqToMidi(r.freq));
      }
    }
    if (midi != null && midi === this.prevMidi) this.stableCount++; else this.stableCount = midi != null ? 1 : 0;
    // a new stable pitch also counts as an onset (legato playing)
    if (midi != null && this.stableCount === 2 && this.last.stable !== midi) { onset = onset || t - this.lastOnset > 0.08; if (onset) this.lastOnset = t; }
    this.prevMidi = midi;
    const stable = this.stableCount >= 2 ? midi : null;
    if (stable != null && this.stableCount === 2) this.stableSince = t;
    if (stable == null) this.stableSince = null;
    this.last = { db, rms, midi, stable, stableSince: this.stableSince, freq, clarity, onset, t, cents: freq ? (freqToMidi(freq) - Math.round(freqToMidi(freq))) * 100 : 0 };
    this.listeners.forEach((fn) => fn(this.last));
    return this.last;
  }

  /** check that all expected notes sound right now (uses a long FFT for chord resolution) */
  present(midis, lenient = true) {
    if (!this.running) return { ok: false, found: 0, need: midis.length };
    this.aF.getFloatFrequencyData(this.spec);
    const n = Math.min(this.spec.length, Math.ceil(4300 / this.binHz));
    for (let i = 0; i < n; i++) this.mags[i] = Math.pow(10, this.spec[i] / 20);
    return notesPresent(this.mags.subarray(0, n), this.binHz, midis, { lenient });
  }
}

// ---------- Turning a stream of pitch frames into notes (for "Listen & draft" and "Play it in") ----------

/**
 * frames: [{t (seconds, original-song time), midi (float or null), db}]
 * returns notes [{t, d, m}] in seconds
 */
export function segmentFrames(frames, { minDur = 0.09, gateDb = -50, onsets = [] } = {}) {
  if (!frames.length) return [];
  // 1) median-smooth the pitch track (5 frames) and round to semitones
  const raw = frames.map((f) => (f.midi != null && f.db > gateDb ? f.midi : null));
  const sm = raw.map((_, i) => {
    const w = [];
    for (let k = -2; k <= 2; k++) { const v = raw[i + k]; if (v != null) w.push(v); }
    if (raw[i] == null && w.length < 3) return null;
    if (!w.length) return null;
    w.sort((a, b) => a - b);
    return Math.round(w[Math.floor(w.length / 2)]);
  });
  // 2) runs of equal semitone
  let segs = [];
  let cur = null;
  const onsetSet = onsets.slice().sort((a, b) => a - b);
  let oi = 0;
  for (let i = 0; i < frames.length; i++) {
    const t = frames[i].t, m = sm[i];
    let hit = false; while (oi < onsetSet.length && onsetSet[oi] <= t) { hit = true; oi++; }
    if (m == null) { if (cur) { cur.end = t; segs.push(cur); cur = null; } continue; }
    if (cur && cur.m === m && !hit) { cur.end = t; continue; }
    if (cur) { cur.end = t; segs.push(cur); }
    cur = { start: t, end: t, m };
  }
  if (cur) { cur.end = frames[frames.length - 1].t; segs.push(cur); }
  const dt = frames.length > 1 ? (frames[frames.length - 1].t - frames[0].t) / (frames.length - 1) : 0.016;
  segs.forEach((s) => (s.end += dt));
  // 3) absorb short blips (gamaka wiggles, consonants) into the longer neighbour
  let changed = true;
  while (changed && segs.length > 1) {
    changed = false;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s.end - s.start >= minDur) continue;
      const L = segs[i - 1], R = segs[i + 1];
      const touchL = L && s.start - L.end < 0.03, touchR = R && R.start - s.end < 0.03;
      if (!touchL && !touchR) { segs.splice(i, 1); changed = true; break; }
      const tgt = touchL && touchR ? (L.end - L.start >= R.end - R.start ? L : R) : touchL ? L : R;
      tgt.start = Math.min(tgt.start, s.start); tgt.end = Math.max(tgt.end, s.end);
      segs.splice(i, 1); changed = true; break;
    }
  }
  // 4) merge neighbours that ended up with the same pitch and touch
  const out = [];
  segs.forEach((s) => {
    const p = out[out.length - 1];
    if (p && p.m === s.m && s.start - p.end < 0.03 && !onsetSet.some((o) => o > p.end - 0.02 && o < s.start + 0.04)) p.end = s.end;
    else out.push({ ...s });
  });
  return out.filter((s) => s.end - s.start >= minDur * 0.8).map((s) => ({ t: s.start, d: s.end - s.start, m: s.m }));
}

/** Snap pitches to a scale (pitch-class set relative to Sa). */
export function snapToScale(notes, saPc, semis) {
  if (!semis || !semis.length) return notes;
  const set = semis.map((s) => pc(s + saPc));
  return notes.map((n) => {
    if (set.includes(pc(n.m))) return n;
    for (let k = 1; k <= 2; k++) {
      if (set.includes(pc(n.m - k))) return { ...n, m: n.m - k };
      if (set.includes(pc(n.m + k))) return { ...n, m: n.m + k };
    }
    return n;
  });
}

/** Move a melody by whole octaves so it sits around the right-hand range (C4–C6). */
export function fitOctave(notes, target = 69) {
  if (!notes.length) return { notes, shift: 0 };
  const ms = notes.map((n) => n.m).sort((a, b) => a - b);
  const med = ms[Math.floor(ms.length / 2)];
  const shift = Math.round((target - med) / 12) * 12;
  return { notes: notes.map((n) => ({ ...n, m: n.m + shift })), shift };
}

/** Estimate tempo from note onsets (seconds). Returns BPM in 60–160. */
export function estimateBpm(onsets) {
  if (onsets.length < 4) return 90;
  let best = 90, bestScore = -1;
  for (let bpm = 60; bpm <= 160; bpm += 1) {
    const beat = 60 / bpm;
    let score = 0;
    onsets.forEach((t) => {
      const ph = (t / (beat / 2)) % 1; const dist = Math.min(ph, 1 - ph); // half-beat grid
      score += Math.exp(-(dist * dist) / 0.01);
    });
    score *= 1 + 0.15 * Math.exp(-((bpm - 95) ** 2) / 800); // mild prior towards typical film-song tempi
    if (score > bestScore) { bestScore = score; best = bpm; }
  }
  return best;
}

/** seconds → beats and quantise */
export function toBeats(notes, bpm, { grid = 0.25, origin = 0 } = {}) {
  const spb = 60 / bpm;
  const out = notes.map((n) => {
    const t = Math.max(0, Math.round((n.t - origin) / spb / grid) * grid);
    const e = Math.round((n.t + n.d - origin) / spb / grid) * grid;
    return { t, d: Math.max(grid, e - t), m: n.m, h: 'R' };
  });
  // remove collisions after quantising (keep the longer one), and trim overlaps
  out.sort((a, b) => a.t - b.t || b.d - a.d);
  const res = [];
  out.forEach((n) => { const p = res[res.length - 1]; if (p && Math.abs(p.t - n.t) < 1e-6) return; res.push(n); });
  for (let i = 0; i < res.length - 1; i++) {
    const gap = res[i + 1].t - (res[i].t + res[i].d);
    if (gap < 0) res[i].d = Math.max(grid, res[i + 1].t - res[i].t);
    else if (gap <= 0.5 + 1e-6) res[i].d += gap; // small gaps are just finger lift / decay → join (legato)
  }
  return res;
}
