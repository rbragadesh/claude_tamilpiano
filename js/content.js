// Built-in course. Every melody here is either a traditional Carnatic exercise (public domain)
// or an original composition written for this app. Film songs are added by you, into your own library.
import { buildSong } from './notation.js';
import { RAGA_BY_ID, SWARA_SEMI, RAGAS } from './theory.js';

export const COMPOSERS = ['Ilaiyaraaja', 'A. R. Rahman', 'Harris Jayaraj', 'Yuvan Shankar Raja', 'Bharathwaj', 'Vidyasagar',
  'M. S. Viswanathan', 'Deva', 'Vijay Antony', 'D. Imman', 'G. V. Prakash Kumar', 'Anirudh Ravichander', 'Santhosh Narayanan', 'Other'];
export const eraOf = (year) => { const y = Number(year); if (!y) return ''; if (y < 1980) return '70s'; if (y < 1990) return '80s'; if (y < 2000) return '90s'; if (y < 2010) return '2000s'; if (y < 2020) return '2010s'; return '2020s'; };

const K = (...ms) => ms; // keyboard highlight helper

function scaleNotation(raga) {
  const up = raga.swaras.join(' ');
  const down = raga.swaras.slice(1).reverse().join(' ');
  return `${up} S':2 ${down} S:3`;
}

export function ragaScaleSong(raga, saPc = 0, opts = {}) {
  return buildSong({ id: 'scale_' + raga.id + '_' + saPc, title: `${raga.name} — arohanam / avarohanam`, key: 'C', sa: saPc, raga: raga.id, bpm: opts.bpm || 72, spelling: raga.semis.some((s) => [1, 3, 8, 10].includes(s)) ? 'flat' : null },
    { rh: scaleNotation(raga), mode: 'sargam' });
}

const piece = (meta, src) => ({ meta: { composer: 'Isai Keys (original)', level: 1, ...meta }, src });

