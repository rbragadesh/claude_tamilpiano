// Practice library: a few hundred items that unlock level by level.
// Everything here is either traditional (public-domain Carnatic exercises and a 16th-century geetham),
// generated drills (scales, chord progressions), or original melodies written for this app.
//
// Alankaram patterns follow the NIOS Carnatic Music course (Module II, Alankaras) and NCERT "Kriti" (Grade 8).
// Sri Gananatha (Purandara Dasa, Malahari, Rupaka) follows the NIOS Carnatic Music course (Pillari gitam).
import { buildSong } from './notation.js';
import { RAGAS, RAGA_BY_ID, SHARP, FLAT, pc, keySigCount } from './theory.js';
import { UNITS, PIECES } from './content.js';
import { loadProgress } from './store.js';

// ---------- traditional exercise patterns (scale-degree based: 0 = Sa, n = upper Sa) ----------
// Sarali / janta: fixed 8-degree patterns (seven-note ragas)
const SARALI = {
  1: [[0, 1, 2, 3, 4, 5, 6, 7], [7, 6, 5, 4, 3, 2, 1, 0]],
  2: [[0, 1, 0, 1, 0, 1, 2, 3], [0, 1, 2, 3, 4, 5, 6, 7], [7, 6, 7, 6, 7, 6, 5, 4], [7, 6, 5, 4, 3, 2, 1, 0]],
  3: [[0, 1, 2, 0, 1, 2, 0, 1], [0, 1, 2, 3, 4, 5, 6, 7], [7, 6, 5, 7, 6, 5, 7, 6], [7, 6, 5, 4, 3, 2, 1, 0]],
  4: [[0, 1, 2, 3, 0, 1, 2, 3], [0, 1, 2, 3, 4, 5, 6, 7], [7, 6, 5, 4, 7, 6, 5, 4], [7, 6, 5, 4, 3, 2, 1, 0]],
};
// Sapta tala alankarams: [offset, aksharas] for the ascending line; the descending line mirrors the offsets.
const ALANKARAM = {
  dhruva: { name: 'Dhruva tala', ts: 14, ang: [4, 2, 4, 4], p: [[0, 1], [1, 1], [2, 1], [3, 1], [2, 1], [1, 1], [0, 1], [1, 1], [2, 1], [1, 1], [0, 1], [1, 1], [2, 1], [3, 1]] },
  matya: { name: 'Matya tala', ts: 10, ang: [4, 2, 4], p: [[0, 1], [1, 1], [2, 1], [1, 1], [0, 1], [1, 1], [0, 1], [1, 1], [2, 1], [3, 1]] },
  rupaka: { name: 'Rupaka tala', ts: 6, ang: [2, 4], p: [[0, 1], [1, 1], [0, 1], [1, 1], [2, 1], [3, 1]] },
  jhampa: { name: 'Misra Jhampa tala', ts: 10, ang: [7, 1, 2], p: [[0, 1], [1, 1], [2, 1], [0, 1], [1, 1], [0, 1], [1, 1], [2, 1], [3, 2]] },
  triputa: { name: 'Tisra Triputa tala', ts: 7, ang: [3, 2, 2], p: [[0, 1], [1, 1], [2, 1], [0, 1], [1, 1], [2, 1], [3, 1]] },
  ata: { name: 'Khanda Ata tala', ts: 14, ang: [5, 5, 2, 2], p: [[0, 1], [1, 2], [2, 2], [0, 2], [1, 1], [2, 2], [3, 2], [3, 2]] },
  eka: { name: 'Eka tala', ts: 4, ang: [4], p: [[0, 1], [1, 1], [2, 1], [3, 1]] },
};

/** degree index → sargam token with explicit variant and octave marks */
function tok(raga, d) {
  const n = raga.semis.length;
  const oct = Math.floor(d / n), i = ((d % n) + n) % n;
  return raga.swaras[i] + (oct > 0 ? "'".repeat(oct) : '') + (oct < 0 ? ','.repeat(-oct) : '');
}
/** items: [degree, beats]; a bar line every `bpb` beats (default: one bar per line) */
function lineText(raga, items, bpb = null) {
  const out = []; let t = 0;
  items.forEach(([d, dur]) => { out.push(dur === 1 ? tok(raga, d) : `${tok(raga, d)}:${dur}`); t += dur; if (bpb && Math.abs(t % bpb) < 1e-6) out.push('|'); });
  if (!bpb) out.push('|');
  return out.join(' ');
}

