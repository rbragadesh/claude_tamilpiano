// Music theory helpers: pitch names, spelling on the staff, sargam (Carnatic swaras), ragas, chords, keys.

export const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const pc = (m) => ((m % 12) + 12) % 12;
export const octaveOf = (m) => Math.floor(m / 12) - 1;
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const isBlack = (m) => [1, 3, 6, 8, 10].includes(pc(m));

/** Parse a note name like "C", "c#", "Bb", "F#4" → {pc, octave|null}. Returns null if invalid. */
export function parseNoteName(s) {
  const mm = /^([A-Ga-g])(#|b|♯|♭)?(\d)?$/.exec(String(s).trim());
  if (!mm) return null;
  let p = LETTER_PC[mm[1].toUpperCase()];
  if (mm[2] === '#' || mm[2] === '♯') p += 1;
  if (mm[2] === 'b' || mm[2] === '♭') p -= 1;
  return { pc: pc(p), octave: mm[3] != null ? Number(mm[3]) : null };
}

export function noteName(m, preferFlat = false, withOctave = true) {
  const n = (preferFlat ? FLAT : SHARP)[pc(m)];
  return withOctave ? n + octaveOf(m) : n;
}

// ---------- Keys & key signatures ----------
export const KEY_SIG = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6,
  Am: 0, Em: 1, Bm: 2, 'F#m': 3, 'C#m': 4, 'G#m': 5, 'D#m': 6, Dm: -1, Gm: -2, Cm: -3, Fm: -4, Bbm: -5, Ebm: -6,
};
export const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
export const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

export function keyTonicPc(key) {
  const k = String(key || 'C');
  const root = k.endsWith('m') ? k.slice(0, -1) : k;
  const p = parseNoteName(root);
  return p ? p.pc : 0;
}
export const isMinorKey = (key) => String(key || '').endsWith('m');
export const keySigCount = (key) => KEY_SIG[key] ?? 0;

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** letter -> +1 / -1 for the letters altered by the key signature */
export function keyAccidentalMap(n) {
  const map = {};
  if (n > 0) SHARP_ORDER.slice(0, n).forEach((l) => (map[l] = 1));
  if (n < 0) FLAT_ORDER.slice(0, -n).forEach((l) => (map[l] = -1));
  return map;
}
export const KEYSIG_STEPS = {
  treble: { sharp: [38, 35, 39, 36, 33, 37, 34], flat: [34, 37, 33, 36, 32, 35, 31] },
  bass: { sharp: [24, 21, 25, 22, 19, 23, 20], flat: [20, 23, 19, 22, 18, 21, 17] },
};

// Default spelling of black keys when there is no key signature (C major / A minor).
const NEUTRAL_SPELL = { 1: ['C', 1], 3: ['E', -1], 6: ['F', 1], 8: ['G', 1], 10: ['B', -1] };

/**
 * Spell a MIDI note for the staff.
 * @param {number} m midi
 * @param {number} sig key signature count (+sharps / -flats)
 * @param {'sharp'|'flat'|null} prefer optional override for black keys
 * @returns {{letter:string, acc:number, octave:number, step:number}} step = diatonic index (C4 = 28)
 */
export function spell(m, sig = 0, prefer = null, letterMap = null) {
  const p = pc(m);
  const kmap = keyAccidentalMap(sig);
  let letter = null, acc = 0;
  if (letterMap && letterMap[p]) {
    letter = letterMap[p];
    acc = ((p - LETTER_PC[letter] + 18) % 12) - 6; // -2..+2
    const octave = Math.round((m - (LETTER_PC[letter] + acc)) / 12) - 1;
    return { letter, acc, octave, step: octave * 7 + LETTERS.indexOf(letter) };
  }
  // 1) a letter that the key signature already alters to this pitch
  for (const l of LETTERS) {
    if (kmap[l] && pc(LETTER_PC[l] + kmap[l]) === p) { letter = l; acc = kmap[l]; break; }
  }
  // 2) plain natural
  if (!letter) {
    for (const l of LETTERS) if (LETTER_PC[l] === p) { letter = l; acc = 0; break; }
  }
  // 3) black key not in key signature
  if (!letter) {
    const mode = prefer || (sig > 0 ? 'sharp' : sig < 0 ? 'flat' : null);
    if (mode === 'sharp') { letter = LETTERS.find((l) => pc(LETTER_PC[l] + 1) === p); acc = 1; }
    else if (mode === 'flat') { letter = LETTERS.find((l) => pc(LETTER_PC[l] - 1) === p); acc = -1; }
    else { [letter, acc] = NEUTRAL_SPELL[p]; }
  }
  const octave = Math.round((m - (LETTER_PC[letter] + acc)) / 12) - 1;
  return { letter, acc, octave, step: octave * 7 + LETTERS.indexOf(letter) };
}

