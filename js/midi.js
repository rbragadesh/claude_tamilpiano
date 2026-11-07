// Standard MIDI File (type 0/1) parser + conversion into a practice song.
import { detectKey, keyTonicPc } from './theory.js';

export function parseMidi(buffer) {
  const v = new DataView(buffer);
  let p = 0;
  const str4 = () => String.fromCharCode(v.getUint8(p), v.getUint8(p + 1), v.getUint8(p + 2), v.getUint8(p + 3));
  const u32 = () => { const x = v.getUint32(p); p += 4; return x; };
  const u16 = () => { const x = v.getUint16(p); p += 2; return x; };
  const u8 = () => v.getUint8(p++);
  const vlq = () => { let x = 0, b; do { b = u8(); x = (x << 7) | (b & 0x7f); } while (b & 0x80); return x; };

  // Some files carry a RIFF wrapper
  if (str4() === 'RIFF') { p = 20; }
  if (str4() !== 'MThd') throw new Error('Not a MIDI file');
  p += 4;
  const hlen = u32();
  const format = u16(), ntrks = u16();
  let division = u16();
  p += hlen - 6;
  if (division & 0x8000) division = 480; // SMPTE timing — rare; treat as 480 ticks/quarter
  const tracks = [], tempos = [], timeSigs = [], keySigs = [];
  for (let ti = 0; ti < ntrks && p < v.byteLength - 8; ti++) {
    const id = str4(); p += 4;
    const len = u32();
    const end = p + len;
    if (id !== 'MTrk') { p = end; ti--; continue; }
    let tick = 0, run = 0, name = '';
    const events = [];
    while (p < end) {
      tick += vlq();
      let status;
      const b = v.getUint8(p);
      if (b & 0x80) { status = b; p++; if (b < 0xf0) run = b; } else status = run; // running status (channel messages only)
      if (status === 0xff) {
        const type = u8(); const l = vlq(); const dstart = p;
        if (type === 0x51 && l === 3) tempos.push({ tick, us: (v.getUint8(p) << 16) | (v.getUint8(p + 1) << 8) | v.getUint8(p + 2) });
        else if (type === 0x58 && l >= 2) timeSigs.push({ tick, num: v.getUint8(p), den: 1 << v.getUint8(p + 1) });
        else if (type === 0x59 && l === 2) keySigs.push({ tick, sf: v.getInt8(p), mi: v.getUint8(p + 1) });
        else if ((type === 0x03 || type === 0x04) && !name) { let s = ''; for (let k = 0; k < l; k++) s += String.fromCharCode(v.getUint8(p + k)); name = s.trim(); }
        p = dstart + l;
        if (type === 0x2f) break;
      } else if (status === 0xf0 || status === 0xf7) {
        const l = vlq(); p += l;
      } else {
        const hi = status & 0xf0, ch = status & 0x0f;
        const d1 = u8();
        const d2 = hi === 0xc0 || hi === 0xd0 ? 0 : u8();
        if (hi === 0x90 && d2 > 0) events.push({ tick, on: true, ch, m: d1, vel: d2 });
        else if (hi === 0x80 || (hi === 0x90 && d2 === 0)) events.push({ tick, on: false, ch, m: d1 });
        else if (hi === 0xc0) events.push({ tick, prog: d1, ch });
      }
    }
    p = end;
    tracks.push({ name, events });
  }
  return { format, division, tracks, tempos, timeSigs, keySigs };
}

