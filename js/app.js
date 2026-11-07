// Isai Keys — app shell: tabs, lessons, library, practice tools, settings and the player screen.
import { loadSettings, saveSettings, loadProgress, recordResult, streak, allSongs, deleteSong, putSong, exportLibrary, importLibrary, requestPersistence, saveProgress } from './store.js';
import { UNITS, ALL_LESSONS, BUILTIN_SONGS, COMPOSERS, eraOf, ragaScaleSong, chordDrill, chordDrillRH } from './content.js';
import { RAGAS, RAGA_BY_ID, COMMON_CHORDS, SHARP, FLAT, swaraLabel, spelledName, noteName, pc, beatsPerBar, swaraName } from './theory.js';
import { Engine } from './player.js';
import { Keyboard } from './keyboard.js';
import { MicDetector } from './detector.js';
import { unlockAudio, playNote, setVolumes, startDrone, stopDrone, droneOn, getCtx } from './audio.js';
import { YTPlayer } from './youtube.js';
import { $, $$, esc, toast, openLayer, closeLayer, confirmBox, stars, shareFile, pickFile } from './ui.js';
import { openEditor } from './editor.js';
import { openStudio } from './studio.js';

export const S = { settings: loadSettings(), tab: 'learn', filter: { composer: null, era: null, q: '' } };
export const detector = new MicDetector();
setVolumes({ music: S.settings.music, click: S.settings.click, drone: S.settings.drone });
export function setSetting(k, v) { S.settings[k] = v; saveSettings(S.settings); if (['music', 'click', 'drone'].includes(k)) setVolumes({ [k]: v }); }

const I = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>',
  ear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
};
export { I };

// ---------- routing ----------
const screen = $('#screen');
$$('#tabs button').forEach((b) => b.addEventListener('click', () => { S.tab = b.dataset.tab; render(); screen.scrollTop = 0; }));
export async function render() {
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
  if (S.tab === 'learn') screen.innerHTML = learnHTML();
  else if (S.tab === 'songs') screen.innerHTML = await songsHTML();
  else if (S.tab === 'practice') screen.innerHTML = practiceHTML();
  else screen.innerHTML = settingsHTML();
  bindScreen();
}

// ---------- Learn ----------
function lessonStars(prog, id) { return (prog['L:' + id] || {}).stars || 0; }
function learnHTML() {
  const prog = loadProgress();
  const total = ALL_LESSONS.length * 3;
  const got = ALL_LESSONS.reduce((a, l) => a + lessonStars(prog, l.id), 0);
  const next = ALL_LESSONS.find((l) => !lessonStars(prog, l.id)) || ALL_LESSONS[0];
  return `<div class="wrap">
  <div class="hero"><div class="kolam"></div>
    <h1><span class="ta">இசை</span>Isai Keys</h1>
    <p>Keyboard, chords and ragas — Western and Carnatic side by side.</p>
    <div class="pills"><span class="pill">🔥 <b>${streak()}</b> day streak</span><span class="pill">★ <b>${got}</b> / ${total}</span></div>
  </div>
  <button class="card row gap" data-lesson="${next.id}" style="width:100%;text-align:left;background:linear-gradient(135deg,#2a1d55,#1a1433);border-color:rgba(255,182,39,.35)">
    <div class="grow"><div class="note" style="color:var(--gold);font-weight:800">${got ? 'CONTINUE' : 'START HERE'}</div><h3 style="margin-top:2px">${esc(next.title)}</h3><p>${esc(next.unit.title)}</p></div>
    <span class="icon" style="background:var(--gold);color:#1d1300">${I.play}</span>
  </button>
  ${UNITS.map((u, ui) => {
    return `<h2 class="sec">Unit ${ui + 1}</h2><div class="card">
      <div class="unit-head"><div class="unit-num">${ui + 1}</div><div><h3>${esc(u.title)} <span class="ta">${esc(u.ta)}</span></h3><p>${esc(u.blurb)}</p></div></div>
      ${u.lessons.map((l, li) => {
        const st = lessonStars(prog, l.id); const isNext = l.id === next.id;
        return `<button class="lesson ${st ? 'done' : ''} ${isNext ? 'next' : ''}" data-lesson="${l.id}">
          <span class="dot">${st ? '✓' : li + 1}</span>
          <span class="grow"><div class="lt">${esc(l.title)}</div><div class="ls">${l.exercises.length} exercise${l.exercises.length > 1 ? 's' : ''} · ${modeName(l.exercises[0].mode)}</div></span>
          ${stars(st)}</button>`;
      }).join('')}
    </div>`;
  }).join('')}
  <p class="note" style="text-align:center;margin:20px 0 8px">All lesson melodies are traditional Carnatic exercises or originals written for this app.<br>Add the film songs you love in <b>Songs</b>.</p>
  </div>`;
}
const modeName = (m) => ({ wait: 'notes wait for you', play: 'play in time', listen: 'listen' }[m] || m);

function openLesson(id) {
  const lesson = ALL_LESSONS.find((l) => l.id === id); if (!lesson) return;
  let i = 0;
  const el = openLayer(`<div class="pad"><div class="note" style="color:var(--gold);font-weight:800">${esc(lesson.unit.title.toUpperCase())}</div>
    <h2 style="margin:4px 0 10px;font-size:24px">${esc(lesson.title)}</h2>
    <div class="card lcard" id="lc"></div><div class="dots-nav" id="ld"></div>
    <div class="row gap"><button class="btn ghost" id="lprev">Back</button><button class="btn primary grow" id="lnext">Next</button></div></div>`);
  let kb = null;
  const show = () => {
    const c = lesson.cards[i];
    $('#lc', el).innerHTML = `<h3>${esc(c.title)}</h3><p>${c.text}</p>${c.keys ? '<canvas class="mini"></canvas>' : ''}${c.keys && c.keys.length ? '<p class="note" style="margin-top:8px">Tap the keys to hear them.</p>' : ''}`;
    $('#ld', el).innerHTML = lesson.cards.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    $('#lprev', el).style.visibility = i ? 'visible' : 'hidden';
    $('#lnext', el).textContent = i < lesson.cards.length - 1 ? 'Next' : '▶  Start';
    const cv = $('canvas.mini', el);
    if (cv) {
      kb = miniKeyboard(cv, c.keys, { raga: c.raga, sa: c.sa ?? 0 });
    }
  };
  $('#lprev', el).onclick = () => { if (i > 0) { i--; show(); } };
  $('#lnext', el).onclick = () => {
    unlockAudio();
    if (i < lesson.cards.length - 1) { i++; show(); return; }
    closeLayer(el); runLesson(lesson, 0, []);
  };
  show();
}

