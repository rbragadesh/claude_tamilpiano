import assert from 'node:assert/strict';
import * as T from '../js/theory.js';
import { parseNotation, parseChordLine, buildSong, detectMode } from '../js/notation.js';
import { parseMidi, extractParts, partsToSong } from '../js/midi.js';

let n = 0; const ok = (name, fn) => { fn(); n++; console.log('✓', name); };

ok('spell', () => {
  assert.equal(T.spell(60).step, 28);
  assert.deepEqual([T.spell(66, 1).letter, T.spell(66, 1).acc], ['F', 1]);
  assert.deepEqual([T.spell(70, -1).letter, T.spell(70, -1).acc], ['B', -1]);
  assert.deepEqual([T.spell(61, 0, 'flat').letter, T.spell(61, 0, 'flat').acc], ['D', -1]);
  assert.equal(T.spell(71, -7).letter, 'C'); assert.equal(T.spell(71, -7).octave, 5); // Cb5 = B4
});
ok('chords', () => {
  assert.deepEqual(T.voiceChord(T.parseChord('C')), [48, 52, 55]);
  assert.deepEqual(T.voiceChord(T.parseChord('Am')), [45, 48, 52]);
  assert.deepEqual(T.voiceChord(T.parseChord('G7')), [43, 47, 50, 53]);
  assert.ok(T.parseChord('C/E')); assert.equal(T.parseChord('Xyz'), null);
  const ce = T.voiceChord(T.parseChord('C/E')); assert.equal(ce[0] % 12, 4);
});
ok('swara', () => {
  assert.equal(T.swaraName(61, 0, T.RAGA_BY_ID.mayamalavagowla), 'R1');
  assert.equal(T.swaraName(66, 0, T.RAGA_BY_ID.kalyani), 'M2');
  assert.equal(T.swaraName(69, 9), 'S');
  assert.equal(T.swaraLabel(72, 0), 'S˙');
});
ok('western basic', () => {
  const r = parseNotation('C D E F | G - - - |');
  assert.deepEqual(r.notes.map((x) => x.m), [60, 62, 64, 65, 67]);
  assert.equal(r.notes[4].d, 4); assert.equal(r.warnings.length, 0);
});
ok('sargam + raga', () => {
  const r = parseNotation("S R G M P D N S'", { raga: 'mayamalavagowla' });
  assert.equal(r.mode, 'sargam');
  assert.deepEqual(r.notes.map((x) => x.m), [60, 61, 64, 65, 67, 68, 71, 72]);
  const r2 = parseNotation('Sa Ri Ga Ma Pa Dha Ni Ṡ');
  assert.deepEqual(r2.notes.map((x) => x.m), [60, 62, 64, 65, 67, 69, 71, 72]);
  const r3 = parseNotation('.N S , R G2 ;', { key: 'A' });
  assert.deepEqual(r3.notes.map((x) => x.m), [68, 69, 71, 72]);
  assert.equal(r3.notes[1].d, 2); assert.equal(r3.notes[3].d, 3);
});
ok('mixed carnatic + western', () => {
  const r = parseNotation('S R G C# E5 Pa');
  assert.deepEqual(r.notes.map((x) => x.m), [60, 62, 64, 61, 76, 67]);
});
ok('groups, rests, chords, octaves', () => {
  const r = parseNotation("(C D) E:2 _ [C E G]:2 C' B, (C D E) c--");
  const m = r.notes.map((x) => [x.t, x.d, x.m]);
  assert.deepEqual(m.slice(0, 3), [[0, 0.5, 60], [0.5, 0.5, 62], [1, 2, 64]]);
  assert.equal(r.rests[0].t, 3);
  assert.deepEqual(m.slice(3, 6).map((x) => x[2]), [60, 64, 67]); assert.equal(m[3][0], 4); assert.equal(m[3][1], 2);
  assert.equal(m[6][2], 72); assert.equal(m[7][2], 59);
  assert.ok(Math.abs(m[9][1] - 1 / 3) < 1e-3);
  assert.equal(m[11][1], 3); // c-- = 3 beats
});
ok('bar warnings', () => {
  const r = parseNotation('C D E | F G | A B C D |');
  assert.ok(r.warnings.some((w) => w.includes('2 beats')));
});
ok('detectMode', () => { assert.equal(detectMode('G G D G'), 'western'); assert.equal(detectMode('S R G G P'), 'sargam'); });
ok('chord line', () => {
  const c = parseChordLine('| C | Am | F G | % |');
  assert.deepEqual(c.chords.map((x) => [x.t, x.d, x.name]), [[0, 4, 'C'], [4, 4, 'Am'], [8, 2, 'F'], [10, 2, 'G'], [12, 2, 'F'], [14, 2, 'G']]);
  const c2 = parseChordLine('C:2 G:2 Am');
  assert.deepEqual(c2.chords.map((x) => x.t), [0, 2, 4]);
  const c3 = parseChordLine('| C | - | G7 | |');
  assert.equal(c3.chords[0].d, 8); assert.equal(c3.chords[1].d, 8);
});
ok('buildSong', () => {
  const s = buildSong({ title: 'x', key: 'C', bpm: 80 }, { rh: 'E G | C5', chords: '| C | Am |' });
  assert.equal(s.notes.filter((x) => x.h === 'L').length, 6);
  assert.equal(s.chords.length, 2);
});

