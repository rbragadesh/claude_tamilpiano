// MusicXML import (.musicxml / .xml, and compressed .mxl as exported by MuseScore).
// Produces the same "parts" structure as the MIDI importer so the same track chooser can be used.

const MAJOR_BY_FIFTHS = { '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#' };
const MINOR_BY_FIFTHS = { '-6': 'Ebm', '-5': 'Bbm', '-4': 'Fm', '-3': 'Cm', '-2': 'Gm', '-1': 'Dm', 0: 'Am', 1: 'Em', 2: 'Bm', 3: 'F#m', 4: 'C#m', 5: 'G#m', 6: 'D#m' };
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Read a File/ArrayBuffer that may be .mxl (zip) or plain MusicXML text. Returns the XML string. */
export async function readMusicXml(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0x50 && u8[1] === 0x4b) return unzipMusicXml(u8);
  return new TextDecoder('utf-8').decode(u8);
}

async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .mxl files — export uncompressed MusicXML (.musicxml) instead');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipMusicXml(u8) {
  const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a valid .mxl file');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const entries = {};
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    entries[name] = { method, csize, local };
    p += 46 + nlen + xlen + clen;
  }
  const read = async (name) => {
    const e = entries[name]; if (!e) return null;
    const lp = e.local; const n = v.getUint16(lp + 26, true), x = v.getUint16(lp + 28, true);
    const data = u8.subarray(lp + 30 + n + x, lp + 30 + n + x + e.csize);
    const raw = e.method === 0 ? data : await inflateRaw(data);
    return dec.decode(raw);
  };
  let root = null;
  const container = await read('META-INF/container.xml');
  if (container) { const mm = /full-path="([^"]+)"/.exec(container); if (mm) root = mm[1]; }
  if (!root || !entries[root]) root = Object.keys(entries).find((n) => !n.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(n));
  if (!root) throw new Error('No score found inside the .mxl file');
  return read(root);
}

const txt = (el, sel) => { const x = el.querySelector(sel); return x ? x.textContent.trim() : null; };
const num = (el, sel, d = null) => { const t = txt(el, sel); return t == null || t === '' ? d : Number(t); };
const kids = (el, name) => [...el.children].filter((c) => c.tagName === name);

/**
 * Parse MusicXML text. Returns {title, composer, parts, bpm, ts, key, sections}
 * parts: [{id, name, notes:[{t,d,m}], count, min, max, avg, poly, guess, isDrum}]
 */