export function miniKeyboard(cv, keys = [], { raga = null, sa = 0, lo, hi } = {}) {
  const kb = new Keyboard(cv, { onDown: (m) => { unlockAudio(); kb._h = playNote(m, 0, 0.9); kb.pressed.set(m, '#B794F6'); kb.draw(); }, onUp: (m) => { kb.pressed.delete(m); kb.draw(); } });
  const ms = keys.length ? keys : [60, 72];
  kb.setRange(lo ?? Math.min(60, Math.min(...ms)) - 0, hi ?? Math.max(72, Math.max(...ms)) + 1);
  kb.labels = 'both'; kb.sa = sa; kb.raga = raga ? RAGA_BY_ID[raga] : null;
  keys.forEach((m) => kb.hints.set(m, 'R'));
  requestAnimationFrame(() => kb.draw());
  return kb;
}

function runLesson(lesson, idx, results) {
  const ex = lesson.exercises[idx];
  const last = idx === lesson.exercises.length - 1;
  openPlayer(ex.song, { mode: ex.mode, hands: ex.hands, tempo: ex.tempo, labels: ex.labels, title: lesson.exercises.length > 1 && ex.title !== lesson.title ? `${lesson.title} · ${ex.title}` : lesson.title,
    nextLabel: last ? 'Finish' : 'Next exercise',
    onResult: (res) => { recordResult('E:' + lesson.id + ':' + idx, res); },
    onNext: (res, close) => {
      results[idx] = res;
      close();
      if (!last) runLesson(lesson, idx + 1, results);
      else {
        const st = Math.max(1, Math.round(results.reduce((a, r) => a + (r ? r.stars : 0), 0) / lesson.exercises.length));
        recordResult('L:' + lesson.id, { stars: st, score: 1 });
        toast(`Lesson complete ${'★'.repeat(st)}`);
        if (S.tab === 'learn') render();
      }
    } });
}