function saraliText(raga, k) { return SARALI[k].map((l) => lineText(raga, l.map((d) => [d, 1]), 4)).join('\n'); }
function scaleText(raga) { // sarali 1 for any raga size
  const n = raga.semis.length; const up = [], down = [];
  for (let d = 0; d <= n; d++) up.push([d, 1]);
  for (let d = n; d >= 0; d--) down.push([d, 1]);
  return lineText(raga, up) + '\n' + lineText(raga, down);
}
function jantaText(raga) {
  const n = raga.semis.length; const up = [], down = [];
  for (let d = 0; d <= n; d++) up.push([d, 1], [d, 1]);
  for (let d = n; d >= 0; d--) down.push([d, 1], [d, 1]);
  const chunk = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 8) out.push(lineText(raga, arr.slice(i, i + 8), 4)); return out.join('\n'); };
  return chunk(up) + '\n' + chunk(down);
}
function alankaramText(raga, a) {
  const n = raga.semis.length; const lines = [];
  for (let s = 0; s + 3 <= n; s++) lines.push(lineText(raga, a.p.map(([o, d]) => [s + o, d])));
  for (let s = n; s - 3 >= 0; s--) lines.push(lineText(raga, a.p.map(([o, d]) => [s - o, d])));
  return lines.join('\n');
}

const RAGA_ADD = { shankarabharanam: 0, mohanam: 0, mayamalavagowla: 1, kalyani: 1, harikambhoji: 1, kharaharapriya: 1, hindolam: 1, shivaranjani: 1,
  hamsadhwani: 1, madhyamavati: 1, suddhadhanyasi: 1, natabhairavi: 2, keeravani: 2, charukesi: 2, chakravakam: 2, hanumatodi: 2, revati: 2, simhendramadhyamam: 3 };
const PATTERN_LEVEL = { sarali1: 1, janta1: 1, eka: 1, sarali2: 2, rupaka: 2, sarali3: 3, sarali4: 3, triputa: 3, matya: 3, dhruva: 4, jhampa: 4, ata: 5 };
const lv = (base, add) => Math.max(1, Math.min(7, base + add));