export const PIECES = {
  kolamWalk: piece({ id: 'p_kolam', title: 'Kolam Walk', key: 'C', bpm: 80 },
    { rh: 'C E D F | E G F - | G F E D | C - - - | E F G E | F D E C | D E F D | C - - - |' }),
  nadaswaram: piece({ id: 'p_nadaswaram', title: 'Nadaswaram Call', key: 'C', bpm: 76 },
    { rh: 'C:1.5 D:0.5 E F | G:1.5 A:0.5 G - | F:1.5 E:0.5 D E | C - - - |' }),
  marina: piece({ id: 'p_marina', title: 'Marina Evening', key: 'C', bpm: 84, level: 2 }, {
    rh: `# Phrase A
G4 - E4 - | A4 - E4 - | F4 - A4 C5 | B4 - D5 - |
C5 - G4 E4 | E4 - A4 - | A4 G4 F4 A4 | G4 - - - |
# Phrase B
E4 - G4 C5 | A4 - C5 E5 | F5 - E5 C5 | D5 - B4 G4 |
C5 - G4 E4 | A4 G4 E4 C4 | D4 E4 F4 D4 | C4 - - - |`,
    chords: '| C | Am | F | G | C | Am | F | G | C | Am | F | G | C | Am | G | C |', chordStyle: 'root' }),
  mohanam: piece({ id: 'p_mohanam', title: 'Morning in Mohanam', key: 'C', raga: 'mohanam', bpm: 84, level: 2 }, {
    rh: `# Pallavi
E - G A | G E D - | E G A C' | A - G - |
G A G E | D E D C | D E G E | C - - - |
# Anupallavi
G A C' D' | E' - D' C' | A C' A G | E - G - |
A G E D | C D E G | E D (C D) E | C - - - |`,
    chords: '| C | Am | C | Am | G | C | G | C | C | Am | F | C | Am | G | G | C |', chordStyle: 'root' }),
  kalyani: piece({ id: 'p_kalyani', title: 'Kalyani Lamp', key: 'C', raga: 'kalyani', bpm: 76, level: 3, spelling: 'sharp' }, {
    rh: `# Pallavi
C E F# G | A - G - | F# E D E | C - - - |
E F# G A | B C' B A | G F# E D | C - - - |
# Charanam
G A B C' | D' - C' B | A B G F# | E - - - |
F# G A B | C' - B A | G F# (E F#) D | C - - - |`,
    chords: '| C | D | D | C | C | G | D | C | G | Bm | D | Em | D | Am | D | C |', chordStyle: 'root' }),
  keeravani: piece({ id: 'p_keeravani', title: 'Keeravani Rain', key: 'Am', raga: 'keeravani', bpm: 72, level: 3 }, {
    rh: `# Pallavi
A4 - B4 C5 | B4 A4 G#4 A4 | E4 - F4 E4 | D4 - E4 - |
F4 G#4 A4 B4 | C5 B4 A4 G#4 | A4 B4 G#4 E4 | A4 - - - |
# Rise
E5 - D5 C5 | B4 C5 D5 B4 | C5 - B4 A4 | G#4 - E4 - |
F4 - E4 F4 | G#4 A4 B4 C5 | B4 - G#4 B4 | A4 - - - |`,
    chords: '| Am | Am | Am | Dm | Dm | Am | E | Am | Am | E | Am | E | Dm | Am | E | Am |', chordStyle: 'root' }),
  shivaranjani: piece({ id: 'p_shivaranjani', title: 'Shivaranjani Dusk', key: 'C', raga: 'shivaranjani', bpm: 66, level: 3, spelling: 'flat' }, {
    rh: `# Pallavi
G - A G | Eb - D C | D Eb G A | G - - - |
C' - A G | A G Eb D | Eb D C D | C - - - |
# Low
C D Eb G | A - G Eb | D - Eb D | C - A, - |
C - D Eb | D C A, G, | A, C D Eb | C - - - |`,
    chords: '| Cm | Cm | F | Cm | F | F | Cm | Cm | Cm | F | Cm | Cm | Cm | F | F | Cm |', chordStyle: 'root' }),
  hindolam: piece({ id: 'p_hindolam', title: 'Night Hindolam', key: 'Cm', raga: 'hindolam', bpm: 60, level: 3 }, {
    rh: `# Pallavi
C - Eb F | Ab - F Eb | F Ab Bb C' | Bb - Ab - |
F Ab F Eb | C - Eb F | Eb - C Bb, | C - - - |
# Upper
Ab Bb C' Eb' | F' - Eb' C' | Bb C' Bb Ab | F - Eb - |
F Ab Bb Ab | F Eb C Eb | F - Eb Bb, | C - - - |`,
    chords: '| Cm | Fm | Fm | Bb | Fm | Cm | Ab | Cm | Ab | Fm | Bb | Fm | Fm | Cm | Fm | Cm |', chordStyle: 'root' }),
  sarali1: piece({ id: 'p_sarali1', title: 'Sarali Varisai 1 (Mayamalavagowla)', composer: 'Traditional', key: 'C', raga: 'mayamalavagowla', bpm: 72, spelling: 'flat' },
    { rh: "S R G M | P D N S' | S' N D P | M G R S |", mode: 'sargam' }),
  sarali2: piece({ id: 'p_sarali2', title: 'Sarali Varisai 2 (Mayamalavagowla)', composer: 'Traditional', key: 'C', raga: 'mayamalavagowla', bpm: 72, spelling: 'flat' },
    { rh: "S R S R | S R G M | S R G M | P D N S' | S' N S' N | S' N D P | S' N D P | M G R S |", mode: 'sargam' }),
  sarali3: piece({ id: 'p_sarali3', title: 'Sarali Varisai 3 (Mayamalavagowla)', composer: 'Traditional', key: 'C', raga: 'mayamalavagowla', bpm: 72, spelling: 'flat' },
    { rh: "S R G S | R G S R | S R G M | P D N S' | S' N D S' | N D S' N | S' N D P | M G R S |", mode: 'sargam' }),
  janta1: piece({ id: 'p_janta1', title: 'Janta Varisai 1 (Mayamalavagowla)', composer: 'Traditional', key: 'C', raga: 'mayamalavagowla', bpm: 66, spelling: 'flat' },
    { rh: "S S R R | G G M M | P P D D | N N S' S' | S' S' N N | D D P P | M M G G | R R S S |", mode: 'sargam' }),
};