// ---------- Songs ----------
let libCache = [];
async function songsHTML() {
  libCache = await allSongs().catch(() => []);
  const f = S.filter;
  const user = libCache.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const composersPresent = COMPOSERS.filter((c) => user.some((s) => s.composer === c));
  const match = (s) => (!f.composer || s.composer === f.composer) && (!f.era || eraOf(s.year) === f.era) &&
    (!f.q || [s.title, s.movie, s.composer, s.raga].join(' ').toLowerCase().includes(f.q.toLowerCase()));
  const list = user.filter(match);
  const eras = ['70s', '80s', '90s', '2000s', '2010s', '2020s'].filter((e) => user.some((s) => eraOf(s.year) === e));
  return `<div class="wrap"><div class="hero" style="padding-bottom:8px"><h1>Songs</h1><p>Your library — add any song from YouTube, notes, or a MIDI file.</p></div>
    <div class="row gap" style="margin-bottom:10px"><button class="btn primary grow" id="addSong">${I.plus} Add a song</button></div>
    ${user.length ? `<input class="in search" id="q" placeholder="Search title, film, composer, raga" value="${esc(f.q)}">
    <div class="chips" style="margin-top:10px">${['All', ...composersPresent].map((c) => `<button class="chip ${(c === 'All' ? !f.composer : f.composer === c) ? 'on' : ''}" data-comp="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    ${eras.length > 1 ? `<div class="chips">${['Any era', ...eras].map((e) => `<button class="chip ${(e === 'Any era' ? !f.era : f.era === e) ? 'on' : ''}" data-era="${esc(e)}">${esc(e)}</button>`).join('')}</div>` : ''}` : ''}
    <h2 class="sec">My library · ${user.length}</h2>
    ${list.length ? list.map(songRow).join('') : user.length ? '<div class="empty">No songs match.</div>' : `<div class="card empty">
      <div style="font-size:40px">🎹</div><h3>Build your library</h3>
      <p class="note">Paste a YouTube link of any Ilaiyaraaja, Rahman, Harris, Yuvan, Bharathwaj or Vidyasagar song, mark the part you want to learn, then let the app draft the notes or play them in yourself. You can also paste notes you found (Western or sargam) or import a MIDI file.</p></div>`}
    <h2 class="sec">Practice pieces (original & traditional)</h2>
    ${BUILTIN_SONGS.map(songRow).join('')}
  </div>`;
}
const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
function songRow(s) {
  const prog = loadProgress()['S:' + s.id];
  const art = s.yt ? `style="background-image:url(https://i.ytimg.com/vi/${esc(s.yt.id)}/mqdefault.jpg)"` : `style="background:linear-gradient(135deg,hsl(${hue(s.composer + s.title)},80%,62%),hsl(${(hue(s.title) + 40) % 360},70%,48%))"`;
  const meta = [s.composer, s.movie, s.year, s.raga ? RAGA_BY_ID[s.raga]?.name : s.key].filter(Boolean).join(' · ');
  return `<button class="song" data-song="${esc(s.id)}"><span class="art" ${art}>${s.yt ? '' : esc((s.title || '?')[0])}</span>
    <span class="st"><div class="t1">${esc(s.title)}</div><div class="t2">${esc(meta)}</div></span>${prog ? stars(prog.stars) : ''}</button>`;
}
function findSong(id) { return libCache.find((s) => s.id === id) || BUILTIN_SONGS.find((s) => s.id === id); }

function openSongSheet(song) {
  const bpb = beatsPerBar(song.ts);
  const hasR = song.notes.some((n) => n.h === 'R'), hasL = song.notes.some((n) => n.h === 'L');
  let hands = hasR ? 'R' : 'L';
  let range = null;
  const secs = (song.sections || []).map((s, i, arr) => ({ name: s.name, a: s.t, b: arr[i + 1] ? arr[i + 1].t : song.beats }));
  const bars = Math.ceil(song.beats / bpb);
  const el = openLayer(`<div class="pad">
    <h2 style="margin:4px 0 2px;font-size:23px">${esc(song.title)}</h2>
    <p class="note">${esc([song.composer, song.movie, song.year].filter(Boolean).join(' · '))}</p>
    <p class="note">${esc([song.raga ? 'Raga ' + RAGA_BY_ID[song.raga]?.name : '', 'Key ' + song.key, song.bpm + ' BPM', song.ts.join('/'), bars + ' bars', song.yt ? '▶ YouTube backing' : ''].filter(Boolean).join(' · '))}</p>
    ${hasR && hasL ? `<label class="f">Hands</label><div class="seg" id="sh"><button data-h="R" class="on">Right</button><button data-h="L">Left</button><button data-h="B">Both</button></div>` : ''}
    ${secs.length > 1 ? `<label class="f">Section</label><div class="chips" id="ssec"><button class="chip on" data-s="-1">Whole song</button>${secs.map((s, i) => `<button class="chip" data-s="${i}">${esc(s.name)}</button>`).join('')}</div>` : ''}
    ${bars > 4 ? `<label class="f">Bars <span id="brl">1 – ${bars}</span></label><div class="grid2"><input type="range" id="bra" min="1" max="${bars}" value="1"><input type="range" id="brb" min="1" max="${bars}" value="${bars}"></div>` : ''}
    <div class="col" style="margin-top:18px">
      <button class="btn primary" data-go="wait">${I.play} Learn — notes wait for you</button>
      <div class="grid2"><button class="btn" data-go="play">Play along</button><button class="btn" data-go="listen">${I.ear} Listen</button></div>
      ${song.builtin ? '' : `<div class="grid2"><button class="btn ghost" id="sedit">Edit notes</button><button class="btn ghost" id="sstudio">${song.yt ? 'YouTube studio' : 'Add YouTube'}</button></div>
      <button class="btn ghost" id="sdel" style="color:var(--red)">Delete song</button>`}
    </div></div>`);
  const sh = $('#sh', el);
  if (sh) sh.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; hands = b.dataset.h; $$('button', sh).forEach((x) => x.classList.toggle('on', x === b)); };
  const ssec = $('#ssec', el);
  const bra = $('#bra', el), brb = $('#brb', el);
  const syncBars = () => { if (!bra) return; let a = +bra.value, b = +brb.value; if (b < a) [a, b] = [b, a]; $('#brl', el).textContent = `${a} – ${b}`; range = a === 1 && b === bars ? null : [(a - 1) * bpb, b * bpb]; };
  if (bra) { bra.oninput = syncBars; brb.oninput = syncBars; }
  if (ssec) ssec.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', ssec).forEach((x) => x.classList.toggle('on', x === b));
    const i = +b.dataset.s; range = i < 0 ? null : [secs[i].a, secs[i].b];
    if (bra) { bra.value = range ? Math.floor(range[0] / bpb) + 1 : 1; brb.value = range ? Math.ceil(range[1] / bpb) : bars; $('#brl', el).textContent = `${bra.value} – ${brb.value}`; }
  };
  $$('[data-go]', el).forEach((b) => b.onclick = () => {
    unlockAudio(); closeLayer(el);
    openPlayer(song, { mode: b.dataset.go, hands, range, title: song.title, onResult: (res) => { recordResult('S:' + song.id, res); } });
  });
  const ed = $('#sedit', el); if (ed) ed.onclick = () => { closeLayer(el); openEditor(song, { onSaved: () => render() }); };
  const stu = $('#sstudio', el); if (stu) stu.onclick = () => { closeLayer(el); openStudio({ song, onSaved: () => render() }); };
  const del = $('#sdel', el); if (del) del.onclick = async () => { if (await confirmBox(`Delete "${song.title}"?`, { ok: 'Delete', danger: true })) { await deleteSong(song.id); closeLayer(el); render(); } };
}

function openAddSheet() {
  const el = openLayer(`<div class="pad"><h2 style="margin:4px 0 12px">Add a song</h2><div class="col">
    <button class="btn primary" id="a_yt" style="justify-content:flex-start">▶ From a YouTube link</button>
    <p class="note" style="margin:-4px 4px 4px">Mark the part to learn, then draft the notes by listening, play them in, or type them.</p>
    <button class="btn" id="a_txt" style="justify-content:flex-start">✎ Type or paste notes (Western or sargam)</button>
    <button class="btn" id="a_midi" style="justify-content:flex-start">♫ Import a MIDI file</button>
    <button class="btn ghost" id="a_bak" style="justify-content:flex-start">⤓ Restore a library backup</button></div></div>`);
  $('#a_yt', el).onclick = () => { closeLayer(el); openStudio({ onSaved: () => render() }); };
  $('#a_txt', el).onclick = () => { closeLayer(el); openEditor(null, { onSaved: () => render() }); };
  $('#a_midi', el).onclick = () => { closeLayer(el); openEditor(null, { onSaved: () => render(), importMidi: true }); };
  $('#a_bak', el).onclick = async () => {
    const f = await pickFile('.json,application/json'); if (!f) return;
    try { const n = await importLibrary(await f.text()); toast(`Restored ${n} songs`); closeLayer(el); render(); } catch (e) { toast(e.message); }
  };
}

// ---------- Practice ----------
function practiceHTML() {
  return `<div class="wrap"><div class="hero" style="padding-bottom:8px"><h1>Practice</h1><p>Ragas, chords, drone and a microphone check.</p></div>
  <div class="grid2"><button class="btn" id="micCheck">🎤 Mic check</button><button class="btn ${droneOn() ? 'teal' : ''}" id="drone">${droneOn() ? '■ Stop drone' : '♪ Tanpura drone'}</button></div>
  <h2 class="sec">Ragas · ராகங்கள்</h2>
  <div class="ragas">${RAGAS.map((r) => `<button class="raga" data-raga="${r.id}"><b>${esc(r.name)}</b><span class="ta">${esc(r.ta)}</span><small>${esc(r.western)}</small></button>`).join('')}</div>
  <h2 class="sec">Chord drills</h2>
  <div class="card"><p>Pick the chords to drill. The app shows one per bar and waits until you play it.</p>
    <div class="chips" style="flex-wrap:wrap;margin-top:12px" id="chordPick">${COMMON_CHORDS.map((c) => `<button class="chip ${['C', 'F', 'G', 'Am'].includes(c) ? 'on' : ''}" data-ch="${c}">${c}</button>`).join('')}</div>
    <div class="grid2" style="margin-top:8px"><button class="btn primary" id="drillR">Right hand</button><button class="btn" id="drillL">Left hand</button></div></div>
  </div>`;
}

function openRaga(id) {
  const r = RAGA_BY_ID[id]; let sa = 0;
  const el = openLayer(`<div class="pad"><h2 style="margin:4px 0 0;font-size:24px">${esc(r.name)} <span class="ta" style="color:var(--gold);font-size:17px">${esc(r.ta)}</span></h2>
    <p class="note">${r.mela ? 'Melakarta ' + r.mela : 'Janya of ' + esc(r.parent)} · ${esc(r.western)}</p>
    <p style="line-height:1.5;margin:10px 0">${esc(r.about)}</p>
    <label class="f">Sa (tonic) = <span id="saL">C</span></label>
    <div class="chips" id="saPick">${SHARP.map((n, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-sa="${i}">${n}</button>`).join('')}</div>
    <div class="swaras" id="sws"></div>
    <canvas class="mini" id="rkb"></canvas>
    <div class="grid2" style="margin-top:12px"><button class="btn" id="rplay">${I.ear} Hear scale</button><button class="btn" id="rdrone">♪ Drone</button></div>
    <button class="btn primary" id="rpractice" style="width:100%;margin-top:10px">${I.play} Practise this scale</button></div>`);
  const draw = () => {
    const flat = r.semis.some((s) => [1, 3, 8, 10].includes(s));
    $('#saL', el).textContent = SHARP[sa];
    $('#sws', el).innerHTML = r.swaras.map((sw, i) => `<div class="sw"><b>${sw}</b><span>${(flat ? FLAT : SHARP)[(r.semis[i] + sa) % 12]}</span></div>`).join('') + `<div class="sw"><b>Ṡ</b><span>${SHARP[sa]}</span></div>`;
    const keys = [...r.semis.map((s) => 60 + sa + s), 72 + sa];
    miniKeyboard($('#rkb', el), keys, { raga: r.id, sa, lo: 60 + sa - (sa ? 0 : 0), hi: 73 + sa });
  };
  $('#saPick', el).onclick = (e) => { const b = e.target.closest('button'); if (!b) return; sa = +b.dataset.sa; $$('button', $('#saPick', el)).forEach((x) => x.classList.toggle('on', x === b)); draw(); if (droneOn()) startDrone(48 + sa); };
  $('#rplay', el).onclick = async () => {
    await unlockAudio(); const c = getCtx(); const t = c.currentTime + 0.05; const up = [...r.semis, 12]; const seq = [...up, ...up.slice(0, -1).reverse()];
    seq.forEach((s, i) => playNote(60 + sa + s, t + i * 0.42, 0.45));
  };
  $('#rdrone', el).onclick = async () => { await unlockAudio(); if (droneOn()) stopDrone(); else startDrone(48 + sa); };
  $('#rpractice', el).onclick = () => { unlockAudio(); closeLayer(el); openPlayer(ragaScaleSong(r, sa), { mode: 'wait', hands: 'R', title: r.name + ' scale', onResult: (res) => recordResult('R:' + r.id, res) }); };
  draw();
}

function openMicCheck() {
  const el = openLayer(`<div class="pad"><h2 style="margin:4px 0 4px">Mic check</h2>
    <p class="note">Play single notes on your keyboard. The app should show the same note. Quiet room, phone 30–60 cm from the keyboard speaker works best.</p>
    <div class="bignote" id="mn">–<small id="ms">&nbsp;</small></div>
    <div class="meter"><b id="mm"></b></div>
    <p class="note" id="mdb" style="text-align:center;margin-top:6px">level –</p>
    <label class="f">Sensitivity <span id="gl"></span></label>
    <input type="range" id="gate" min="-70" max="-28" step="1" value="${S.settings.gateDb}">
    <p class="note">Move left if soft notes are missed, right if noise is picked up as notes.</p>
    <label class="f">Chord test — play C E G (Sa Ga Pa)</label>
    <div class="card" id="ct" style="text-align:center;font-weight:800">waiting…</div></div>`, { onClose: () => { stopLoop = true; if (!keepMic) detector.stop(); } });
  let stopLoop = false; const keepMic = detector.running;
  const gate = $('#gate', el);
  const showG = () => { $('#gl', el).textContent = `(${gate.value} dB)`; detector.gateDb = +gate.value; };
  gate.oninput = () => { showG(); setSetting('gateDb', +gate.value); }; showG();
  unlockAudio().then(() => detector.start()).then(() => {
    detector.gateDb = S.settings.gateDb;
    const loop = () => {
      if (stopLoop) return;
      const f = detector.frame();
      $('#mm', el).style.width = Math.max(0, Math.min(100, (f.db + 80) * 1.6)) + '%';
      $('#mdb', el).textContent = `level ${f.db.toFixed(0)} dB ${f.db > detector.gateDb ? '· listening' : '· below gate'}`;
      if (f.stable != null) { $('#mn', el).innerHTML = `${spelledName(f.stable, 0, null, true)}<small>${swaraLabel(f.stable, 0)} · ${f.cents > 0 ? '+' : ''}${f.cents.toFixed(0)}¢</small>`; }
      const r = detector.present([60, 64, 67], true);
      $('#ct', el).innerHTML = r.ok ? '<span class="okc" style="font-size:16px">✓ C major heard</span>' : `${r.found} of 3 notes`;
      requestAnimationFrame(loop);
    };
    loop();
  }).catch((e) => { $('#mn', el).innerHTML = '<span class="err" style="font-size:18px">Microphone not available</span>'; toast(micError(e)); });
}
export function micError(e) {
  if (e && e.name === 'NotAllowedError') return 'Microphone permission was denied. On iPhone: Settings → Safari → Microphone (or allow when asked).';
  if (!window.isSecureContext) return 'The microphone needs HTTPS — open the GitHub Pages address, not a local file.';
  return 'Microphone not available: ' + (e && e.message ? e.message : e);
}

// ---------- Settings ----------
function settingsHTML() {
  const s = S.settings;
  const sw = (k, title, sub) => `<div class="toggle"><div><div class="tl">${title}</div>${sub ? `<div class="ts">${sub}</div>` : ''}</div><label class="switch"><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}><span></span></label></div>`;
  const sel = (k, title, opts) => `<div class="toggle"><div class="tl">${title}</div><div class="seg">${opts.map(([v, l]) => `<button data-sel="${k}" data-v="${v}" class="${String(s[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
  return `<div class="wrap"><div class="hero" style="padding-bottom:8px"><h1>Settings</h1></div>
  <h2 class="sec">How you play</h2><div class="card">
    ${sel('input', 'Listen with', [['mic', 'Microphone'], ['touch', 'Screen keys']])}
    ${sel('labels', 'Note names', [['both', 'Both'], ['letters', 'C D E'], ['sargam', 'S R G'], ['none', 'Off']])}
    ${sel('saMode', 'Sargam Sa =', [['song', 'Song key'], ['C', 'Always C']])}
    ${sel('view', 'Default view', [['staff', 'Sheet music'], ['fall', 'Falling notes']])}
    ${sw('hints', 'Key hints', 'Light up the key to press')}
    ${sw('octaveLenient', 'Accept any octave', 'Count C3, C4 or C5 as correct for C')}
    ${sw('autoOtherHand', 'Play the other hand for me', 'When practising one hand')}
    ${sw('metronome', 'Metronome in Play-along')}
    ${sw('notesWithOriginal', 'Play notes over the YouTube original', 'In Listen mode')}
  </div>
  <h2 class="sec">Sound & microphone</h2><div class="card">
    <label class="f">Piano volume</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-rng="music">
    <label class="f">Click volume</label><input type="range" min="0" max="1" step="0.05" value="${s.click}" data-rng="click">
    <label class="f">Drone volume</label><input type="range" min="0" max="1" step="0.05" value="${s.drone}" data-rng="drone">
    <label class="f">Mic timing correction <span id="latl">${Math.round(s.latency * 1000)} ms</span></label><input type="range" min="0" max="0.25" step="0.01" value="${s.latency}" data-rng="latency">
    <button class="btn" id="micCheck2" style="width:100%;margin-top:14px">🎤 Mic check & sensitivity</button>
    ${navigator.requestMIDIAccess ? '<button class="btn ghost" id="midiBtn" style="width:100%;margin-top:10px">Connect MIDI keyboard</button>' : '<p class="note" style="margin-top:12px">MIDI keyboards: iPhone browsers do not support Web MIDI, so the app listens through the microphone instead. (MIDI works in Chrome on a laptop or Android.)</p>'}
  </div>
  <h2 class="sec">Your library</h2><div class="card">
    <p>Songs live only on this device. Export a backup now and then (and to move to another phone).</p>
    <div class="grid2" style="margin-top:12px"><button class="btn" id="exp">Export backup</button><button class="btn ghost" id="imp">Restore</button></div>
    <button class="btn ghost" id="resetp" style="width:100%;margin-top:10px">Reset lesson progress</button>
  </div>
  <h2 class="sec">About</h2><div class="card"><p>Isai Keys (இசை Keys) · v${APP_VERSION}. Built for practising Tamil film music on keyboard. Lesson melodies are traditional Carnatic exercises or originals. Songs you add stay in your own library on this device.</p>
  <p style="margin-top:8px">On iPhone: open in Safari → Share → <b>Add to Home Screen</b>. If you hear nothing, check the silent switch.</p></div>
  </div>`;
}
export const APP_VERSION = '1.0.0';

// ---------- bindings ----------
function bindScreen() {
  $$('[data-lesson]', screen).forEach((b) => b.onclick = () => openLesson(b.dataset.lesson));
  $$('[data-song]', screen).forEach((b) => b.onclick = () => { const s = findSong(b.dataset.song); if (s) openSongSheet(s); });
  const add = $('#addSong', screen); if (add) add.onclick = openAddSheet;
  const q = $('#q', screen); if (q) q.oninput = () => { S.filter.q = q.value; clearTimeout(q._t); q._t = setTimeout(async () => { const pos = q.selectionStart; await render(); const q2 = $('#q', screen); if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); } }, 250); };
  $$('[data-comp]', screen).forEach((b) => b.onclick = () => { S.filter.composer = b.dataset.comp === 'All' ? null : b.dataset.comp; render(); });
  $$('[data-era]', screen).forEach((b) => b.onclick = () => { S.filter.era = b.dataset.era === 'Any era' ? null : b.dataset.era; render(); });
  $$('[data-raga]', screen).forEach((b) => b.onclick = () => openRaga(b.dataset.raga));
  const mc = $('#micCheck', screen) || $('#micCheck2', screen); if (mc) mc.onclick = openMicCheck;
  const dr = $('#drone', screen); if (dr) dr.onclick = async () => { await unlockAudio(); if (droneOn()) stopDrone(); else startDrone(48); render(); };
  const cp = $('#chordPick', screen); if (cp) cp.onclick = (e) => { const b = e.target.closest('button'); if (b) b.classList.toggle('on'); };
  const picked = () => $$('#chordPick .chip.on', screen).map((b) => b.dataset.ch);
  const dR = $('#drillR', screen); if (dR) dR.onclick = () => { const p = picked(); if (!p.length) return toast('Pick at least one chord'); unlockAudio(); openPlayer(chordDrillRH(p), { mode: 'wait', hands: 'R', title: 'Chord drill' }); };
  const dL = $('#drillL', screen); if (dL) dL.onclick = () => { const p = picked(); if (!p.length) return toast('Pick at least one chord'); unlockAudio(); openPlayer(chordDrill(p), { mode: 'wait', hands: 'L', title: 'Chord drill' }); };
  $$('[data-set]', screen).forEach((i) => i.onchange = () => setSetting(i.dataset.set, i.checked));
  $$('[data-sel]', screen).forEach((b) => b.onclick = () => { setSetting(b.dataset.sel, b.dataset.v); render(); });
  $$('[data-rng]', screen).forEach((i) => i.oninput = () => { setSetting(i.dataset.rng, +i.value); if (i.dataset.rng === 'latency') $('#latl', screen).textContent = Math.round(+i.value * 1000) + ' ms'; });
  const exp = $('#exp', screen); if (exp) exp.onclick = async () => shareFile(`isai-keys-backup-${new Date().toISOString().slice(0, 10)}.json`, await exportLibrary());
  const imp = $('#imp', screen); if (imp) imp.onclick = async () => { const f = await pickFile('.json,application/json'); if (!f) return; try { toast(`Restored ${await importLibrary(await f.text())} songs`); } catch (e) { toast(e.message); } };
  const rp = $('#resetp', screen); if (rp) rp.onclick = async () => { if (await confirmBox('Reset all lesson stars?', { ok: 'Reset', danger: true })) { saveProgress({}); render(); } };
  const mb = $('#midiBtn', screen); if (mb) mb.onclick = connectMidi;
}

// ---------- MIDI & computer keyboard ----------
let currentEngine = null;
async function connectMidi() {
  try {
    const acc = await navigator.requestMIDIAccess();
    const bind = () => acc.inputs.forEach((inp) => { inp.onmidimessage = (e) => {
      const [st, m, v] = e.data; const hi = st & 0xf0;
      if (!currentEngine) return;
      if (hi === 0x90 && v > 0) currentEngine.noteOn(m, 'midi'); else if (hi === 0x80 || (hi === 0x90 && v === 0)) currentEngine.noteOff(m, 'midi');
    }; });
    bind(); acc.onstatechange = bind;
    toast(acc.inputs.size ? `Connected ${acc.inputs.size} MIDI input(s)` : 'No MIDI keyboard found — plug one in');
  } catch (e) { toast('MIDI not available: ' + e.message); }
}
const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };
let keyOct = 60; const keysDown = new Set();
window.addEventListener('keydown', (e) => {
  if (!currentEngine || e.target.closest && e.target.closest('input,textarea,select')) return;
  if (e.key === 'z') { keyOct = Math.max(36, keyOct - 12); return; } if (e.key === 'x') { keyOct = Math.min(84, keyOct + 12); return; }
  const k = KEYMAP[e.key.toLowerCase()]; if (k == null || keysDown.has(e.key)) return;
  keysDown.add(e.key); currentEngine.noteOn(keyOct + k, 'key');
});
window.addEventListener('keyup', (e) => { const k = KEYMAP[e.key.toLowerCase()]; if (k == null) return; keysDown.delete(e.key); currentEngine && currentEngine.noteOff(keyOct + k, 'key'); });