export function spelledName(m, sig = 0, prefer = null, withOctave = false, letterMap = null) {
  const s = spell(m, sig, prefer, letterMap);
  const a = s.acc === 1 ? '♯' : s.acc === -1 ? '♭' : s.acc === 2 ? '𝄪' : '';
  return s.letter + a + (withOctave ? s.octave : '');
}

// ---------- Sargam ----------
export const SWARA_DEFAULT = ['S', 'R1', 'R2', 'G2', 'G3', 'M1', 'M2', 'P', 'D1', 'D2', 'N2', 'N3'];
export const SWARA_SEMI = { S: 0, R1: 1, R2: 2, R3: 3, G1: 2, G2: 3, G3: 4, M1: 5, M2: 6, P: 7, D1: 8, D2: 9, D3: 10, N1: 9, N2: 10, N3: 11 };
export const SWARA_LONG = { S: 'Sa', R: 'Ri', G: 'Ga', M: 'Ma', P: 'Pa', D: 'Dha', N: 'Ni' };

/** Carnatic swara name (e.g. "R2") for a midi note given Sa pitch-class and optional raga. */
export function swaraName(m, saPc = 0, raga = null) {
  const s = pc(m - saPc);
  if (raga) {
    const i = raga.semis.indexOf(s);
    if (i >= 0) return raga.swaras[i];
  }
  return SWARA_DEFAULT[s];
}
/** Octave marker relative to madhya (middle) Sa = Sa at/above middle C. -1 lower, 0 middle, +1 upper. */
export function swaraOctave(m, saPc = 0) {
  const sa = 60 + saPc;
  return Math.floor((m - sa) / 12);
}
export function swaraLabel(m, saPc = 0, raga = null, withOct = true) {
  const n = swaraName(m, saPc, raga);
  const o = swaraOctave(m, saPc);
  const base = n.length > 1 ? n[0] + subscript(n.slice(1)) : n;
  if (!withOct || o === 0) return base;
  return o > 0 ? base + '˙'.repeat(o) : '.'.repeat(-o) + base;
}
const SUBS = { 1: '₁', 2: '₂', 3: '₃' };
const subscript = (s) => s.split('').map((c) => SUBS[c] || c).join('');