// ---------- original melodies (written for this app) ----------
const ORIG = 'Isai Keys (original)';
export const NEW_PIECES = [
  { id: 'o_vaigai', title: 'Vaigai Breeze', raga: 'kharaharapriya', key: 'C', bpm: 80, level: 3,
    rh: `# Pallavi
G - A Bb | A G F Eb | F G A - | G - - - |
Eb F G A | Bb C' Bb A | G F Eb D | C - - - |
# Anupallavi
C' - Bb A | G A Bb C' | D' C' Bb A | G - - - |
F G A Bb | A G F Eb | D Eb F D | C - - - |`, chords: '| Cm | F | F | Cm | Cm | Gm | Bb | Cm | Cm | F | Bb | Cm | F | F | Bb | Cm |' },
  { id: 'o_thendral', title: 'Thendral Waltz', raga: 'shankarabharanam', key: 'C', bpm: 96, ts: [3, 4], level: 3,
    rh: `E - G | C' - B | A - G | E - - |
F - A | D' - C' | B - A | G - - |
E - G | C' - E' | D' C' B | A - - |
F - A | G - B, | D - E | C - - |`, chords: '| C | C | F | C | F | Dm | G | G | C | Am | G | Am | F | G | G | C |' },
  { id: 'o_hamsa', title: 'Hamsa Lights', raga: 'hamsadhwani', key: 'C', bpm: 92, level: 3,
    rh: `G - B C' | B G E D | E G B G | E - D - |
C D E G | B - C' - | B G E D | C - - - |
# Upper
G B C' D' | E' - D' C' | B C' D' B | G - - - |
E G B C' | D' C' B G | E D (C D) E | C - - - |`, chords: '| C | Em | C | G | C | G | G | C | C | Em | G | G | C | G | G | C |' },
  { id: 'o_madhyamavati', title: 'Madhyamavati Morning', raga: 'madhyamavati', key: 'C', bpm: 84, level: 3,
    rh: `C - D F | G - F D | F G Bb C' | Bb - G - |
F G Bb G | F D C D | F - D - | C - - - |
# Second
G Bb C' D' | C' - Bb G | Bb C' Bb G | F - - - |
D F G Bb | G F D F | D C (Bb, C) D | C - - - |`, chords: '| Csus2 | Bb | F | Csus2 | Bb | F | Bb | Csus2 | Csus2 | Bb | Gm | F | Bb | F | Bb | Csus2 |' },
  { id: 'o_monsoon', title: 'Monsoon Minor', raga: 'natabhairavi', key: 'Am', bpm: 76, level: 3,
    rh: `A4 - C5 B4 | A4 G4 F4 E4 | F4 - G4 A4 | E4 - - - |
D4 E4 F4 G4 | A4 - G4 F4 | E4 D4 C4 D4 | E4 - - - |
# Return
A4 B4 C5 D5 | E5 - D5 C5 | B4 C5 A4 G4 | A4 - - - |
F4 G4 A4 C5 | B4 A4 G4 F4 | E4 - D4 E4 | A4 - - - |`, chords: '| Am | Am | F | Em | Dm | F | C | Em | Am | C | G | Am | F | Dm | Em | Am |' },
  { id: 'o_folkdrum', title: 'Folk Drum', raga: 'harikambhoji', key: 'C', bpm: 104, level: 4,
    rh: `(C D) E (E F) G | (A G) (F E) D - | (G A) Bb (A G) F | E - C - |
(C D) E (E F) G | (A Bb) (C' Bb) A - | (G F) (E D) (E F) G | C - - - |`, chords: '| C | Dm | Bb | C | C | F | C7 | C |' },
  { id: 'o_mohanamexp', title: 'Mohanam Express', raga: 'mohanam', key: 'C', bpm: 112, level: 4,
    rh: `(G A) (C' D') E' D' | (C' A) G (E G) A | (G E) (D C) D E | G - - - |
(E G) A (C' D') C' | (A G) E (D E) G | (E D) (C D) E D | C - - - |`, chords: '| C | Am | C | G | Am | C | G | C |' },
  { id: 'o_dhanyasi', title: 'Suddha Dhanyasi Joy', raga: 'suddhadhanyasi', key: 'C', bpm: 100, level: 4,
    rh: `(C Eb) F (G Bb) G | F Eb C - | (Eb F) G (Bb C') Bb | G - - - |
(C' Bb) G (F Eb) F | G Bb G F | (Eb F) Eb C Bb, | C - - - |`, chords: '| Cm | Cm | Eb | Bb | Cm | Eb | Bb | Cm |' },
  { id: 'o_temple', title: 'Temple Steps', raga: 'mayamalavagowla', key: 'C', bpm: 72, level: 4,
    rh: `C Db E F | G - F E | F G Ab G | F E Db C |
E F G Ab | B - C' - | B Ab G F | E - - - |
# Upper
G Ab B C' | Db' - C' B | Ab - G F | G - - - |
F E Db E | F G Ab G | F E Db - | C - - - |`, chords: '| C | C | Fm | Db | C | C | Fm | C | C | Db | Fm | C | Db | Fm | Db | C |' },
  { id: 'o_kalyaninight', title: 'Kalyani Night Song', raga: 'kalyani', key: 'C', bpm: 76, level: 5,
    rh: `E:1.5 F#:0.5 G A | B - A G | F#:1.5 G:0.5 A F# | E - - - |
D:1.5 E:0.5 F# G | A B C' D' | B:1.5 A:0.5 G F# | G - - - |`, chords: '| C | Em | D | Em | D | Am | Em | G |' },
  { id: 'o_todi', title: 'Todi Dawn', raga: 'hanumatodi', key: 'C', bpm: 66, level: 5,
    rh: `C - Db Eb | F - Eb Db | Eb F G Ab | G - - - |
Ab Bb C' Bb | Ab G F Eb | F Eb Db Eb | C - - - |`, chords: '| Cm | Db | Fm | Cm | Fm | Cm | Db | Cm |' },
  { id: 'o_charukesi', title: 'Bittersweet Charukesi', raga: 'charukesi', key: 'C', bpm: 70, level: 5,
    rh: `G - Ab G | F E D E | F G Ab Bb | Ab - G - |
C' - Bb Ab | G F E F | G F E D | C - - - |
# Answer
E F G Ab | Bb - Ab G | Ab Bb C' D' | C' - - - |
Bb Ab G F | E F G E | D E F D | C - - - |`, chords: '| C | C | Fm | Fm | Ab | C | C | C | C | Bb | Bb | Ab | Fm | C | Bb | C |' },
  { id: 'o_chakravakam', title: 'Chakravakam Prayer', raga: 'chakravakam', key: 'C', bpm: 66, level: 5,
    rh: `C - Db E | F - E Db | E F G A | G - - - |
Bb A G F | E F G A | G F E Db | C - - - |`, chords: '| C | Db | C | C | Bb | F | C7 | C |' },
  { id: 'o_revati', title: 'Revati Chant', raga: 'revati', key: 'C', bpm: 60, level: 5,
    rh: `C - Db F | G - F Db | F G Bb C' | Bb - G - |
F G F Db | C - Db F | Db - C - | C - - - |`, chords: '| Csus4 | Db | Bb | Csus4 | Db | Csus4 | Db | Csus4 |' },
  { id: 'o_simhendra', title: 'Simhendra Fire', raga: 'simhendramadhyamam', key: 'C', bpm: 72, level: 6,
    rh: `G - Ab G | F# - Eb D | Eb F# G Ab | G - - - |
B C' D' C' | B Ab G F# | G F# Eb D | C - - - |`, chords: '| Cm | Cm | Ab | Cm | G | Ab | G | Cm |' },
  { id: 'o_keeravanistorm', title: 'Keeravani Storm', raga: 'keeravani', key: 'Am', bpm: 84, level: 6, chordStyle: 'block',
    rh: `A4 (B4 C5) D5 E5 | F5 E5 D5 C5 | B4 (C5 D5) E5 G#4 | A4 - - - |
E5 (F5 E5) D5 C5 | B4 (A4 B4) C5 B4 | A4 G#4 F4 E4 | A4 - - - |`, chords: '| Am | Dm | E | Am | Am | E | E | Am |' },
];