// ---------- Player screen ----------
let wakeLock = null;
async function lockScreen() { try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* */ } }
function unlockScreen() { try { wakeLock && wakeLock.release(); } catch (e) { /* */ } wakeLock = null; }

/**
 * opts: {mode, hands, tempo, range, labels, title, onResult(res), onNext(res, close), nextLabel}
 */
export function openPlayer(song, opts = {}) {
  const hasR = song.notes.some((n) => n.h === 'R'), hasL = song.notes.some((n) => n.h === 'L');
  const settings = { ...S.settings };
  if (opts.labels) settings.labels = opts.labels;
  const el = document.createElement('div'); el.className = 'player';
  el.innerHTML = `
    <div class="p-top">
      <button class="icon" data-x>${I.close}</button>
      <div class="ttl">${esc(opts.title || song.title)}</div>
      <div class="seg hide-portrait" data-mode><button data-m="wait">Wait</button><button data-m="play">Play</button><button data-m="listen">Listen</button></div>
      ${hasR && hasL ? '<div class="seg" data-hands><button data-h="R">R</button><button data-h="L">L</button><button data-h="B">Both</button></div>' : ''}
      <div class="tempo"><button data-t="-">−</button><span data-tv>100%</span><button data-t="+">+</button></div>
      <button class="icon" data-more>${I.gear}</button>
    </div>
    <div class="stage">
      <canvas class="view" data-staff></canvas><canvas class="view" data-fall></canvas>
      <div class="ytbox" data-yt></div>
      <div class="p-side"><button class="icon" data-hear title="Hear this part">${I.ear}</button><button class="icon" data-pause style="display:none">${I.pause}</button></div>
      <div class="p-mic" data-mic style="display:none">🎤 <span data-micn>–</span><i><b data-micl></b></i></div>
      <div class="p-center" data-center></div>
      ${innerHeight > innerWidth ? '<div class="rotate-hint">Turn your phone sideways for a wider view</div>' : ''}
    </div>
    <div class="p-progress"><i data-prog></i></div>
    <div class="p-kb"><canvas data-kb></canvas></div>`;
  document.body.appendChild(el);
  const q = (s) => el.querySelector(s);
  let yt = null, ytOk = false, closed = false, micWanted = false;
  let mode = opts.mode || 'wait', hands = opts.hands || (hasR ? 'R' : 'L'), tempo = opts.tempo || 1;
  if (hands === 'B' && !(hasR && hasL)) hands = hasR ? 'R' : 'L';
  if (hands === 'R' && !hasR) hands = 'L';
  if (hands === 'L' && !hasL) hands = 'R';

  const engine = new Engine({
    staffCanvas: q('[data-staff]'), fallCanvas: q('[data-fall]'), kbCanvas: q('[data-kb]'), settings, detector,
    onStatus: (s) => status(s), onProgress: (p) => { q('[data-prog]').style.width = (p * 100).toFixed(1) + '%'; },
    onFinish: (res) => showResults(res),
  });
  currentEngine = engine;

  const ytbox = q('[data-yt]');
  if (song.yt) {
    yt = new YTPlayer(ytbox);
    yt.onState = (st) => { ytbox.classList.toggle('show', st === 1 || st === 3 || mode !== 'wait'); };
    yt.load(song.yt.id, song.yt.start).then(() => { ytOk = true; if (mode !== 'wait') { ytbox.classList.add('show'); reload(); } }).catch((e) => { toast(e.message); });
  }

  const reload = () => {
    engine.load(song, { mode, hands, tempo, range: opts.range || null, loop: !!opts.loop, yt: ytOk ? yt : null, useYT: ytOk && mode !== 'wait' });
    ytbox.classList.toggle('show', !!(ytOk && mode !== 'wait'));
    syncTop();
  };
  const syncTop = () => {
    $$('[data-mode] button', el).forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
    $$('[data-hands] button', el).forEach((b) => b.classList.toggle('on', b.dataset.h === hands));
    q('[data-tv]').textContent = Math.round(tempo * 100) + '%';
    q('[data-hear]').style.display = mode === 'wait' ? '' : 'none';
  };
  const center = q('[data-center]');
  function status(s) {
    q('[data-pause]').style.display = (s === 'playing' || s === 'countin') && mode !== 'wait' ? '' : 'none';
    if (s === 'ready') {
      center.innerHTML = `<div style="text-align:center"><button class="bigplay" data-start>${I.play.replace('<svg', '<svg width="22" height="22"')} Start</button>
        <div class="p-msg" style="margin-top:12px">${mode === 'wait' ? (settings.input === 'mic' ? 'Play each note on your keyboard when it lights up' : 'Tap the glowing key') : mode === 'play' ? 'One bar count-in, then play in time' : 'Sit back and listen'}</div></div>`;
      q('[data-start]').onclick = startNow;
    } else if (s === 'loading') center.innerHTML = '<div class="p-msg">Loading video…</div>';
    else if (s === 'yt-tap') { ytbox.classList.add('show'); center.innerHTML = '<div class="p-msg" style="max-width:300px;text-align:center;align-self:flex-end;margin-bottom:10px">Tap ▶ on the video once to allow playback — the lesson starts with it.</div>'; }
    else if (s === 'countin') center.innerHTML = '<div class="p-msg">Count in… 1 · 2 · 3 · 4</div>';
    else if (s === 'paused') { center.innerHTML = `<button class="bigplay" data-resume>${I.play.replace('<svg', '<svg width="22" height="22"')} Resume</button>`; q('[data-resume]').onclick = () => engine.resume(); }
    else if (s === 'yt-failed') toast('Video did not start — playing without it');
    else if (s === 'playing') center.innerHTML = '';
  }
  async function startNow() {
    if (ytOk && mode !== 'wait') { try { yt.play(); } catch (e) { /* */ } } // start inside the tap (iOS)
    await unlockAudio();
    micWanted = settings.input === 'mic' && mode !== 'listen';
    if (micWanted && !detector.running) {
      try { await detector.start(); detector.gateDb = settings.gateDb; }
      catch (e) { toast(micError(e)); settings.input = 'touch'; }
    }
    if (mode === 'listen' && detector.running) detector.stop();
    q('[data-mic]').style.display = detector.running ? '' : 'none';
    lockScreen();
    engine.start();
  }
  function showResults(res) {
    opts.onResult && opts.onResult(res);
    const pct = Math.round(res.score * 100);
    const msg = res.mode === 'listen' ? 'That was the piece' : res.stars === 3 ? 'Brilliant!' : res.stars === 2 ? 'Great job!' : res.stars === 1 ? 'Good start' : 'Keep practising';
    const stats = res.mode === 'wait' ? `<span>Notes <b>${res.total}</b></span><span>Mistakes <b>${res.mistakes}</b></span><span>Accuracy <b>${pct}%</b></span><span>Time <b>${Math.round(res.seconds)}s</b></span>`
      : res.mode === 'play' ? `<span>Perfect <b>${res.perfect}</b></span><span>Early/Late <b>${res.good}</b></span><span>Missed <b>${res.miss}</b></span><span>Score <b>${pct}%</b></span>` : '';
    center.innerHTML = `<div class="results">${res.mode === 'listen' ? '<div class="big">🎶</div>' : `<div class="big">${stars(res.stars)}</div>`}<h3>${msg}</h3><div class="stats">${stats}</div>
      ${res.mode === 'wait' && res.stars >= 2 ? '<p class="note" style="margin:-4px 0 14px">Next: try <b>Play</b> mode to play it in time.</p>' : ''}
      <div class="row gap"><button class="btn ghost grow" data-retry>${I.restart} Retry</button>${opts.onNext ? `<button class="btn primary grow" data-next>${esc(opts.nextLabel || 'Next')}</button>` : '<button class="btn primary grow" data-done>Done</button>'}</div></div>`;
    q('[data-retry]').onclick = () => { engine.restart(); };
    const nx = q('[data-next]'); if (nx) nx.onclick = () => opts.onNext(res, close);
    const dn = q('[data-done]'); if (dn) dn.onclick = close;
  }
  function close() {
    if (closed) return; closed = true;
    engine.destroy(); if (currentEngine === engine) currentEngine = null;
    if (yt) yt.destroy();
    if (detector.running) detector.stop();
    unlockScreen(); window.removeEventListener('resize', onResize);
    el.remove();
    if (S.tab === 'learn' || S.tab === 'songs') render();
  }
  const onResize = () => { engine.prepare(); };
  window.addEventListener('resize', onResize);

  q('[data-x]').onclick = close;
  el.querySelector('[data-mode]').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; reload(); };
  const hs = el.querySelector('[data-hands]'); if (hs) hs.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; hands = b.dataset.h; reload(); };
  $$('[data-t]', el).forEach((b) => b.onclick = () => {
    const steps = [0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.1, 1.25];
    let i = steps.findIndex((x) => Math.abs(x - tempo) < 0.01); if (i < 0) i = 7;
    i = Math.max(0, Math.min(steps.length - 1, i + (b.dataset.t === '+' ? 1 : -1)));
    tempo = engine.setTempo(steps[i]) || steps[i]; syncTop();
  });
  q('[data-pause]').onclick = () => engine.pause();
  q('[data-hear]').onclick = () => { unlockAudio(); if (ytOk) ytbox.classList.add('show'); engine.previewHere(2); };
  q('.stage').addEventListener('click', (e) => { if (e.target.closest('button') || e.target.closest('.results')) return; if (engine.status === 'playing' && mode !== 'wait') engine.pause(); });
  q('[data-more]').onclick = () => openPlayerMore(engine, settings, () => reload());
  // mic indicator
  const micLoop = () => {
    if (closed) return;
    if (detector.running) { const f = detector.last; q('[data-micl]').style.width = Math.max(0, Math.min(100, (f.db + 75) * 1.7)) + '%'; q('[data-micn]').textContent = f.stable != null ? `${spelledName(f.stable, 0, null, true)} · ${swaraLabel(f.stable, engine.sa, engine.staff.raga, false)}` : '–'; }
    requestAnimationFrame(micLoop);
  };
  micLoop();
  reload();
  return { engine, close };
}