export function parseMusicXml(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Could not read this MusicXML file');
  const score = doc.querySelector('score-partwise');
  if (!score) throw new Error(doc.querySelector('score-timewise') ? 'Timewise MusicXML is not supported — re-export from MuseScore' : 'Not a MusicXML score');
  const title = txt(score, 'work > work-title') || txt(score, 'movement-title') || '';
  const composer = [...score.querySelectorAll('identification > creator')].filter((c) => (c.getAttribute('type') || '') === 'composer').map((c) => c.textContent.trim())[0] || '';
  const partNames = {};
  score.querySelectorAll('part-list > score-part').forEach((sp) => { partNames[sp.getAttribute('id')] = txt(sp, 'part-name') || sp.getAttribute('id'); });
  let bpm = null, ts = null, fifths = null, mode = null;
  const sections = [];
  const out = [];
  kids(score, 'part').forEach((part, pi) => {
    const pid = part.getAttribute('id');
    let divisions = 1, cursor = 0, lastStart = 0, measureStart = 0;
    const byStaff = new Map(); // staff -> notes
    const ties = new Map(); // key staff:midi -> open note
    let measureLen = 4;
    kids(part, 'measure').forEach((meas) => {
      cursor = measureStart; let maxCursor = measureStart;
      for (const el of meas.children) {
        const tag = el.tagName;
        if (tag === 'attributes') {
          divisions = num(el, 'divisions', divisions) || divisions;
          if (fifths == null && el.querySelector('key > fifths')) { fifths = num(el, 'key > fifths', 0); mode = txt(el, 'key > mode'); }
          if (el.querySelector('time > beats')) {
            const b = String(txt(el, 'time > beats')).split('+').reduce((s, x) => s + Number(x), 0), bt = num(el, 'time > beat-type', 4);
            if (!ts) ts = [b, bt];
            measureLen = b * 4 / bt;
          }
        } else if (tag === 'direction' || tag === 'sound') {
          const snd = tag === 'sound' ? el : el.querySelector('sound');
          if (snd && snd.getAttribute('tempo') && bpm == null) bpm = Math.round(Number(snd.getAttribute('tempo')));
          if (bpm == null && el.querySelector('metronome > per-minute')) bpm = Math.round(num(el, 'metronome > per-minute', 0)) || null;
          if (pi === 0) {
            const reh = txt(el, 'rehearsal') || null;
            if (reh) sections.push({ t: cursor / divisions, name: reh });
          }
        } else if (tag === 'backup') { cursor -= num(el, 'duration', 0); }
        else if (tag === 'forward') { cursor += num(el, 'duration', 0); }
        else if (tag === 'note') {
          if (el.querySelector('grace') || el.querySelector('cue')) continue;
          const dur = num(el, 'duration', 0);
          const isChord = !!el.querySelector('chord');
          const start = isChord ? lastStart : cursor;
          if (!isChord) { lastStart = cursor; cursor += dur; }
          if (cursor > maxCursor) maxCursor = cursor;
          if (el.querySelector('rest') || !el.querySelector('pitch') || el.querySelector('unpitched')) continue;
          const step = txt(el, 'pitch > step'), alter = num(el, 'pitch > alter', 0), oct = num(el, 'pitch > octave', 4);
          const m = (oct + 1) * 12 + STEP[step] + Math.round(alter);
          const staff = num(el, 'staff', 1);
          const tieTypes = [...el.querySelectorAll('tie')].map((t) => t.getAttribute('type'));
          const key = staff + ':' + m;
          if (tieTypes.includes('stop') && ties.has(key)) {
            const open = ties.get(key); open.d += dur / divisions;
            if (!tieTypes.includes('start')) ties.delete(key);
            continue;
          }
          const n = { t: start / divisions, d: dur / divisions, m };
          if (!byStaff.has(staff)) byStaff.set(staff, []);
          byStaff.get(staff).push(n);
          if (tieTypes.includes('start')) ties.set(key, n);
        }
      }
      // measure length: actual content, falling back to the time signature (handles pickup bars)
      const contentLen = (maxCursor - measureStart) / divisions;
      measureStart += Math.round((contentLen > 0 ? contentLen : measureLen) * divisions);
    });
    const staves = [...byStaff.keys()].sort();
    staves.forEach((st) => {
      const notes = byStaff.get(st).sort((a, b) => a.t - b.t || a.m - b.m);
      if (!notes.length) return;
      const ms = notes.map((n) => n.m);
      let poly = 0; for (let i = 1; i < notes.length; i++) if (Math.abs(notes[i].t - notes[i - 1].t) < 0.01) poly++;
      out.push({ id: `${pid}:${st}`, track: pi, ch: 0, isDrum: false,
        name: (partNames[pid] || `Part ${pi + 1}`) + (staves.length > 1 ? (st === 1 ? ' · right hand' : st === 2 ? ' · left hand' : ` · staff ${st}`) : ''),
        notes, count: notes.length, min: Math.min(...ms), max: Math.max(...ms), avg: ms.reduce((s, x) => s + x, 0) / ms.length, poly: poly / notes.length, start: notes[0].t, staff: st });
    });
  });
  // guesses: a piano part's staff 1 / 2, otherwise highest mostly-single-line part for melody
  const piano = out.filter((p) => p.staff === 1 && out.some((q) => q.track === p.track && q.staff === 2));
  if (piano.length && out.length === 2) { piano[0].guess = 'R'; out.find((q) => q.track === piano[0].track && q.staff === 2).guess = 'L'; }
  else {
    const score2 = (x) => x.avg - 40 * x.poly + Math.min(x.count, 400) / 40;
    const c = out.slice().sort((a, b) => score2(b) - score2(a));
    if (c[0]) c[0].guess = 'R';
    const lh = c.filter((x) => x !== c[0]).sort((a, b) => a.avg - b.avg)[0];
    if (lh && lh.avg < c[0].avg - 5) lh.guess = 'L';
  }
  let key = null;
  if (fifths != null) key = (mode === 'minor' ? MINOR_BY_FIFTHS : MAJOR_BY_FIFTHS)[fifths] || null;
  return { title, composer, parts: out, bpm: bpm || 90, ts: ts || [4, 4], key, keyMode: mode, sections };
}

/** shape compatible with partsToSong() from midi.js */
export function asMidiLike(x) {
  return { tempos: [{ tick: 0, us: Math.round(60000000 / x.bpm) }], timeSigs: [{ tick: 0, num: x.ts[0], den: x.ts[1] }], division: 1 };
}
