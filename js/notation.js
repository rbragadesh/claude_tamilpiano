// Text notation → notes. Western (C D E, C#4, Bb, C') and Carnatic sargam (S R G M P D N, Sa Ri Ga, R1/G2…)
// can be used interchangeably — even mixed in one line.
//
// Cheat sheet (also shown in the app):
//   C D E  or  S R G      one beat each
//   C:2  C:1/2  C:1.5     explicit beats
//   C - -   or  S , ,     hold (each "-" or "," adds a beat; ";" adds two)
//   C--                   same as C - -
//   _                     rest (one beat; "_:2" two beats)
//   (C D)  (S R G M)      squeeze notes into one beat (eighths, sixteenths, triplets); "(C D):2" spreads over two
//   [C E G]               notes played together (a chord)
//   C' C''  C^            octave up    |   C, .C  C.            octave down   |   C5  (absolute octave)
//   S' Ṡ  /  .S Ṣ         sargam upper / lower octave
//   R1 R2 G2 G3 M1 M2 D1 D2 N2 N3   explicit Carnatic variants (otherwise the chosen raga / major scale is used)
//   C@1                   finger number
//   |                     bar line (optional; used to warn you if a bar has the wrong number of beats)
//   # Pallavi             a line starting with # starts a named section

import { LETTER_PC, SWARA_SEMI, RAGA_BY_ID, parseChord, voiceChord, keyTonicPc, beatsPerBar as bpbOf, pc } from './theory.js';