const ORIGINAL_LEVELS = { p_kolam: 1, p_nadaswaram: 2, p_marina: 5, p_mohanam: 3, p_kalyani: 4, p_keeravani: 4, p_shivaranjani: 4, p_hindolam: 4 };

// ---------- chord progressions used all over film & pop music (generic, not from any song) ----------
const PROGRESSIONS = [
  { id: 'I_vi_IV_V', name: 'I – vi – IV – V', roman: ['I', 'vi', 'IV', 'V'], base: 6, note: 'The classic "evergreen" loop' },
  { id: 'I_V_vi_IV', name: 'I – V – vi – IV', roman: ['I', 'V', 'vi', 'IV'], base: 6, note: 'The modern pop loop' },
  { id: 'vi_IV_I_V', name: 'vi – IV – I – V', roman: ['vi', 'IV', 'I', 'V'], base: 6, note: 'Same chords, starting from minor' },
  { id: 'I_IV_I_V', name: 'I – IV – I – V', roman: ['I', 'IV', 'I', 'V'], base: 5, note: 'Folk and devotional songs' },
  { id: 'I_iii_IV_V', name: 'I – iii – IV – V', roman: ['I', 'iii', 'IV', 'V'], base: 6, note: 'Rising, romantic' },
  { id: 'ii_V_I', name: 'ii – V – I', roman: ['ii', 'V', 'I', 'I'], base: 6, note: 'The strongest way home' },
  { id: 'I_II_lyd', name: 'I – II (Kalyani colour)', roman: ['I', 'II', 'I', 'II'], base: 6, note: 'Major II chord = raised Ma, the Kalyani sound' },
  { id: 'I_bVII_IV', name: 'I – ♭VII – IV – I (Harikambhoji colour)', roman: ['I', 'bVII', 'IV', 'I'], base: 6, note: 'Flat Ni — folk, kuthu' },
  { id: 'i_iv_V_i', name: 'i – iv – V – i (Keeravani colour)', roman: ['i', 'iv', 'V', 'i'], base: 6, note: 'Harmonic minor drama' },
  { id: 'i_VII_VI_VII', name: 'i – VII – VI – VII', roman: ['i', 'VII', 'VI', 'VII'], base: 6, note: 'Natural minor rock / BGM loop' },
  { id: 'i_VI_III_VII', name: 'i – VI – III – VII', roman: ['i', 'VI', 'III', 'VII'], base: 6, note: 'Epic minor loop' },
  { id: 'i_VII_VI_V', name: 'i – VII – VI – V (Andalusian)', roman: ['i', 'VII', 'VI', 'V'], base: 7, note: 'Descending, dramatic' },
  { id: 'i_IV_dor', name: 'i – IV (Kharaharapriya colour)', roman: ['i', 'IV', 'i', 'IV'], base: 6, note: 'Dorian: minor with a bright major IV' },
  { id: 'i_bII_phr', name: 'i – ♭II (Todi colour)', roman: ['i', 'bII', 'i', 'bII'], base: 7, note: 'Phrygian: dark flat Ri' },
  { id: 'i_iv_VII_III', name: 'i – iv – VII – III', roman: ['i', 'iv', 'VII', 'III'], base: 7, note: 'Circle of fifths in minor' },
];
const ROMAN = { I: [0, ''], ii: [2, 'm'], II: [2, ''], iii: [4, 'm'], IV: [5, ''], V: [7, ''], vi: [9, 'm'], bVII: [10, ''], i: [0, 'm'], iv: [5, 'm'], VI: [8, ''], III: [3, ''], VII: [10, ''], bII: [1, ''] };
const MAJOR_KEYS = [['C', 0], ['G', 0], ['F', 1], ['D', 1]];
const MINOR_KEYS = [['A', 0], ['E', 0], ['D', 1], ['B', 1]];
function chordName(rootPc, q, flat) { return (flat ? FLAT : SHARP)[pc(rootPc)] + q; }

