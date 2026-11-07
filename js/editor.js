// Song editor: metadata, notes (Western or sargam, interchangeable), chords, MIDI import, YouTube link.
import { buildSong, notesToText, suggestRagas, parseNotation, newId } from './notation.js';
import { parseMidi, extractParts, partsToSong } from './midi.js';
import { RAGAS, RAGA_BY_ID, ALL_KEYS, noteName, keyTonicPc } from './theory.js';
import { COMPOSERS } from './content.js';
import { putSong } from './store.js';
import { $, $$, esc, toast, openLayer, closeLayer, pickFile } from './ui.js';
import { parseYouTube, parseTime, fmtTime } from './youtube.js';
import { openPlayer, S, I } from './app.js';
import { unlockAudio } from './audio.js';

export const HELP = `Western:  C D E F G A B   sharps/flats: C# Eb
Carnatic: S R G M P D N   or  Sa Ri Ga Ma Pa Dha Ni
          variants R1 R2 G2 G3 M1 M2 D1 D2 N2 N3
          (without a number, the song's raga decides)
Mix them freely: S R G C# E5 Pa

Octaves:  C5 (absolute)   C' or S' = up one   C, or .S = down one
Length:   one beat each by default
          C:2  C:1/2  C:1.5     or hold with  C - -  /  S , ,
Rest:     _   (_:2 = two beats)
Fast:     (C D) = two notes in one beat   (S R G M) = four
Chord:    [C E G]   or chord names in the Chords box: | C | Am | F G |
Finger:   C@1
Bars:     | (optional — warns if a bar has the wrong count)
Sections: a line starting with #  e.g.  # Pallavi`;