const song = (p, over = {}) => buildSong({ ...p.meta, ...over.meta }, { ...p.src, ...over.src });
const ex = (title, s, opts = {}) => ({ title, song: s, mode: 'wait', hands: 'B', tempo: 1, ...opts });
const simple = (id, title, rh, meta = {}, src = {}) => buildSong({ id, title, key: 'C', bpm: 72, ...meta }, { rh, ...src });

const r = (id) => RAGA_BY_ID[id];

export const UNITS = [
  {
    id: 'u1', title: 'First notes', ta: 'முதல் ஸ்வரங்கள்', blurb: 'Find Sa, and play C D E F G = Sa Ri Ga Ma Pa',
    lessons: [
      { id: 'u1l1', title: 'Find Sa (Middle C)', cards: [
        { title: 'The keyboard repeats', text: 'Keys come in a repeating pattern of 12: seven white and five black. Look for the group of <b>two black keys</b>. The white key just to the left of them is <b>C</b>.', keys: K(48, 60, 72) },
        { title: 'C = Sa', text: 'In Western music it is called <b>C</b>. In Carnatic music we treat it as <b>Sa (ஸ)</b>, the home note. This app always shows both names, so you learn them together.', keys: K(60) },
        { title: 'Middle C', text: 'The C nearest the centre of your keyboard is <b>middle C</b> (C4). Put your right-hand <b>thumb — finger 1</b> on it. Fingers are numbered thumb = 1 to little finger = 5.', keys: K(60) },
      ], exercises: [ex('Play Sa', simple('u1l1a', 'Play Sa', 'C@1 C C C | C - C - | C C C C | C - - - |'), { hands: 'R' })] },
      { id: 'u1l2', title: 'C D E = Sa Ri Ga', cards: [
        { title: 'Three neighbours', text: 'Next to C are <b>D</b> and <b>E</b> — in Carnatic, <b>Ri</b> and <b>Ga</b>. Thumb on C, finger 2 on D, finger 3 on E.', keys: K(60, 62, 64) },
      ], exercises: [ex('Sa Ri Ga', simple('u1l2a', 'Sa Ri Ga', 'C@1 D@2 E@3 - | E D C - | C D E D | C - - - | E D E D | C D E - | E D C D | C - - - |'), { hands: 'R' })] },
      { id: 'u1l3', title: 'F G = Ma Pa', cards: [
        { title: 'The five-finger position', text: 'Add <b>F (Ma)</b> with finger 4 and <b>G (Pa)</b> with finger 5. One finger per key, no jumping. This is your home base for the next few lessons.', keys: K(60, 62, 64, 65, 67) },
      ], exercises: [ex('Sa to Pa', simple('u1l3a', 'Sa to Pa', 'C@1 D E F | G@5 - - - | G F E D | C - - - | E F G F | E D C - | D E F E | D - C - |'), { hands: 'R' })] },
      { id: 'u1l4', title: 'Your first tune', cards: [
        { title: 'Kolam Walk', text: 'A short original tune using only Sa Ri Ga Ma Pa. Notes wait for you — take your time, and play each note when it lights up.', keys: K(60, 62, 64, 65, 67) },
      ], exercises: [ex('Kolam Walk', song(PIECES.kolamWalk), { hands: 'R' })] },
    ],
  },
  {
    id: 'u2', title: 'Reading the staff', ta: 'ஸ்வரக் குறிப்பு', blurb: 'Lines, spaces and the treble clef — read notes, not just labels',
    lessons: [
      { id: 'u2l1', title: 'Lines and spaces', cards: [
        { title: 'The treble staff', text: 'Five lines. The curly <b>treble clef</b> wraps around the second line, which is <b>G (Pa)</b>. Notes sit either <b>on</b> a line or <b>in</b> a space; each step up is the next letter.', keys: K(67) },
        { title: 'Middle C on the staff', text: 'Middle <b>C (Sa)</b> sits on a short extra line below the staff (a <i>ledger line</i>). D hangs just below the bottom line, E sits on the bottom line, F in the first space, G on the second line.', keys: K(60, 62, 64, 65, 67) },
      ], exercises: [ex('Read C to G', simple('u2l1a', 'Read C to G', 'C D E F | G - - - | E - G - | D - F - | C E D F | E G F D | E - D - | C - - - |'), { hands: 'R' })] },
      { id: 'u2l2', title: 'Read without names', cards: [
        { title: 'No labels this time', text: 'The note names are hidden — read the position on the staff. The keyboard still shows a hint if you get stuck.', keys: K() },
      ], exercises: [ex('Reading test', simple('u2l2a', 'Reading test', 'E G F D | C E D - | G F E D | E - C - | F D G E | C - E - | D F E G | C - - - |'), { hands: 'R', labels: 'none' })] },
      { id: 'u2l3', title: 'A B C = Dha Ni Sa', cards: [
        { title: 'Reaching up', text: '<b>A (Dha)</b>, <b>B (Ni)</b> and the next <b>C — upper Sa (Ṡ)</b>. On the staff, A is in the second space, B on the middle line, upper C in the third space. Shift your hand up when you need to.', keys: K(69, 71, 72) },
      ], exercises: [ex('Up to upper Sa', simple('u2l3a', 'Up to upper Sa', "G A B C' | B A G - | E G A B | C' - - - | C' B A G | A G F E | D E F G | C - - - |"), { hands: 'R' })] },
      { id: 'u2l4', title: 'Sarali Varisai in C', cards: [
        { title: 'Sa Ri Ga Ma Pa Dha Ni Sa', text: 'All eight white keys from C to C is the Western <b>C major scale</b> — and exactly the raga <b>Shankarabharanam</b>. Here is the first sarali varisai on those notes, written in sargam.', keys: K(60, 62, 64, 65, 67, 69, 71, 72) },
      ], exercises: [ex('Sarali 1 in Shankarabharanam', buildSong({ id: 'u2l4a', title: 'Sarali 1 — Shankarabharanam', key: 'C', raga: 'shankarabharanam', bpm: 72 }, { rh: "S R G M | P D N S' | S' N D P | M G R S |", mode: 'sargam' }), { hands: 'R' })] },
    ],
  },
  {
    id: 'u3', title: 'Rhythm & beats', ta: 'தாளம்', blurb: 'Play in time with the metronome — quarters, halves, eighths, rests',
    lessons: [
      { id: 'u3l1', title: 'One beat per note', cards: [
        { title: 'Counting', text: 'Music moves on a steady <b>beat</b>. A filled note with a stem (♩) lasts <b>1 beat</b>. Four beats make a <b>bar</b>. Count "1 2 3 4" with the click — this is like keeping <b>tala</b> with your hand.' },
        { title: 'Play-along mode', text: 'Now the music does <b>not</b> wait. A one-bar count-in clicks first, then play each note as it reaches the gold line. You get Perfect, Early/Late or Miss.' },
      ], exercises: [ex('Steady beats', simple('u3l1a', 'Steady beats', 'C C E E | G G E - | F F D D | C - - - | E E G G | F F D - | E D C D | C - - - |', { bpm: 70 }), { hands: 'R', mode: 'play' })] },
      { id: 'u3l2', title: 'Long notes', cards: [
        { title: 'Half and whole notes', text: 'A hollow note with a stem lasts <b>2 beats</b>; a hollow note with no stem lasts all <b>4 beats</b>. Hold the key down while you count. The coloured bar behind each note shows how long to hold it.' },
      ], exercises: [ex('Hold it', simple('u3l2a', 'Hold it', "C - E - | G - - - | F - D - | C - - - | E - G - | C' - - - | G - E - | C - - - |", { bpm: 76 }), { hands: 'R', mode: 'play' })] },
      { id: 'u3l3', title: 'Two notes per beat', cards: [
        { title: 'Eighth notes — "ta-ka"', text: 'A note with a flag (♪) lasts <b>half a beat</b>. Two of them fit in one beat — count "1-and 2-and", or say "ta-ka" as in Carnatic rhythm syllables.' },
      ], exercises: [ex('Ta-ka', simple('u3l3a', 'Ta-ka', '(C D) E (E F) G | (G F) (E D) C - | (E F) G (G A) G | (F E) D C - |', { bpm: 66 }), { hands: 'R', mode: 'play' })] },
      { id: 'u3l4', title: 'Rests', cards: [
        { title: 'Silence counts', text: 'A <b>rest</b> means "don\'t play" for that many beats — but keep counting. The zig-zag sign is a one-beat rest.' },
      ], exercises: [ex('Rests', simple('u3l4a', 'Rests', 'C _ E _ | G _ E _ | F F _ D | C - - _ | E _ G G | F _ D _ | E D C _ | C - - _ |', { bpm: 72 }), { hands: 'R', mode: 'play' })] },
      { id: 'u3l5', title: 'Dotted rhythm', cards: [
        { title: 'Long–short', text: 'A dot adds half the note\'s length: a dotted quarter = 1½ beats, usually followed by a half-beat note. It gives a lilting, festive swing.' },
      ], exercises: [ex('Nadaswaram Call', song(PIECES.nadaswaram), { hands: 'R', mode: 'play' })] },
    ],
  },
  {
    id: 'u4', title: 'Left hand', ta: 'இடது கை', blurb: 'The bass clef, and both hands together',
    lessons: [
      { id: 'u4l1', title: 'The bass clef', cards: [
        { title: 'F clef', text: 'The left hand reads the <b>bass clef</b>. Its two dots surround the fourth line, which is <b>F (Ma)</b> below middle C. The C an octave below middle C is in the second space.', keys: K(48, 53) },
        { title: 'Left-hand position', text: 'Little finger (5) on the lower C, thumb (1) on G. Same notes, same names — C D E F G = Sa Ri Ga Ma Pa — just one octave lower (mandra sthayi).', keys: K(48, 50, 52, 53, 55) },
      ], exercises: [ex('Left hand C to G', simple('u4l1a', 'Left hand C to G', '', {}, { lh: 'C@5 D E F | G@1 - - - | G F E D | C - - - | E F G F | E D C - | D E F E | D - C - |' }), { hands: 'L' })] },
      { id: 'u4l2', title: 'Left-hand sarali', cards: [{ title: 'Mandra sthayi', text: 'The first sarali varisai, one octave lower, left hand.', keys: K(48, 50, 52, 53, 55, 57, 59, 60) }],
        exercises: [ex('Sarali 1 left hand', buildSong({ id: 'u4l2a', title: 'Sarali 1 — left hand', key: 'C', raga: 'shankarabharanam', bpm: 72 }, { lh: "S R G M | P D N S' | S' N D P | M G R S |", mode: 'sargam' }), { hands: 'L' })] },
      { id: 'u4l3', title: 'Hands together: Sa–Pa drone', cards: [
        { title: 'Like a tanpura', text: 'The left hand holds <b>C and G (Sa and Pa)</b> together while the right hand plays a melody — the same idea as the tanpura drone behind Carnatic singing.', keys: K(48, 55) },
      ], exercises: [ex('Drone and melody', simple('u4l3a', 'Drone and melody', 'E F G - | A G F E | D E F D | C - - - | G F E D | E F G E | D - E D | C - - - |', { bpm: 66 }, { lh: '[C G]:4 | [C G]:4 | [C G]:4 | [C G]:4 | [C G]:4 | [C G]:4 | [C G]:4 | [C G]:4 |' }), { hands: 'B' })] },
    ],
  },
  {
    id: 'u5', title: 'Chords', ta: 'ஸ்வர இணைப்பு', blurb: 'Major and minor chords, progressions, inversions — the backbone of film songs',
    lessons: [
      { id: 'u5l1', title: 'C major chord', cards: [
        { title: 'Three notes at once', text: 'A <b>chord</b> is several notes played together. <b>C major = C E G = Sa Ga Pa</b>. Right hand fingers 1, 3 and 5. Press all three at the same moment.', keys: K(60, 64, 67) },
      ], exercises: [ex('C chord', simple('u5l1a', 'C chord', '[C E G]:4 | [C E G]:4 | [C E G]:2 [C E G]:2 | [C E G]:4 |'), { hands: 'R' })] },
      { id: 'u5l2', title: 'F and G: I–IV–V', cards: [
        { title: 'The three main chords', text: 'Build the same shape on F (<b>F A C</b>) and on G (<b>G B D</b>). C, F and G — chords I, IV and V — can accompany a huge number of simple melodies.', keys: K(65, 69, 72) },
      ], exercises: [ex('I – IV – V – I', simple('u5l2a', 'I IV V I', "[C E G]:4 | [F A C']:4 | [G B D']:4 | [C E G]:4 | [F A C']:4 | [C E G]:4 | [G B D']:4 | [C E G]:4 |"), { hands: 'R' })] },
      { id: 'u5l3', title: 'Minor chords', cards: [
        { title: 'Darker colour', text: 'Lower the middle note by one key and major becomes <b>minor</b>. Am = A C E, Dm = D F A, Em = E G B. Minor chords carry the emotion in many Tamil melodies.', keys: K(69, 72, 76) },
      ], exercises: [ex('Am Dm Em', simple('u5l3a', 'Am Dm Em', "[A C' E']:4 | [D F A]:4 | [E G B]:4 | [A C' E']:4 | [D F A]:4 | [A C' E']:4 | [E G B]:4 | [A C' E']:4 |"), { hands: 'R' })] },
      { id: 'u5l4', title: 'Left-hand chords: C Am F G', cards: [
        { title: 'The "film-song" progression', text: '<b>C → Am → F → G</b> is one of the most-used chord loops in pop and film music. Play it as left-hand chords — the chord names appear above the staff.', keys: K(48, 52, 55) },
      ], exercises: [ex('C Am F G', buildSong({ id: 'u5l4a', title: 'C Am F G', key: 'C', bpm: 72 }, { chords: '| C | Am | F | G | C | Am | F | G |', chordStyle: 'block' }), { hands: 'L' })] },
      { id: 'u5l5', title: 'Both hands: Marina Evening', cards: [
        { title: 'Melody + bass', text: 'Right hand plays the tune, left hand plays the root of each chord. Learn it hands-separately first (tap the hand selector), then together.' },
      ], exercises: [ex('Right hand only', song(PIECES.marina), { hands: 'R' }), ex('Both hands', song(PIECES.marina), { hands: 'B' })] },
      { id: 'u5l6', title: 'Inversions', cards: [
        { title: 'Smooth changes', text: 'Re-order a chord\'s notes so your hand barely moves: <b>C/E</b>, <b>F/C</b> (C F A) and <b>G/B</b> (B D G). Keyboard players use inversions constantly.', keys: K(60, 65, 69) },
      ], exercises: [ex('Inversions', simple('u5l6a', 'Inversions', '[C E G]:4 | [C F A]:4 | [B, D G]:4 | [C E G]:4 | [C F A]:4 | [C E G]:4 | [B, D G]:4 | [C E G]:4 |'), { hands: 'R' })] },
    ],
  },
  {
    id: 'u6', title: 'Ragas of Tamil film music', ta: 'திரை ராகங்கள்', blurb: 'Hear and play the scales behind the melodies you love',
    lessons: [
      { id: 'u6l1', title: 'Mayamalavagowla — sarali', cards: [
        { title: 'The beginner\'s raga', text: r('mayamalavagowla').about + ' On keyboard with Sa = C: <b>C D♭ E F G A♭ B C</b>.', keys: K(60, 61, 64, 65, 67, 68, 71, 72), raga: 'mayamalavagowla' },
      ], exercises: [ex('Sarali 1', song(PIECES.sarali1), { hands: 'R' }), ex('Sarali 2', song(PIECES.sarali2), { hands: 'R' }), ex('Sarali 3', song(PIECES.sarali3), { hands: 'R' })] },
      { id: 'u6l2', title: 'Janta varisai', cards: [
        { title: 'Double notes', text: 'Each swara twice: S S R R G G… Play every repeat clearly — lift and press again, don\'t just hold.' },
      ], exercises: [ex('Janta 1', song(PIECES.janta1), { hands: 'R' })] },
      { id: 'u6l3', title: 'Mohanam', cards: [
        { title: 'Five happy notes', text: r('mohanam').about + ' With Sa = C: <b>C D E G A</b>.', keys: K(60, 62, 64, 67, 69, 72), raga: 'mohanam' },
      ], exercises: [ex('Mohanam scale', ragaScaleSong(r('mohanam')), { hands: 'R' }), ex('Morning in Mohanam', song(PIECES.mohanam), { hands: 'R' })] },
      { id: 'u6l4', title: 'Kalyani', cards: [
        { title: 'The sharp Ma', text: r('kalyani').about, keys: K(60, 62, 64, 66, 67, 69, 71, 72), raga: 'kalyani' },
      ], exercises: [ex('Kalyani scale', ragaScaleSong(r('kalyani')), { hands: 'R' }), ex('Kalyani Lamp', song(PIECES.kalyani), { hands: 'R' })] },
      { id: 'u6l5', title: 'Keeravani', cards: [
        { title: 'Drama', text: r('keeravani').about + ' Here we take <b>Sa = A</b>, so it lines up with the Western A harmonic minor scale: A B C D E F G♯.', keys: K(69, 71, 72, 74, 76, 77, 80, 81), raga: 'keeravani', sa: 9 },
      ], exercises: [ex('Keeravani Rain', song(PIECES.keeravani), { hands: 'R' })] },
      { id: 'u6l6', title: 'Shivaranjani', cards: [
        { title: 'Pathos', text: r('shivaranjani').about + ' With Sa = C: <b>C D E♭ G A</b>.', keys: K(60, 62, 63, 67, 69, 72), raga: 'shivaranjani' },
      ], exercises: [ex('Shivaranjani scale', ragaScaleSong(r('shivaranjani')), { hands: 'R' }), ex('Shivaranjani Dusk', song(PIECES.shivaranjani), { hands: 'R' })] },
      { id: 'u6l7', title: 'Hindolam', cards: [
        { title: 'Night raga', text: r('hindolam').about + ' With Sa = C: <b>C E♭ F A♭ B♭</b>.', keys: K(60, 63, 65, 68, 70, 72), raga: 'hindolam' },
      ], exercises: [ex('Hindolam scale', ragaScaleSong(r('hindolam')), { hands: 'R' }), ex('Night Hindolam', song(PIECES.hindolam), { hands: 'R' })] },
    ],
  },
];

export const ALL_LESSONS = UNITS.flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u })));

/** built-in pieces shown in the Songs tab */
export const BUILTIN_SONGS = Object.values(PIECES).map((p) => ({ ...song(p), builtin: true }));

/** chord drill: random-ish sequence of the chosen chords, right hand */
export function chordDrill(names, bars = 8) {
  const seq = [];
  for (let i = 0; i < bars; i++) seq.push(names[(i * 7 + Math.floor(i / names.length)) % names.length]);
  return buildSong({ id: 'drill_' + names.join('_'), title: 'Chord drill: ' + names.join(' · '), key: 'C', bpm: 70 },
    { chords: '| ' + seq.join(' | ') + ' |', chordStyle: 'block' });
}
export function chordDrillRH(names, bars = 8) {
  const s = chordDrill(names, bars);
  s.notes.forEach((n) => { n.h = 'R'; n.m += 12; });
  s.id += '_rh';
  return s;
}
export { RAGAS, SWARA_SEMI };