// ---------- scales (with standard right-hand fingering where it is the common 1-2-3 1-2-3-4-5 pattern) ----------
const SCALE_KEYS = [
  ['C', 0, 1, '123 12345'], ['G', 7, 1, '123 12345'], ['F', 5, 1, '1234 1234'], ['D', 2, 3, '123 12345'], ['A', 9, 3, '123 12345'],
  ['Bb', 10, 4, null], ['E', 4, 4, '123 12345'], ['Eb', 3, 5, null], ['B', 11, 5, '123 12345'], ['Ab', 8, 6, null], ['Db', 1, 6, null], ['F#', 6, 6, null],
];
const MINOR_SCALES = [['A', 9, 3, '123 12345'], ['E', 4, 3, '123 12345'], ['D', 2, 3, '123 12345'], ['B', 11, 5, null], ['G', 7, 5, null], ['C', 0, 5, null],
  ['F#', 6, 6, null], ['F', 5, 6, null], ['C#', 1, 7, null], ['Bb', 10, 7, null], ['Eb', 3, 7, null], ['G#', 8, 7, null]];

function scaleSong(name, tonic, minor, fing) {
  const steps = minor ? [0, 2, 3, 5, 7, 8, 10, 12] : [0, 2, 4, 5, 7, 9, 11, 12];
  const base = 60 + tonic; // Sa in the middle octave
  const fingers = fing ? fing.replace(/\s/g, '').split('').map(Number) : null;
  const notes = [];
  steps.forEach((s, i) => notes.push({ t: i, d: 1, m: base + s, h: 'R', ...(fingers ? { f: fingers[i] } : {}) }));
  steps.slice(0, -1).reverse().forEach((s, i) => notes.push({ t: 8 + i, d: i === 6 ? 2 : 1, m: base + s, h: 'R', ...(fingers ? { f: fingers[6 - i] } : {}) }));
  const key = minor ? name + 'm' : name;
  return { id: `sc_${minor ? 'min' : 'maj'}_${name}`, title: `${name} ${minor ? 'minor' : 'major'} scale`, composer: 'Scale', key, sa: tonic, bpm: 80, ts: [4, 4], level: 1,
    notes, rests: [], chords: [], sections: [], beats: 16, warnings: [], raga: minor ? 'natabhairavi' : 'shankarabharanam' };
}