// --- MIDI round trip ---
function writeMidi(tracks, division = 480, tempoUs = 600000) {
  const bytes = [];
  const push = (...b) => bytes.push(...b);
  const u32 = (x) => [(x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255];
  const vlq = (x) => { const o = [x & 127]; while ((x >>= 7)) o.unshift((x & 127) | 128); return o; };
  push(...[...'MThd'].map((c) => c.charCodeAt(0)), ...u32(6), 0, 1, 0, tracks.length + 1, division >> 8, division & 255);
  const trk = (evs) => { const body = []; evs.forEach((e) => body.push(...e)); body.push(0, 0xff, 0x2f, 0); push(...[...'MTrk'].map((c) => c.charCodeAt(0)), ...u32(body.length), ...body); };
  trk([[0, 0xff, 0x51, 3, (tempoUs >> 16) & 255, (tempoUs >> 8) & 255, tempoUs & 255], [0, 0xff, 0x58, 4, 3, 2, 24, 8]]);
  tracks.forEach(({ ch, notes }) => {
    const ev = [];
    notes.forEach(([t, d, m]) => { ev.push([t * division, 0x90 | ch, m, 90]); ev.push([(t + d) * division, 0x80 | ch, m, 0]); });
    ev.sort((a, b) => a[0] - b[0] || (a[1] & 0xf0) - (b[1] & 0xf0));
    let last = 0; const out = [];
    ev.forEach(([tk, st, m, vel], i) => { const dt = Math.round(tk - last); last = tk; out.push([...vlq(dt), st, m, vel]); });
    // use running status for note-ons of the same status
    trk(out);
  });
  return new Uint8Array(bytes).buffer;
}
ok('midi parse', () => {
  const buf = writeMidi([{ ch: 0, notes: [[4, 1, 72], [5, 1, 74], [6, 2, 76], [8, 1, 79], [9, 1, 77], [10, 1, 76], [11, 1, 74], [12, 3, 72]] }, { ch: 1, notes: [[4, 3, 48], [7, 3, 43], [10, 3, 45], [13, 2, 48]] }]);
  const md = parseMidi(buf);
  assert.equal(md.division, 480); assert.equal(md.tempos[0].us, 600000);
  const parts = extractParts(md);
  assert.equal(parts.length, 2);
  const rh = parts.find((p) => p.guess === 'R'); const lh = parts.find((p) => p.guess === 'L');
  assert.ok(rh && lh && rh.avg > lh.avg);
  const song = partsToSong(md, parts, { rh: rh.id, lh: lh.id });
  assert.equal(song.bpm, 100); assert.deepEqual(song.ts, [3, 4]);
  assert.equal(song.trimmedBeats, 3); // first note at beat 4 → trim 1 bar of 3/4
  assert.equal(song.notes[0].t, 1);
  assert.equal(song.notes.filter((x) => x.h === 'R').length, 8);
});
ok('key detect', () => {
  const s = parseNotation('A B C5 D5 E5 F5 G#5 A5 E5 C5 A:2');
  assert.equal(T.detectKey(s.notes), 'Am');
});
console.log(`\n${n} tests passed`);
import { notesToText, suggestRagas } from '../js/notation.js';
{
  const src = "C D E:2 | (F G) A _ B | C5:4 |";
  const p = parseNotation(src);
  const txt = notesToText(p.notes);
  const back = parseNotation(txt);
  assert.deepEqual(back.notes.map((x) => [x.t, x.d, x.m]), p.notes.map((x) => [x.t, x.d, x.m]));
  const sg = notesToText(p.notes, { mode: 'sargam' });
  const back2 = parseNotation(sg, { mode: 'sargam' });
  assert.deepEqual(back2.notes.map((x) => x.m), p.notes.map((x) => x.m));
  const k = parseNotation('A4 B4 C5 E5 F5 G#5', { key: 'Am' });
  const sk = notesToText(k.notes, { mode: 'sargam', key: 'Am', raga: 'keeravani' });
  assert.equal(sk.split(' ')[0], 'S');
  assert.deepEqual(parseNotation(sk, { key: 'Am', raga: 'keeravani', mode: 'sargam' }).notes.map((x) => x.m), k.notes.map((x) => x.m));
  const mo = parseNotation('C D E G A G E D C');
  assert.equal(suggestRagas(mo.notes, 0)[0].id, 'mohanam');
  console.log('✓ notesToText round trip:', txt.replace(/\n/g, ' / '), '||', sg);
}
{
  const l = parseNotation('C D [C E G]:2 | G, - B, C |', { hand: 'L' });
  for (const mode of ['western', 'sargam']) {
    const txt = notesToText(l.notes, { hand: 'L', mode });
    const back = parseNotation(txt, { hand: 'L', mode });
    assert.deepEqual(back.notes.map((x) => [x.t, x.d, x.m]), l.notes.map((x) => [x.t, x.d, x.m]), mode + ' ' + txt);
  }
  console.log('✓ left-hand round trip');
}
{
  const p = parseNotation('# Pallavi\nC D E F | G - - - |\n# Charanam\nE F G A | G:4 |');
  const txt = notesToText(p.notes, { sections: p.sections });
  const back = parseNotation(txt);
  assert.deepEqual(back.sections, p.sections, txt);
  console.log('✓ sections preserved');
}
