import assert from 'node:assert/strict';
import { yin, notesPresent, segmentFrames, toBeats, estimateBpm, snapToScale } from '../js/detector.js';
import { midiToFreq } from '../js/theory.js';
const SR = 48000;
function tone(midis, secs, { fund = 1, noise = 0.003, seed = 1 } = {}) {
  const N = Math.floor(SR * secs); const out = new Float32Array(N);
  let r = seed; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5);
  midis.forEach((m, k) => {
    const f0 = midiToFreq(m);
    for (let h = 1; h <= 10; h++) {
      const B = 0.0004; const fh = h * f0 * Math.sqrt(1 + B * h * h); // piano inharmonicity
      const a = (h === 1 ? fund : 1) * 0.5 / Math.pow(h, 1.1);
      const ph = rnd() * 6.28;
      for (let i = 0; i < N; i++) out[i] += a * Math.sin(2 * Math.PI * fh * i / SR + ph) * Math.exp(-i / SR * (1.5 + h * 0.3)) * 0.2;
    }
  });
  for (let i = 0; i < N; i++) out[i] += noise * rnd();
  return out;
}
function fftMag(x) { // Blackman + radix-2, like AnalyserNode
  const N = x.length; const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) { const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N); re[i] = x[i] * w; }
  for (let i = 1, j = 0; i < N; i++) { let b = N >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= N; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < N; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k); const ur = re[i + k], ui = im[i + k]; const vr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, vi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; } }
  const mags = new Float32Array(N / 2); for (let i = 0; i < N / 2; i++) mags[i] = Math.hypot(re[i], im[i]) / N; return mags;
}
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) pass++; else { fail++; console.log('✗', name); } };

// YIN across the keyboard, incl. weak fundamentals
for (const m of [43, 48, 52, 55, 60, 64, 67, 69, 72, 76, 79, 84, 88]) {
  for (const fund of [1, 0.3]) {
    const x = tone([m], 0.3, { fund }); const w = x.subarray(2400, 2400 + 2048);
    const r = yin(w, SR); const got = r ? Math.round(69 + 12 * Math.log2(r.freq / 440)) : null;
    check(`yin m${m} fund${fund} got ${got}`, got === m);
  }
}
// chords
const binHz = SR / 16384;
const cases = [
  [[60, 64, 67], [60, 64, 67], true], [[60], [60, 64, 67], false], [[60, 64], [60, 64, 67], false],
  [[48, 52, 55], [48, 52, 55], true], [[57, 60, 64], [57, 60, 64], true], [[53, 57, 60], [53, 57, 60], true],
  [[55, 59, 62], [55, 59, 62], true], [[61, 64, 67], [60, 64, 67], false], [[60, 63, 67], [60, 64, 67], false],
  [[48, 52, 55, 58], [48, 52, 55, 58], true], [[64, 67, 72], [60, 64, 67], true], // inversion ok when lenient
];
for (const [played, expect, want] of cases) {
  const x = tone(played, 0.6, { fund: 0.6 }); const w = x.subarray(4800, 4800 + 16384);
  const r = notesPresent(fftMag(w), binHz, expect, { lenient: true });
  check(`chord played ${played} expect ${expect} → ${r.ok} (found ${r.found})`, r.ok === want);
}
// strict octave
{ const x = tone([72], 0.6); const r = notesPresent(fftMag(x.subarray(4800, 4800 + 16384)), binHz, [60], { lenient: false }); check('strict octave rejects C5 for C4', !r.ok); }

// segmentation of a jittery "sung" line
{
  const frames = []; const seq = [[0, 0.5, 67], [0.5, 0.5, 69], [1.0, 1.0, 71], [2.0, 0.5, 69]];
  for (let t = 0; t < 2.5; t += 0.016) {
    const n = seq.find((s) => t >= s[0] && t < s[0] + s[1]);
    let midi = n[2] + (Math.random() - 0.5) * 0.5; if (Math.random() < 0.05) midi += 1; // gamaka blips
    frames.push({ t, midi, db: -30 });
  }
  const seg = segmentFrames(frames);
  check(`segments ${seg.map((s) => s.m)}`, seg.map((s) => s.m).join() === '67,69,71,69');
  const b = toBeats(seg, 120);
  check(`beats ${b.map((n) => n.t + '/' + n.d)}`, b.map((n) => n.t).join() === '0,1,2,4');
}
check('bpm', Math.abs(estimateBpm([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.25, 3.5, 4]) - 120) <= 2 || estimateBpm([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.25, 3.5, 4]) === 60);
check('snap', snapToScale([{ m: 61 }], 0, [0, 2, 4, 5, 7, 9, 11])[0].m === 60);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