// ---------- catalog ----------
export const CATS = [
  { id: 'songs', name: 'Original songs' },
  { id: 'varisai', name: 'Varisai & alankaram' },
  { id: 'chords', name: 'Chord progressions' },
  { id: 'scales', name: 'Scales' },
  { id: 'geetham', name: 'Geetham' },
];

function make(item) { let cache = null; item.build = () => cache || (cache = Object.assign(item.make(), { builtin: true, level: item.level })); return item; }

let CATALOG = null;
export function catalog() {
  if (CATALOG) return CATALOG;
  const out = [];
  // originals already in the course + new ones
  Object.values(PIECES).filter((p) => !p.meta.composer || p.meta.composer.includes('original')).forEach((p) => out.push(make({
    id: p.meta.id, title: p.meta.title, sub: subOf(p.meta.raga, p.meta.key), cat: 'songs', raga: p.meta.raga || null, level: ORIGINAL_LEVELS[p.meta.id] || 2,
    make: () => buildSong(p.meta, p.src),
  })));
  NEW_PIECES.forEach((p) => out.push(make({
    id: p.id, title: p.title, sub: subOf(p.raga, p.key) + (p.ts && p.ts[0] === 3 ? ' · 3/4' : ''), cat: 'songs', raga: p.raga, level: p.level,
    make: () => buildSong({ id: p.id, title: p.title, composer: ORIG, key: p.key, raga: p.raga, bpm: p.bpm, ts: p.ts || [4, 4] }, { rh: p.rh, chords: p.chords, chordStyle: p.chordStyle || 'root' }),
  })));
  // varisai & alankaram in every raga
  RAGAS.filter((r) => !r.noEx).forEach((r) => {
    const add = RAGA_ADD[r.id] ?? 2; const seven = r.semis.length === 7;
    const ex = (pid, title, text, ts, bpm) => out.push(make({
      id: `v_${r.id}_${pid}`, title: `${title} · ${r.name}`, sub: `${r.name} · ${r.western}`, cat: 'varisai', raga: r.id, level: lv(PATTERN_LEVEL[pid], add),
      make: () => buildSong({ id: `v_${r.id}_${pid}`, title: `${title} — ${r.name}`, composer: 'Traditional', key: 'C', raga: r.id, bpm, ts: [ts, 4] }, { rh: text, mode: 'sargam' }),
    }));
    if (seven) [1, 2, 3, 4].forEach((k) => ex('sarali' + k, `Sarali varisai ${k}`, saraliText(r, k), 4, 72));
    else ex('sarali1', 'Arohanam–avarohanam', scaleText(r), r.semis.length + 1, 72);
    ex('janta1', 'Janta varisai', jantaText(r), 4, 66);
    Object.entries(ALANKARAM).forEach(([pid, a]) => ex(pid, `Alankaram · ${a.name}`, alankaramText(r, a), a.ts, 72));
  });
  // geetham
  out.push(make({ id: 'g_srigananatha', title: 'Sri Gananatha (Lambodara)', sub: 'Malahari · Rupaka tala · Purandara Dasa (traditional)', cat: 'geetham', raga: 'malahari', level: 4,
    make: () => buildSong({ id: 'g_srigananatha', title: 'Sri Gananatha — geetham', composer: 'Purandara Dasa (traditional)', key: 'C', raga: 'malahari', bpm: 66, ts: [6, 4] }, { rh: SRI_GANANATHA, mode: 'sargam' }) }));
  // chord progressions
  PROGRESSIONS.forEach((pr) => {
    const minor = pr.roman[0] === 'i';
    (minor ? MINOR_KEYS : MAJOR_KEYS).forEach(([k, extra]) => {
      const tonic = SHARP.indexOf(k) >= 0 ? SHARP.indexOf(k) : FLAT.indexOf(k);
      const sig = keySigCount(minor ? k + 'm' : k);
      const names = pr.roman.map((rn) => { const [iv, q] = ROMAN[rn]; return chordName(tonic + iv, q, sig <= 0); });
      const line = '| ' + [...names, ...names].join(' | ') + ' |';
      const keyName = minor ? k + 'm' : k;
      for (const hand of ['L', 'R']) {
        if (hand === 'R' && k !== (minor ? 'A' : 'C')) continue;
        const id = `c_${pr.id}_${keyName}_${hand}`;
        out.push(make({ id, title: `${pr.name} in ${keyName}${hand === 'R' ? ' · right hand' : ''}`, sub: `${names.join(' · ')} — ${pr.note}`, cat: 'chords', raga: null,
          level: Math.min(7, pr.base + extra + (hand === 'R' ? 0 : 0)),
          make: () => {
            const s = buildSong({ id, title: `${pr.name} — ${keyName}`, composer: 'Chord drill', key: keyName, bpm: 72 }, { chords: line, chordStyle: 'block' });
            if (hand === 'R') s.notes.forEach((n) => { n.h = 'R'; n.m += 12; });
            return s;
          } }));
      }
    });
  });
  // scales
  SCALE_KEYS.forEach(([n, t, l, f]) => out.push(make({ id: `sc_maj_${n}`, title: `${n} major scale`, sub: `Shankarabharanam with Sa = ${n}${f ? ' · fingering shown' : ''}`, cat: 'scales', raga: 'shankarabharanam', level: l, make: () => scaleSong(n, t, false, f) })));
  MINOR_SCALES.forEach(([n, t, l, f]) => out.push(make({ id: `sc_min_${n}`, title: `${n} minor scale`, sub: `Natabhairavi with Sa = ${n}${f ? ' · fingering shown' : ''}`, cat: 'scales', raga: 'natabhairavi', level: l, make: () => scaleSong(n, t, true, f) })));
  out.forEach((x) => (x.level = Math.max(1, Math.min(7, x.level))));
  CATALOG = out.sort((a, b) => a.level - b.level);
  return CATALOG;
}
function subOf(raga, key) { const r = raga && RAGA_BY_ID[raga]; return r ? `${r.name} · ${r.western}` : `Key ${key || 'C'}`; }