function openPlayerMore(engine, settings, onChange) {
  const s = settings;
  const sw = (k, title) => `<div class="toggle"><div class="tl">${title}</div><label class="switch"><input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}><span></span></label></div>`;
  const el = openLayer(`<div class="pad"><h2 style="margin:4px 0 10px">Practice options</h2>
    <div class="toggle"><div class="tl">View</div><div class="seg" data-g="view"><button data-v="staff" class="${engine.view === 'staff' ? 'on' : ''}">Sheet music</button><button data-v="fall" class="${engine.view === 'fall' ? 'on' : ''}">Falling notes</button></div></div>
    <div class="toggle"><div class="tl">Note names</div><div class="seg" data-g="labels">${[['both', 'Both'], ['letters', 'C D E'], ['sargam', 'S R G'], ['none', 'Off']].map(([v, l]) => `<button data-v="${v}" class="${s.labels === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="toggle"><div class="tl">Listen with</div><div class="seg" data-g="input"><button data-v="mic" class="${s.input === 'mic' ? 'on' : ''}">Mic</button><button data-v="touch" class="${s.input === 'touch' ? 'on' : ''}">Screen keys</button></div></div>
    ${sw('hints', 'Key hints')}${sw('loop', 'Loop')}${sw('metronome', 'Metronome (Play mode)')}${sw('autoOtherHand', 'Play other hand for me')}${sw('octaveLenient', 'Accept any octave')}
    <div class="toggle"><div class="tl">Tanpura drone</div><label class="switch"><input type="checkbox" data-drone ${droneOn() ? 'checked' : ''}><span></span></label></div>
    <label class="f">Zoom</label><input type="range" min="0" max="160" step="10" value="${s.zoom || 0}" data-zoom>
  </div>`);
  $$('[data-g]', el).forEach((g) => g.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return; $$('button', g).forEach((x) => x.classList.toggle('on', x === b));
    const k = g.dataset.g; s[k] = b.dataset.v; setSetting(k, b.dataset.v);
    if (k === 'view') engine.setView(b.dataset.v);
    if (k === 'labels') engine.setLabels(b.dataset.v);
    if (k === 'input' && b.dataset.v === 'touch' && detector.running) detector.stop();
  });
  $$('[data-k]', el).forEach((i) => i.onchange = () => {
    const k = i.dataset.k; s[k] = i.checked;
    if (k === 'loop') { engine.loop = i.checked; return; }
    setSetting(k, i.checked); if (k === 'hints') engine.updateHints();
  });
  $('[data-drone]', el).onchange = async (e) => { await unlockAudio(); if (e.target.checked) startDrone(48 + (engine.sa || 0)); else stopDrone(); };
  $('[data-zoom]', el).oninput = (e) => { s.zoom = +e.target.value || 0; setSetting('zoom', s.zoom); };
}

// ---------- boot ----------
render();
requestPersistence();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (document.hidden && currentEngine) currentEngine.pause(); });
window.__isai = { S, detector, openPlayer, BUILTIN_SONGS, get engine() { return currentEngine; } };