// ---------- Ragas used constantly in Tamil film music ----------
export const RAGAS = [
  { id: 'mayamalavagowla', name: 'Mayamalavagowla', ta: 'மாயாமாளவகௌளை', mela: 15, semis: [0, 1, 4, 5, 7, 8, 11], swaras: ['S', 'R1', 'G3', 'M1', 'P', 'D1', 'N3'], western: 'Double harmonic major ("Bhairav")',
    about: 'The first raga every Carnatic student learns — sarali, janta and alankaram exercises are traditionally sung in it. Flat Ri and flat Dha with natural Ga and Ni give it a devotional, early-morning colour.' },
  { id: 'shankarabharanam', name: 'Shankarabharanam', ta: 'சங்கராபரணம்', mela: 29, semis: [0, 2, 4, 5, 7, 9, 11], swaras: ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N3'], western: 'Major scale (Ionian)',
    about: 'Exactly the Western major scale — all white keys from C. Anything you learn in "C major" is Shankarabharanam with Sa = C.' },
  { id: 'kalyani', name: 'Kalyani', ta: 'கல்யாணி', mela: 65, semis: [0, 2, 4, 6, 7, 9, 11], swaras: ['S', 'R2', 'G3', 'M2', 'P', 'D2', 'N3'], western: 'Lydian mode',
    about: 'Major scale with a raised Ma (prati madhyamam, F♯ when Sa = C). That one sharp note gives the bright, glowing feel you hear in countless romantic and devotional film melodies.' },
  { id: 'harikambhoji', name: 'Harikambhoji', ta: 'ஹரிகாம்போஜி', mela: 28, semis: [0, 2, 4, 5, 7, 9, 10], swaras: ['S', 'R2', 'G3', 'M1', 'P', 'D2', 'N2'], western: 'Mixolydian mode',
    about: 'Major scale with a flat Ni (B♭ when Sa = C). Folk-flavoured and very common in kuthu and village-themed songs. Parent of Mohanam.' },
  { id: 'kharaharapriya', name: 'Kharaharapriya', ta: 'கரஹரப்ரியா', mela: 22, semis: [0, 2, 3, 5, 7, 9, 10], swaras: ['S', 'R2', 'G2', 'M1', 'P', 'D2', 'N2'], western: 'Dorian mode',
    about: 'Minor third and flat seventh with a natural sixth. Soulful but not dark. Parent of Shivaranjani, Madhyamavati and Abheri.' },
  { id: 'natabhairavi', name: 'Natabhairavi', ta: 'நடபைரவி', mela: 20, semis: [0, 2, 3, 5, 7, 8, 10], swaras: ['S', 'R2', 'G2', 'M1', 'P', 'D1', 'N2'], western: 'Natural minor (Aeolian)',
    about: 'The Western natural minor scale. Melancholic. Hindolam is derived from it.' },
  { id: 'keeravani', name: 'Keeravani', ta: 'கீரவாணி', mela: 21, semis: [0, 2, 3, 5, 7, 8, 11], swaras: ['S', 'R2', 'G2', 'M1', 'P', 'D1', 'N3'], western: 'Harmonic minor',
    about: 'Minor scale with a raised Ni — the dramatic "Middle-Eastern" leap between flat Dha and natural Ni. A favourite of film composers for intense melodies and background scores.' },
  { id: 'hanumatodi', name: 'Hanumatodi (Todi)', ta: 'தோடி', mela: 8, semis: [0, 1, 3, 5, 7, 8, 10], swaras: ['S', 'R1', 'G2', 'M1', 'P', 'D1', 'N2'], western: 'Phrygian mode',
    about: 'Every note except Sa, Ma and Pa is flattened. Heavy, serious and rich in gamakas.' },
  { id: 'charukesi', name: 'Charukesi', ta: 'சாருகேசி', mela: 26, semis: [0, 2, 4, 5, 7, 8, 10], swaras: ['S', 'R2', 'G3', 'M1', 'P', 'D1', 'N2'], western: 'Mixolydian ♭6 (melodic major)',
    about: 'Major in the lower half, minor in the upper half — a bittersweet, longing sound.' },
  { id: 'chakravakam', name: 'Chakravakam', ta: 'சக்ரவாகம்', mela: 16, semis: [0, 1, 4, 5, 7, 9, 10], swaras: ['S', 'R1', 'G3', 'M1', 'P', 'D2', 'N2'], western: 'Mixolydian ♭2 (Phrygian dominant ♮6)',
    about: 'Like Mayamalavagowla in the lower half but with a natural Dha and flat Ni. Devotional and soothing.' },
  { id: 'simhendramadhyamam', name: 'Simhendramadhyamam', ta: 'சிம்மேந்திரமத்யமம்', mela: 57, semis: [0, 2, 3, 6, 7, 8, 11], swaras: ['S', 'R2', 'G2', 'M2', 'P', 'D1', 'N3'], western: 'Hungarian minor',
    about: 'Harmonic minor with a raised Ma. Exotic and intense.' },
  { id: 'malahari', name: 'Malahari', ta: 'மலஹரி', parent: 'Mayamalavagowla', noEx: true, semis: [0, 1, 4, 5, 7, 8], swaras: ['S', 'R1', 'G3', 'M1', 'P', 'D1'], western: 'Asymmetric: up C D♭ F G A♭, down adds E',
    about: 'Arohanam S R1 M1 P D1 Ṡ, avarohanam Ṡ D1 P M1 G3 R1 S. The raga of the first geethams every Carnatic student learns, starting with Sri Gananatha.' },
  { id: 'mohanam', name: 'Mohanam', ta: 'மோகனம்', parent: 'Harikambhoji', semis: [0, 2, 4, 7, 9], swaras: ['S', 'R2', 'G3', 'P', 'D2'], western: 'Major pentatonic',
    about: 'Five notes, no Ma and no Ni — the black-key pentatonic sound. Joyful and impossible to play "wrong". Found in a huge number of film songs across every decade.' },
  { id: 'hindolam', name: 'Hindolam', ta: 'ஹிந்தோளம்', parent: 'Natabhairavi', semis: [0, 3, 5, 8, 10], swaras: ['S', 'G2', 'M1', 'D1', 'N2'], western: 'Minor pentatonic with ♭6 (no 2nd, no 5th)',
    about: 'Five notes with no Ri and no Pa. Meditative, late-night mood.' },
  { id: 'shivaranjani', name: 'Shivaranjani', ta: 'சிவரஞ்சனி', parent: 'Kharaharapriya', semis: [0, 2, 3, 7, 9], swaras: ['S', 'R2', 'G2', 'P', 'D2'], western: 'Minor-sixth pentatonic',
    about: 'Mohanam with a flattened Ga. The classic sound of pathos and longing — film composers reach for it for sad songs.' },
  { id: 'hamsadhwani', name: 'Hamsadhwani', ta: 'ஹம்சத்வனி', parent: 'Shankarabharanam', semis: [0, 2, 4, 7, 11], swaras: ['S', 'R2', 'G3', 'P', 'N3'], western: 'Major pentatonic with maj7 instead of 6',
    about: 'Bright and auspicious. Concerts traditionally open with it.' },
  { id: 'madhyamavati', name: 'Madhyamavati', ta: 'மத்யமாவதி', parent: 'Kharaharapriya', semis: [0, 2, 5, 7, 10], swaras: ['S', 'R2', 'M1', 'P', 'N2'], western: 'Suspended pentatonic (Egyptian)',
    about: 'Five notes, no Ga and no Dha. Auspicious — concerts traditionally end with it.' },
  { id: 'suddhadhanyasi', name: 'Suddha Dhanyasi', ta: 'சுத்த தன்யாசி', parent: 'Kharaharapriya', semis: [0, 3, 5, 7, 10], swaras: ['S', 'G2', 'M1', 'P', 'N2'], western: 'Minor pentatonic',
    about: 'Exactly the minor pentatonic (the blues/rock box scale). Folk-like and cheerful.' },
  { id: 'revati', name: 'Revati', ta: 'ரேவதி', parent: 'Ratnangi', semis: [0, 1, 5, 7, 10], swaras: ['S', 'R1', 'M1', 'P', 'N2'], western: 'Pentatonic with ♭2',
    about: 'Spiritual and chant-like.' },
];
export const RAGA_BY_ID = Object.fromEntries(RAGAS.map((r) => [r.id, r]));

