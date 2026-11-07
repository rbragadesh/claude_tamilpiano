import { UNITS, BUILTIN_SONGS, ragaScaleSong, chordDrill } from '../js/content.js';
import { RAGAS, noteName } from '../js/theory.js';
let bad = 0;
const chk = (name, s) => {
  if (s.warnings.length) { bad++; console.log('WARN', name, s.warnings); }
  if (!s.notes.length) { bad++; console.log('EMPTY', name); }
};
UNITS.forEach((u) => u.lessons.forEach((l) => l.exercises.forEach((e) => chk(l.id + ' ' + e.title, e.song))));
BUILTIN_SONGS.forEach((s) => chk(s.title, s));
RAGAS.forEach((r) => chk(r.id, ragaScaleSong(r)));
chk('drill', chordDrill(['C', 'F', 'G', 'Am']));
const k = BUILTIN_SONGS.find((s) => s.id === 'p_keeravani');
console.log('keeravani first notes', k.notes.slice(0, 8).map((n) => noteName(n.m)).join(' '), 'sa', k.sa);
const sar = BUILTIN_SONGS.find((s) => s.id === 'p_sarali1');
console.log('sarali1', sar.notes.map((n) => noteName(n.m, true)).join(' '));
console.log('lessons', UNITS.reduce((a, u) => a + u.lessons.length, 0), 'pieces', BUILTIN_SONGS.length, bad ? 'PROBLEMS ' + bad : 'all clean');
process.exit(bad ? 1 : 0);