const SARGAM_RE = /^(sa|ri|re|ga|ma|pa|dha|da|ni|s|r|g|m|p|d|n)([123])?$/i;
const WESTERN_RE = /^([A-Ga-g])(##|bb|#|b|♯|♭|x)?(\d)?$/;

function splitMods(tok) {
  // returns {core, ups, downs, dur, finger, holds}
  let t = tok.normalize('NFD');
  let ups = 0, downs = 0, dur = null, finger = null, holds = 0;
  const f = /@(\d)/.exec(t); if (f) { finger = Number(f[1]); t = t.replace(f[0], ''); }
  const d = /:([\d./]+)$/.exec(t); if (d) { dur = parseDur(d[1]); t = t.slice(0, d.index); }
  const h = /-+$/.exec(t); if (h && t.length > h[0].length) { holds = h[0].length; t = t.slice(0, h.index); }
  t = t.replace(/̇/g, () => { ups++; return ''; }).replace(/̣/g, () => { downs++; return ''; });
  while (/^[.,]/.test(t)) { downs++; t = t.slice(1); }
  while (/['^*’]$/.test(t)) { ups++; t = t.slice(0, -1); }
  while (/[.,]$/.test(t) && t.length > 1) { downs++; t = t.slice(0, -1); }
  while (/['^*’]$/.test(t)) { ups++; t = t.slice(0, -1); }
  return { core: t, ups, downs, dur, finger, holds };
}

function parseDur(s) {
  if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return b ? a / b : null; }
  const v = Number(s); return isFinite(v) && v > 0 ? v : null;
}

/** classify a core token: 'w' western-only, 's' sargam-only, 'ws' ambiguous (D, G…), null not a note */
function classify(core) {
  const isW = WESTERN_RE.test(core);
  const isS = SARGAM_RE.test(core);
  if (isW && isS) {
    // "D", "G", "D2", "G3" are ambiguous (Western octave or Carnatic variant) → decided by the rest of the text.
    // "Db", "G#", "D4" are Western; "Dha", "Ga" are sargam.
    if (/^(ga|dha|da)$/i.test(core)) return 's';
    if (/^[dg][123]?$/i.test(core)) return 'ws';
    return 'w';
  }
  return isW ? 'w' : isS ? 's' : null;
}

/** Guess whether a text is mostly sargam or mostly western. */
export function detectMode(text) {
  let w = 0, s = 0;
  for (const raw of text.split(/[\s()[\]|]+/)) {
    if (!raw || raw.startsWith('#')) continue;
    const c = classify(splitMods(raw).core);
    if (c === 'w') w++; else if (c === 's') s++;
  }
  return s > w ? 'sargam' : 'western';
}

function westernMidi(core, ups, downs, baseOct) {
  const mm = WESTERN_RE.exec(core);
  let p = LETTER_PC[mm[1].toUpperCase()];
  const a = mm[2];
  if (a === '#' || a === '♯') p += 1; else if (a === 'b' || a === '♭') p -= 1;
  else if (a === '##' || a === 'x') p += 2; else if (a === 'bb') p -= 2;
  const oct = mm[3] != null ? Number(mm[3]) : baseOct;
  return (oct + 1) * 12 + p + 12 * (ups - downs);
}

function sargamMidi(core, ups, downs, saMidi, raga) {
  const mm = SARGAM_RE.exec(core);
  const letter = mm[1][0].toUpperCase();
  let semi;
  if (mm[2]) semi = SWARA_SEMI[letter + mm[2]];
  if (semi == null) {
    if (letter === 'S') semi = 0; else if (letter === 'P') semi = 7;
    else {
      const r = raga ? RAGA_BY_ID[raga] : null;
      const hit = r && r.swaras.find((x) => x[0] === letter);
      semi = SWARA_SEMI[hit || { R: 'R2', G: 'G3', M: 'M1', D: 'D2', N: 'N3' }[letter]];
    }
  }
  return saMidi + semi + 12 * (ups - downs);
}

function tokenize(line) {
  return line.match(/\(|\)(?::[\d./]+)?|\[|\](?::[\d./]+)?|\||[^\s()[\]|]+/g) || [];
}

/**
 * Parse melody notation.
 * @param {string} text
 * @param {{key?:string, sa?:number, raga?:string, octave?:number, hand?:'R'|'L', mode?:'auto'|'western'|'sargam', ts?:number[]}} opts
 * @returns {{notes:Array, rests:Array, sections:Array, beats:number, warnings:string[], mode:string}}
 */
export function parseNotation(text, opts = {}) {
  const hand = opts.hand || 'R';
  const baseOct = opts.octave ?? (hand === 'L' ? 3 : 4);
  const saPc = opts.sa ?? keyTonicPc(opts.key || 'C');
  const saMidi = (baseOct + 1) * 12 + saPc;
  const raga = opts.raga || null;
  const docMode = !opts.mode || opts.mode === 'auto' ? detectMode(text || '') : opts.mode;
  const bpb = bpbOf(opts.ts || [4, 4]);
  const notes = [], rests = [], sections = [], warnings = [];
  let t = 0, last = null, barStart = 0, barNo = 0, firstBar = true;

  const readPitch = (raw, lineNo) => {
    const md = splitMods(raw);
    const c = classify(md.core);
    if (!c) { warnings.push(`Line ${lineNo}: couldn't read "${raw}"`); return null; }
    const asS = c === 's' || (c === 'ws' && docMode === 'sargam');
    const m = asS ? sargamMidi(md.core, md.ups, md.downs, saMidi, raga) : westernMidi(md.core, md.ups, md.downs, baseOct);
    if (m < 21 || m > 108) { warnings.push(`Line ${lineNo}: "${raw}" is outside the piano range`); return null; }
    return { m, ...md };
  };

  // place an event of `slots` units of `unit` beats
  const emit = (ev, unit, lineNo) => {
    if (ev.kind === 'hold') {
      const add = unit * ev.n;
      if (last) last.forEach((e) => (e.d += add));
      else warnings.push(`Line ${lineNo}: hold "-" with nothing before it`);
      t += add; return;
    }
    const d = (ev.dur ?? 1) * unit;
    if (ev.kind === 'rest') { const r = { t, d, h: hand, rest: true }; rests.push(r); last = [r]; }
    else {
      last = ev.pitches.map((p) => { const n = { t, d, m: p.m, h: hand }; if (p.finger) n.f = p.finger; notes.push(n); return n; });
    }
    t += d;
    if (ev.holds) { const add = unit * ev.holds; last.forEach((e) => (e.d += add)); t += add; }
  };

  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, li) => {
    const lineNo = li + 1;
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('//')) return;
    if (trimmed.startsWith('#')) { const name = trimmed.replace(/^#+\s*/, ''); if (name) sections.push({ t, name }); return; }
    const toks = tokenize(line);
    let i = 0;
    const readAtom = (tok) => {
      if (tok === '-' || tok === ',') return { kind: 'hold', n: 1 };
      if (tok === ';') return { kind: 'hold', n: 2 };
      if (/^-+$/.test(tok)) return { kind: 'hold', n: tok.length };
      if (/^_(?::[\d./]+)?$/.test(tok)) { const md = /:([\d./]+)/.exec(tok); return { kind: 'rest', dur: md ? parseDur(md[1]) : null }; }
      const p = readPitch(tok, lineNo);
      if (!p) return null;
      return { kind: 'note', pitches: [p], dur: p.dur, holds: p.holds };
    };
    const readChord = () => { // after '['
      const pitches = [];
      while (i < toks.length && !toks[i].startsWith(']')) { const p = readPitch(toks[i], lineNo); if (p) pitches.push(p); i++; }
      if (i >= toks.length) { warnings.push(`Line ${lineNo}: missing "]"`); }
      const close = toks[i] || ']'; i++;
      const md = /:([\d./]+)/.exec(close);
      if (!pitches.length) return null;
      return { kind: 'note', pitches, dur: md ? parseDur(md[1]) : pitches[0].dur, holds: 0 };
    };
    while (i < toks.length) {
      const tok = toks[i];
      if (tok === '|') {
        const len = +(t - barStart).toFixed(4);
        if (!firstBar && Math.abs(len - bpb) > 0.01) warnings.push(`Bar ${barNo} (line ${lineNo}) has ${len} beats, expected ${bpb}`);
        if (firstBar && len > 0.01 && Math.abs(len - bpb) > 0.01) { /* pickup bar is fine */ }
        if (len > 0.01 || !firstBar) { firstBar = false; barNo++; }
        barStart = t; i++; continue;
      }
      if (tok === '(') {
        i++;
        const items = [];
        while (i < toks.length && !toks[i].startsWith(')')) {
          if (toks[i] === '[') { i++; const c = readChord(); if (c) items.push(c); continue; }
          const a = readAtom(toks[i]); if (a) items.push(a); i++;
        }
        if (i >= toks.length) warnings.push(`Line ${lineNo}: missing ")"`);
        const close = toks[i] || ')'; i++;
        const md = /:([\d./]+)/.exec(close);
        const total = md ? parseDur(md[1]) : 1;
        const slots = items.reduce((s, it) => s + (it.kind === 'hold' ? it.n : (it.dur ?? 1) + (it.holds || 0)), 0) || 1;
        const unit = total / slots;
        items.forEach((it) => emit(it, unit, lineNo));
        continue;
      }
      if (tok === '[') { i++; const c = readChord(); if (c) emit(c, 1, lineNo); continue; }
      if (tok.startsWith(')') || tok.startsWith(']')) { warnings.push(`Line ${lineNo}: unexpected "${tok}"`); i++; continue; }
      const a = readAtom(tok); if (a) emit(a, 1, lineNo);
      i++;
    }
  });
  notes.forEach((n) => { n.t = round(n.t); n.d = round(n.d); });
  rests.forEach((n) => { n.t = round(n.t); n.d = round(n.d); });
  return { notes, rests, sections, beats: round(t), warnings, mode: docMode };
}

const round = (x) => Math.round(x * 10000) / 10000;

/**
 * Parse a chord line. With bar lines: "| C | Am | F G | G7 |" — chords in a bar share the bar.
 * Without bars: "C Am F G" — one bar each, or "C:2 G:2".  "-" holds, "%" repeats the previous bar, "N.C." = no chord.
 */
export function parseChordLine(text, ts = [4, 4]) {
  const bpb = bpbOf(ts);
  const chords = [], warnings = [];
  const body = String(text || '').split(/\r?\n/).filter((l) => !/^\s*(#|\/\/)/.test(l)).join(' ');
  if (!body.trim()) return { chords, warnings, beats: 0 };
  let t = 0;
  const pushChord = (name, d) => {
    if (/^(n\.?c\.?|_)$/i.test(name)) { t += d; return; }
    const ch = parseChord(name);
    if (!ch) { warnings.push(`Couldn't read chord "${name}"`); t += d; return; }
    chords.push({ t: round(t), d: round(d), name: ch.name });
    t += d;
  };
  if (body.includes('|')) {
    const bars = body.split('|').map((b) => b.trim());
    if (bars.length && bars[0] === '') bars.shift();
    if (bars.length && bars[bars.length - 1] === '') bars.pop();
    let prevBar = null;
    bars.forEach((bar) => {
      let toks = bar.split(/\s+/).filter(Boolean);
      if (toks.length === 1 && toks[0] === '%' && prevBar) toks = prevBar;
      if (!toks.length) { // empty bar: continue previous chord
        if (chords.length) chords[chords.length - 1].d = round(chords[chords.length - 1].d + bpb);
        t += bpb; return;
      }
      prevBar = toks;
      const explicit = toks.reduce((s, x) => s + (/:([\d./]+)$/.test(x) ? parseDur(/:([\d./]+)$/.exec(x)[1]) : 0), 0);
      const implicitCount = toks.filter((x) => !/:([\d./]+)$/.test(x)).length;
      const slot = implicitCount ? Math.max(0, bpb - explicit) / implicitCount : 0;
      toks.forEach((x) => {
        const md = /:([\d./]+)$/.exec(x);
        const d = md ? parseDur(md[1]) : slot;
        const name = md ? x.slice(0, md.index) : x;
        if (name === '-' || name === '%') { if (chords.length) chords[chords.length - 1].d = round(chords[chords.length - 1].d + d); t += d; return; }
        pushChord(name, d);
      });
    });
  } else {
    body.split(/\s+/).filter(Boolean).forEach((x) => {
      const md = /:([\d./]+)$/.exec(x);
      const d = md ? parseDur(md[1]) : bpb;
      const name = md ? x.slice(0, md.index) : x;
      if (name === '-' || name === '%') { if (chords.length) chords[chords.length - 1].d = round(chords[chords.length - 1].d + d); t += d; return; }
      pushChord(name, d);
    });
  }
  return { chords, warnings, beats: round(t) };
}

/** Turn chord symbols into left-hand notes. style: 'block' | 'root' | 'root5' | 'none' */
export function chordsToNotes(chords, style = 'block', hand = 'L') {
  if (style === 'none') return [];
  const out = [];
  chords.forEach((c) => {
    const ch = parseChord(c.name);
    voiceChord(ch, { hand, style }).forEach((m) => out.push({ t: c.t, d: c.d, m, h: hand }));
  });
  return out;
}

let idSeq = 0;
export const newId = (p = 's') => `${p}_${Date.now().toString(36)}_${(idSeq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Build a playable song from notation fields.
 * meta: {title, composer, movie, year, key, raga, bpm, ts, level}
 * src: {rh, lh, chords, chordStyle, mode}
 */
export function buildSong(meta, src) {
  const ts = meta.ts || [4, 4];
  const common = { key: meta.key || 'C', raga: meta.raga || null, ts, mode: src.mode || 'auto', sa: meta.sa };
  const R = parseNotation(src.rh || '', { ...common, hand: 'R' });
  const L = parseNotation(src.lh || '', { ...common, hand: 'L' });
  const C = parseChordLine(src.chords || '', ts);
  const lhFromChords = src.lh && src.lh.trim() ? [] : chordsToNotes(C.chords, src.chordStyle || 'block', 'L');
  const notes = [...R.notes, ...L.notes, ...lhFromChords].sort((a, b) => a.t - b.t || a.m - b.m);
  const rests = [...R.rests, ...L.rests];
  const sections = R.sections.length ? R.sections : L.sections;
  return {
    id: meta.id || newId(),
    title: meta.title || 'Untitled',
    composer: meta.composer || '', movie: meta.movie || '', year: meta.year || '',
    key: common.key, raga: common.raga, sa: meta.sa ?? keyTonicPc(common.key), bpm: Number(meta.bpm) || 90, ts,
    level: meta.level || 1, spelling: meta.spelling || null,
    notes, rests, chords: C.chords, sections,
    beats: Math.max(R.beats, L.beats, C.beats, ...notes.map((n) => n.t + n.d)),
    warnings: [...R.warnings.map((w) => 'Right hand — ' + w), ...L.warnings.map((w) => 'Left hand — ' + w), ...C.warnings.map((w) => 'Chords — ' + w)],
    src: { rh: src.rh || '', lh: src.lh || '', chords: src.chords || '', chordStyle: src.chordStyle || 'block', mode: src.mode || 'auto' },
  };
}

export { pc };

// ---------- notes → text (so captured / imported notes can be edited, and converted Western ⇄ Carnatic) ----------
import { SHARP, FLAT, swaraName as _swaraName, RAGAS as _RAGAS, keySigCount as _ksc } from './theory.js';

const fmtD = (d) => String(Math.round(d * 1000) / 1000);
function westernToken(m, preferFlat, baseOct = 4) {
  const name = (preferFlat ? FLAT : SHARP)[pc(m)];
  const oct = Math.floor(m / 12) - 1;
  return oct === baseOct ? name : name + oct;
}
function sargamToken(m, saMidi, raga) {
  const r = raga ? RAGA_BY_ID[raga] : null;
  let n = _swaraName(m, saMidi % 12, r);
  // drop the variant digit when it is the default for this raga (or the major scale)
  const dflt = r ? r.swaras.find((x) => x[0] === n[0]) : { R: 'R2', G: 'G3', M: 'M1', D: 'D2', N: 'N3' }[n[0]];
  if (n.length > 1 && n === dflt) n = n[0];
  const o = Math.floor((m - saMidi) / 12);
  return o > 0 ? n + "'".repeat(o) : o < 0 ? '.'.repeat(-o) + n : n;
}

/**
 * notes: [{t,d,m}] in beats (one hand). opts: {mode:'western'|'sargam', key, sa, raga, ts, preferFlat}
 */
export function notesToText(notes, opts = {}) {
  const bpb = bpbOf(opts.ts || [4, 4]);
  const mode = opts.mode || 'western';
  const saPc = opts.sa ?? keyTonicPc(opts.key || 'C');
  const baseOct = opts.octave ?? (opts.hand === 'L' ? 3 : 4);
  const saMidi = (baseOct + 1) * 12 + saPc;
  const preferFlat = opts.preferFlat ?? (_ksc(opts.key || 'C') < 0);
  const tok = (m) => (mode === 'sargam' ? sargamToken(m, saMidi, opts.raga) : westernToken(m, preferFlat, baseOct));
  // group simultaneous notes
  const groups = [];
  [...notes].sort((a, b) => a.t - b.t || a.m - b.m).forEach((n) => {
    const g = groups[groups.length - 1];
    if (g && Math.abs(g.t - n.t) < 1e-3) { g.ms.push(n.m); g.d = Math.max(g.d, n.d); } else groups.push({ t: n.t, d: n.d, ms: [n.m] });
  });
  const out = []; let t = 0, barsInLine = 0, line = [];
  const secs = (opts.sections || []).slice().sort((a, b) => a.t - b.t); let si = 0;
  const sectionCheck = () => {
    while (si < secs.length && secs[si].t <= t + 1e-6) {
      if (line.length) { out.push(line.join(' ')); line = []; barsInLine = 0; }
      out.push('# ' + secs[si].name); si++;
    }
  };
  const nextBar = () => Math.floor(t / bpb + 1e-6) * bpb + bpb;
  let lineStart = 0;
  const pushTok = (s, d) => {
    line.push(d === 1 ? s : `${s}:${fmtD(d)}`);
    t += d;
    if (Math.abs(t / bpb - Math.round(t / bpb)) < 1e-6) { line.push('|'); barsInLine++; if (barsInLine >= 4) { out.push(line.join(' ')); line = []; barsInLine = 0; lineStart = t; } }
    else if (t - lineStart >= 4 * bpb) { out.push(line.join(' ')); line = []; barsInLine = 0; lineStart = t; } // notes crossing bar lines: still wrap
  };
  const rest = (d) => { // split rests at bar lines
    while (d > 1e-6) { const chunk = Math.min(d, nextBar() - t); pushTok('_', chunk); d -= chunk; }
  };
  groups.forEach((g, i) => {
    sectionCheck();
    if (g.t > t + 1e-6) rest(g.t - t);
    sectionCheck();
    const nxt = groups[i + 1];
    const d = nxt ? Math.min(g.d, nxt.t - g.t) : g.d;
    const name = g.ms.length > 1 ? `[${g.ms.map(tok).join(' ')}]` : tok(g.ms[0]);
    pushTok(name, d > 0 ? d : 0.25);
  });
  if (line.length) out.push(line.join(' '));
  return out.join('\n');
}

/** ragas whose notes contain every pitch used (relative to Sa), best fit first */
export function suggestRagas(notes, saPc) {
  const used = new Set(notes.map((n) => pc(n.m - saPc)));
  if (!used.size) return [];
  return _RAGAS.map((r) => {
    const set = new Set(r.semis);
    const missing = [...used].filter((x) => !set.has(x)).length;
    const unused = r.semis.filter((x) => !used.has(x)).length;
    return { r, missing, unused };
  }).filter((x) => x.missing === 0).sort((a, b) => a.unused - b.unused).map((x) => x.r);
}