/** song: existing song (or null for new). opts: {onSaved, importMidi, prefill:{...}} */
export function openEditor(song, opts = {}) {
  const isNew = !song || song.builtin;
  const base = song && !song.builtin ? song : null;
  const pre = opts.prefill || {};
  const meta = {
    id: base ? base.id : newId('song'),
    title: base?.title ?? pre.title ?? '', composer: base?.composer ?? pre.composer ?? '', movie: base?.movie ?? pre.movie ?? '', year: base?.year ?? pre.year ?? '',
    key: base?.key ?? pre.key ?? 'C', raga: base?.raga ?? pre.raga ?? '', bpm: base?.bpm ?? pre.bpm ?? 90, ts: base?.ts ?? pre.ts ?? [4, 4],
    yt: base?.yt ?? pre.yt ?? null, spelling: base?.spelling ?? null, sa: base?.sa,
  };
  const src = { rh: base?.src?.rh ?? pre.rh ?? '', lh: base?.src?.lh ?? pre.lh ?? '', chords: base?.src?.chords ?? pre.chords ?? '', chordStyle: base?.src?.chordStyle ?? 'root', mode: 'auto' };
  if (base && !base.src) { // imported songs without text: generate text from notes
    src.rh = notesToText(base.notes.filter((n) => n.h === 'R'), { key: base.key, ts: base.ts });
    src.lh = notesToText(base.notes.filter((n) => n.h === 'L'), { key: base.key, ts: base.ts, hand: 'L' });
  }
  const composerOpts = COMPOSERS.map((c) => `<option ${meta.composer === c ? 'selected' : ''}>${esc(c)}</option>`).join('');
  const el = openLayer(`
    <div class="topbar"><button class="icon" data-close>${I.close}</button><h2>${isNew ? 'New song' : 'Edit song'}</h2><button class="btn primary small" id="esave">Save</button></div>
    <div class="wrap">
    <label class="f">Title</label><input class="in" id="etitle" value="${esc(meta.title)}" placeholder="Song title">
    <div class="grid2"><div><label class="f">Composer</label><select class="in" id="ecomp"><option value="">—</option>${composerOpts}</select></div>
      <div><label class="f">Film / album</label><input class="in" id="emovie" value="${esc(meta.movie)}"></div></div>
    <div class="grid3"><div><label class="f">Year</label><input class="in" id="eyear" inputmode="numeric" value="${esc(meta.year)}"></div>
      <div><label class="f">Tempo (BPM)</label><input class="in" id="ebpm" inputmode="numeric" value="${esc(meta.bpm)}"></div>
      <div><label class="f">Beats</label><select class="in" id="ets">${['4/4', '3/4', '2/4', '6/8', '12/8'].map((t) => `<option ${meta.ts.join('/') === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="grid2"><div><label class="f">Key (Sa)</label><select class="in" id="ekey">${ALL_KEYS.map((k) => `<option ${meta.key === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div><label class="f">Raga (optional)</label><select class="in" id="eraga"><option value="">—</option>${RAGAS.map((r) => `<option value="${r.id}" ${meta.raga === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div></div>

    <div class="row gap" style="margin-top:16px"><label class="f grow" style="margin:0">Right hand / melody</label>
      <div class="seg" id="econv"><button data-to="western">→ C D E</button><button data-to="sargam">→ S R G</button></div></div>
    <textarea class="in" id="erh" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="e.g.  E G A G | E D C - |   or   G P D P | G R S , |">${esc(src.rh)}</textarea>
    <label class="f">Chords (optional — fills the left hand)</label>
    <textarea class="in" id="ech" spellcheck="false" autocapitalize="off" style="min-height:60px" placeholder="| C | Am | F | G |">${esc(src.chords)}</textarea>
    <div class="toggle" style="border:0;padding-top:6px"><div class="tl" style="font-size:14px">Left hand from chords</div>
      <div class="seg" id="estyle">${[['root', 'Root'], ['root5', 'Root+5th'], ['block', 'Full chord']].map(([v, l]) => `<button data-v="${v}" class="${src.chordStyle === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <label class="f">Left hand notes (optional — overrides chords)</label>
    <textarea class="in" id="elh" spellcheck="false" autocapitalize="off" style="min-height:60px">${esc(src.lh)}</textarea>
    <div class="card" id="estatus" style="margin-top:12px"></div>
    <div class="grid2"><button class="btn" id="eprev">${I.play} Preview</button><button class="btn ghost" id="emidi">♫ Import MIDI</button></div>
    <details class="help"><summary>How to write notes</summary><pre>${esc(HELP)}</pre></details>

    <h2 class="sec">YouTube original (optional)</h2>
    <div class="card"><label class="f" style="margin-top:0">Link</label><input class="in" id="eyt" placeholder="https://youtu.be/…" value="${meta.yt ? 'https://youtu.be/' + esc(meta.yt.id) : ''}">
      <div class="grid3"><div><label class="f">Start</label><input class="in" id="eyts" value="${meta.yt ? fmtTime(meta.yt.start) : ''}" placeholder="1:05.0"></div>
      <div><label class="f">End</label><input class="in" id="eyte" value="${meta.yt && meta.yt.end ? fmtTime(meta.yt.end) : ''}" placeholder="1:35.0"></div>
      <div><label class="f">Beat 1 at +s</label><input class="in" id="eyto" inputmode="decimal" value="${meta.yt ? (meta.yt.offset || 0) : ''}" placeholder="0"></div></div>
      <p class="note" style="margin-top:8px">The first note of your notes (beat 1) should line up with Start + offset. Use <b>YouTube studio</b> from the song page to set these by ear.</p></div>
    </div>`, { kind: 'full' });

  const f = (id) => $('#' + id, el);
  let chordStyle = src.chordStyle;
  const collect = () => {
    const ts = f('ets').value.split('/').map(Number);
    const ytIn = f('eyt').value.trim();
    let yt = null;
    if (ytIn) {
      const p = parseYouTube(ytIn);
      if (p) yt = { id: p.id, start: parseTime(f('eyts').value) || p.t || 0, end: parseTime(f('eyte').value) || null, offset: Number(f('eyto').value) || 0 };
    }
    const key = f('ekey').value;
    const m = { ...meta, title: f('etitle').value.trim() || 'Untitled', composer: f('ecomp').value, movie: f('emovie').value.trim(), year: f('eyear').value.trim(),
      bpm: Math.max(30, Math.min(260, Number(f('ebpm').value) || 90)), ts, key, raga: f('eraga').value || null, sa: keyTonicPc(key) };
    const s = { rh: f('erh').value, lh: f('elh').value, chords: f('ech').value, chordStyle, mode: 'auto' };
    const song = buildSong(m, s);
    song.yt = yt; song.spelling = m.spelling || (RAGA_BY_ID[m.raga] && RAGA_BY_ID[m.raga].semis.some((x) => [1, 8].includes(x)) ? 'flat' : null);
    if (base && base.created) song.created = base.created; else song.created = Date.now();
    return song;
  };
  const refresh = () => {
    const s = collect();
    const r = s.notes.filter((n) => n.h === 'R').length, l = s.notes.filter((n) => n.h === 'L').length;
    const bars = Math.ceil(s.beats / (s.ts[0] * 4 / s.ts[1]));
    const fits = suggestRagas(s.notes.filter((n) => n.h === 'R'), s.sa).slice(0, 4).map((x) => x.name);
    f('estatus').innerHTML = `<div class="${s.notes.length ? 'okc' : 'note'}" style="font-weight:800">${s.notes.length ? `✓ ${r} right-hand + ${l} left-hand notes · ${bars} bars · ${s.chords.length} chords` : 'No notes yet'}</div>
      ${fits.length && r ? `<div class="note" style="margin-top:4px">Notes fit: ${esc(fits.join(', '))}</div>` : ''}
      ${s.warnings.slice(0, 6).map((w) => `<div class="warn">⚠ ${esc(w)}</div>`).join('')}${s.warnings.length > 6 ? `<div class="warn">…and ${s.warnings.length - 6} more</div>` : ''}`;
  };
  let tmr;
  ['erh', 'elh', 'ech', 'ekey', 'eraga', 'ets', 'ebpm'].forEach((id) => f(id).addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(refresh, 250); }));
  f('estyle').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; chordStyle = b.dataset.v; $$('button', f('estyle')).forEach((x) => x.classList.toggle('on', x === b)); refresh(); };
  f('econv').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const s = collect();
    const opt = { mode: b.dataset.to, key: s.key, sa: s.sa, raga: s.raga, ts: s.ts };
    const rhP = parseNotation(f('erh').value, { key: s.key, raga: s.raga, ts: s.ts, hand: 'R' });
    f('erh').value = notesToText(rhP.notes, { ...opt, sections: rhP.sections });
    if (f('elh').value.trim()) f('elh').value = notesToText(parseNotation(f('elh').value, { key: s.key, raga: s.raga, ts: s.ts, hand: 'L' }).notes, { ...opt, hand: 'L' });
    refresh();
    toast(b.dataset.to === 'sargam' ? `Converted to sargam (Sa = ${s.key.replace('m', '')})` : 'Converted to Western note names');
  };
  f('eprev').onclick = () => { unlockAudio(); const s = collect(); if (!s.notes.length) return toast('Add some notes first'); openPlayer(s, { mode: 'listen', title: 'Preview · ' + s.title }); };
  f('emidi').onclick = () => importMidiFlow(el, (res) => {
    f('erh').value = res.rh; f('elh').value = res.lh; f('ech').value = '';
    f('ebpm').value = res.bpm; f('ekey').value = res.key; f('ets').value = res.ts.join('/');
    if (!f('etitle').value && res.name) f('etitle').value = res.name;
    refresh();
  });
  f('esave').onclick = async () => {
    const s = collect();
    if (!s.notes.length) return toast('Add some notes first (or paste them)');
    try { await putSong(s); toast('Saved to your library'); closeLayer(el); opts.onSaved && opts.onSaved(s); }
    catch (e) { toast('Could not save: ' + e.message); }
  };
  refresh();
  if (opts.importMidi) setTimeout(() => f('emidi').click(), 300);
  return el;
}

/** pick a .mid file, choose melody / bass tracks, return notation text */
export async function importMidiFlow(parentEl, onDone) {
  const file = await pickFile('.mid,.midi,audio/midi,audio/x-midi');
  if (!file) return;
  let midi, parts;
  try { midi = parseMidi(await file.arrayBuffer()); parts = extractParts(midi).filter((p) => p.count > 0); }
  catch (e) { toast('Could not read that MIDI file: ' + e.message); return; }
  if (!parts.length) { toast('No notes found in that file'); return; }
  let rh = (parts.find((p) => p.guess === 'R') || parts[0]).id;
  let lh = (parts.find((p) => p.guess === 'L') || {}).id || '';
  const row = (p) => `<div class="toggle"><div><div class="tl">${esc(p.name)}${p.isDrum ? ' (drums)' : ''}</div><div class="ts">${p.count} notes · ${noteName(p.min)}–${noteName(p.max)}${p.poly > 0.3 ? ' · chords' : ''}</div></div>
     <div class="seg" data-part="${p.id}"><button data-r="R" class="${p.id === rh ? 'on' : ''}">Melody</button><button data-r="L" class="${p.id === lh ? 'on' : ''}">Bass</button></div></div>`;
  const el = openLayer(`<div class="pad"><h2 style="margin:4px 0 4px">Choose tracks</h2><p class="note">${esc(file.name)} · ${parts.length} parts. Pick the melody (right hand) and optionally a bass part (left hand).</p>
    <div class="card" style="margin-top:12px">${parts.map(row).join('')}</div>
    <div class="toggle"><div class="tl">Snap timing to</div><div class="seg" id="mq"><button data-q="0.25" class="on">1/16</button><button data-q="0.5">1/8</button><button data-q="0">Off</button></div></div>
    <div class="toggle"><div class="tl">Transpose</div><div class="seg" id="mt"><button data-t="-12">−8ve</button><button data-t="0" class="on">0</button><button data-t="12">+8ve</button></div></div>
    <button class="btn primary" id="mok" style="width:100%;margin-top:12px">Use these tracks</button></div>`);
  let q = 0.25, tr = 0;
  $$('[data-part]', el).forEach((g) => g.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const id = g.dataset.part;
    if (b.dataset.r === 'R') rh = rh === id ? '' : id; else lh = lh === id ? '' : id;
    $$('[data-part]', el).forEach((gg) => { $('[data-r="R"]', gg).classList.toggle('on', gg.dataset.part === rh); $('[data-r="L"]', gg).classList.toggle('on', gg.dataset.part === lh); });
  });
  $('#mq', el).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; q = +b.dataset.q; $$('button', $('#mq', el)).forEach((x) => x.classList.toggle('on', x === b)); };
  $('#mt', el).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; tr = +b.dataset.t; $$('button', $('#mt', el)).forEach((x) => x.classList.toggle('on', x === b)); };
  $('#mok', el).onclick = () => {
    if (!rh && !lh) return toast('Pick at least one track');
    const song = partsToSong(midi, parts, { rh, lh, quantize: q, transpose: tr, skylineRH: true, skylineLH: true });
    const o = { key: song.key, ts: song.ts };
    const res = { rh: notesToText(song.notes.filter((n) => n.h === 'R'), o), lh: notesToText(song.notes.filter((n) => n.h === 'L'), { ...o, hand: 'L' }), bpm: song.bpm, key: song.key, ts: song.ts, name: file.name.replace(/\.(mid|midi)$/i, '') };
    song.warnings.forEach((w) => toast(w, 4000));
    closeLayer(el); onDone(res);
  };
}