/** Split a parsed MIDI into playable parts (one per track+channel). Beats are quarter notes. */
export function extractParts(midi) {
  const parts = [];
  midi.tracks.forEach((tr, ti) => {
    const open = new Map();
    const byCh = new Map();
    let lastTick = 0;
    tr.events.forEach((e) => {
      lastTick = Math.max(lastTick, e.tick);
      if (e.prog != null) return;
      const k = e.ch * 128 + e.m;
      if (e.on) {
        if (!open.has(k)) open.set(k, []);
        open.get(k).push(e);
      } else {
        const q = open.get(k);
        if (q && q.length) {
          const s = q.shift();
          if (!byCh.has(e.ch)) byCh.set(e.ch, []);
          byCh.get(e.ch).push({ t: s.tick / midi.division, d: Math.max(1, e.tick - s.tick) / midi.division, m: e.m, v: s.vel });
        }
      }
    });
    open.forEach((q) => q.forEach((s) => {
      if (!byCh.has(s.ch)) byCh.set(s.ch, []);
      byCh.get(s.ch).push({ t: s.tick / midi.division, d: Math.max(midi.division / 4, lastTick - s.tick) / midi.division, m: s.m, v: s.vel });
    }));
    byCh.forEach((notes, ch) => {
      notes.sort((a, b) => a.t - b.t || a.m - b.m);
      const ms = notes.map((n) => n.m);
      const min = Math.min(...ms), max = Math.max(...ms);
      const avg = ms.reduce((s, x) => s + x, 0) / ms.length;
      // polyphony: fraction of notes that overlap another note's start
      let poly = 0; for (let i = 1; i < notes.length; i++) if (Math.abs(notes[i].t - notes[i - 1].t) < 0.02) poly++;
      parts.push({
        id: `${ti}:${ch}`, track: ti, ch, isDrum: ch === 9,
        name: tr.name || (ch === 9 ? 'Drums' : `Track ${ti + 1}`) + (byCh.size > 1 ? ` · ch ${ch + 1}` : ''),
        notes, count: notes.length, min, max, avg, poly: poly / notes.length,
        start: notes[0].t,
      });
    });
  });
  // guess: melody = non-drum, mostly monophonic, highest average pitch with enough notes
  const cands = parts.filter((x) => !x.isDrum && x.count >= 4);
  const score = (x) => x.avg - 40 * x.poly + Math.min(x.count, 400) / 40;
  cands.sort((a, b) => score(b) - score(a));
  parts.forEach((x) => (x.guess = null));
  if (cands[0]) cands[0].guess = 'R';
  const lh = cands.filter((x) => x !== cands[0]).sort((a, b) => a.avg - b.avg)[0];
  if (lh && lh.avg < (cands[0]?.avg ?? 128) - 5) lh.guess = 'L';
  return parts;
}

function quantize(notes, q) {
  if (!q) return notes.map((n) => ({ ...n }));
  return notes.map((n) => {
    const t = Math.round(n.t / q) * q;
    const end = Math.round((n.t + n.d) / q) * q;
    return { ...n, t, d: Math.max(q, end - t) };
  });
}

/** keep only the top note at each moment and cut overlaps so the line is playable one note at a time */
export function skyline(notes) {
  const byT = new Map();
  notes.forEach((n) => { const k = n.t.toFixed(3); if (!byT.has(k) || byT.get(k).m < n.m) byT.set(k, n); });
  const out = [...byT.values()].sort((a, b) => a.t - b.t);
  for (let i = 0; i < out.length - 1; i++) {
    const gap = out[i + 1].t - out[i].t;
    if (out[i].d > gap) out[i] = { ...out[i], d: gap };
  }
  return out;
}

/**
 * Build a song from chosen parts.
 * opts: {rh: partId, lh: partId|null, quantize: 0.25, skylineRH: true, skylineLH: false, transpose: 0, maxLHNotes: 3}
 */
export function partsToSong(midi, parts, opts) {
  const pick = (id) => parts.find((x) => x.id === id);
  const q = opts.quantize ?? 0.25;
  let rh = pick(opts.rh) ? quantize(pick(opts.rh).notes, q) : [];
  let lh = pick(opts.lh) ? quantize(pick(opts.lh).notes, q) : [];
  if (opts.skylineRH !== false) rh = skyline(rh);
  if (opts.skylineLH) lh = skyline(lh.map((n) => ({ ...n, m: -n.m }))).map((n) => ({ ...n, m: -n.m })); // lowest note
  const tr = opts.transpose || 0;
  const all = [...rh.map((n) => ({ t: n.t, d: n.d, m: n.m + tr, h: 'R' })), ...lh.map((n) => ({ t: n.t, d: n.d, m: n.m + tr, h: 'L' }))]
    .filter((n) => n.m >= 21 && n.m <= 108);
  const tsE = midi.timeSigs[0];
  const ts = tsE ? [tsE.num, tsE.den] : [4, 4];
  const bpb = ts[0] * (4 / ts[1]);
  const first = all.length ? Math.min(...all.map((n) => n.t)) : 0;
  const shift = Math.floor(first / bpb) * bpb; // trim silent intro to a bar boundary
  all.forEach((n) => { n.t = Math.round((n.t - shift) * 1000) / 1000; n.d = Math.round(n.d * 1000) / 1000; });
  all.sort((a, b) => a.t - b.t || a.m - b.m);
  const us = midi.tempos.length ? midi.tempos[0].us : 500000;
  const bpm = Math.round(60000000 / us);
  const key = detectKey(all);
  const warnings = [];
  const distinctTempos = new Set(midi.tempos.map((t) => t.us)).size;
  if (distinctTempos > 1) warnings.push(`This file changes tempo ${distinctTempos - 1} time(s); the app uses the first tempo (${bpm} BPM).`);
  return { notes: all, bpm, ts, key, sa: keyTonicPc(key), trimmedBeats: shift, warnings,
    beats: all.length ? Math.max(...all.map((n) => n.t + n.d)) : 0 };
}