// Sri Gananatha — swaras per the NIOS Carnatic Music course; Malahari: S R1 M1 P D1 S / S D1 P M1 G3 R1 S
// One bar = one avartanam of Rupaka tala (drutam 2 + laghu 4 = 6 beats).
const SRI_GANANATHA = `# Sri Gananatha
M1 P D1 S' S' R1' | R1' S' D1 P M1 P |
R1 M1 P D1 M1 P | D1 P M1 G3 R1 S |
# Lambodara
S R1 M1:2 G3 R1 | S R1 G3 R1 S:2 |
R1 M1 P D1 M1 P | D1 P M1 G3 R1 S |
S R1 M1:2 G3 R1 | S R1 G3 R1 S:2 |
# Siddha charana
M1 P D1 S' S' R1' | R1' S' D1 P M1 P |
R1 M1 P D1 M1 P | D1 P M1 G3 R1 S |
S R1 M1:2 G3 R1 | S R1 G3 R1 S:2 |
# Third charanam
M1 P D1 S' S' R1' | R1' S' D1 P M1 P |
R1 M1 P D1 M1 P | D1 P M1 G3 R1 S |
S R1 M1:2 G3 R1 | S R1 G3 R1 S:2 |`;

// ---------- levels ----------
export const LEVELS = [
  { n: 1, name: 'Beginner' },
  { n: 2, name: 'Sa Ri Ga', unit: 0 },
  { n: 3, name: 'Reader', unit: 1 },
  { n: 4, name: 'In time', unit: 2 },
  { n: 5, name: 'Two hands', unit: 3 },
  { n: 6, name: 'Chord player', unit: 4 },
  { n: 7, name: 'Raga player', unit: 5 },
];
export const unitDone = (prog, u) => u.lessons.every((l) => ((prog['L:' + l.id] || {}).stars || 0) >= 1);
export function levelInfo(settings = {}) {
  const prog = loadProgress();
  let level = 1;
  for (const L of LEVELS.slice(1)) { if (unitDone(prog, UNITS[L.unit])) level = L.n; else break; }
  const earned = level;
  if (settings.unlockAll) level = 7;
  const next = LEVELS.find((L) => L.n === earned + 1);
  const nextUnit = next ? UNITS[next.unit] : null;
  const unitProgress = nextUnit ? nextUnit.lessons.filter((l) => ((prog['L:' + l.id] || {}).stars || 0) >= 1).length / nextUnit.lessons.length : 1;
  return { level, earned, name: LEVELS[level - 1].name, next, nextUnit, unitProgress, unlockAll: !!settings.unlockAll };
}