// ---------- Chords ----------
const CHORD_TYPES = {
  '': [0, 4, 7], maj: [0, 4, 7], M: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7], '-': [0, 3, 7],
  '5': [0, 7], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], M7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10], min7: [0, 3, 7, 10], mmaj7: [0, 3, 7, 11], dim: [0, 3, 6], '°': [0, 3, 6], dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10], 'ø': [0, 3, 6, 10], aug: [0, 4, 8], '+': [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7],
  '7sus4': [0, 5, 7, 10], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], '9': [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14],
};
export const COMMON_CHORDS = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'D', 'E', 'A', 'Bb', 'Cm', 'Fm', 'Gm', 'G7', 'C7', 'E7', 'A7', 'D7', 'Bm', 'Bdim', 'Cmaj7', 'Fmaj7', 'Am7', 'Dm7', 'Csus4', 'Gsus4'];

/** Parse chord symbol like "C#m7/G#" → {root, type, intervals, bass, name} or null */
export function parseChord(sym) {
  const s = String(sym).trim();
  const mm = /^([A-G])(#|b|♯|♭)?([^/]*)(?:\/([A-G](?:#|b|♯|♭)?))?$/.exec(s);
  if (!mm) return null;
  const root = parseNoteName(mm[1] + (mm[2] || ''));
  const type = mm[3] || '';
  const iv = CHORD_TYPES[type];
  if (!root || !iv) return null;
  let bass = null;
  if (mm[4]) { const b = parseNoteName(mm[4]); if (!b) return null; bass = b.pc; }
  return { root: root.pc, type, intervals: iv, bass, name: s };
}

/**
 * Voice a chord for the left hand (around C3) or right hand (around C4).
 * style: 'block' (full chord), 'root' (root only), 'root5' (root + fifth), 'shell'
 */
export function voiceChord(ch, { hand = 'L', style = 'block' } = {}) {
  if (!ch) return [];
  const center = hand === 'L' ? 48 : 60; // C3 / C4
  let base = center + ch.root;
  if (ch.root >= 7) base -= 12; // keep G..B roots below the centre C
  const notes = [];
  if (style === 'root') notes.push(base);
  else if (style === 'root5') notes.push(base, base + 7);
  else ch.intervals.forEach((i) => notes.push(base + (i >= 12 ? i - 12 : i)));
  const uniq = [...new Set(notes)].sort((a, b) => a - b);
  if (ch.bass != null && style === 'block') {
    let b = uniq[0] - 1; while (pc(b) !== ch.bass) b--;
    if (uniq[0] - b > 9) b += 12; // avoid a huge gap
    if (!uniq.includes(b)) uniq.unshift(b);
    return [...new Set(uniq)].sort((a, x) => a - x);
  }
  return uniq;
}

// ---------- Key detection (Krumhansl–Schmuckler) ----------
const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a, b) {
  const ma = a.reduce((s, x) => s + x, 0) / 12, mb = b.reduce((s, x) => s + x, 0) / 12;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db || 1);
}
export function detectKey(notes) {
  const h = new Array(12).fill(0);
  notes.forEach((n) => (h[pc(n.m)] += Math.min(n.d || 1, 4)));
  if (h.every((x) => x === 0)) return 'C';
  let best = 'C', bs = -2;
  for (let k = 0; k < 12; k++) {
    const rot = (prof) => prof.map((_, i) => prof[pc(i - k)]);
    const cM = corr(h, rot(KK_MAJ)), cm = corr(h, rot(KK_MIN));
    if (cM > bs) { bs = cM; best = MAJOR_KEYS[k]; }
    if (cm > bs) { bs = cm; best = MINOR_KEYS[k]; }
  }
  return best;
}

export const beatsPerBar = (ts) => (ts && ts.length === 2 ? ts[0] * (4 / ts[1]) : 4);

/** For a raga song: map each raga pitch-class to the letter of its swara (S R G M P D N = consecutive letters from Sa). */
export function ragaLetterMap(raga, saPc = 0, saLetter = null) {
  if (!raga) return null;
  const letters = LETTERS;
  const base = saLetter ? letters.indexOf(saLetter) : letters.indexOf(spell(60 + saPc).letter);
  const order = { S: 0, R: 1, G: 2, M: 3, P: 4, D: 5, N: 6 };
  const map = {};
  raga.semis.forEach((s, i) => { map[pc(saPc + s)] = letters[(base + order[raga.swaras[i][0]]) % 7]; });
  return map;
}
/** letter of a key's tonic as written ("Bb" -> "B", "F#m" -> "F") */
export const keyLetter = (key) => String(key || 'C')[0].toUpperCase();
