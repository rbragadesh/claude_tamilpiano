// YouTube studio: paste a link, mark the part to learn (A–B), loop / slow it down, set the tempo,
// then get the notes by (1) listening through the mic, (2) playing them in, or (3) typing them.
import { YTPlayer, parseYouTube, parseTime, fmtTime } from './youtube.js';
import { segmentFrames, snapToScale, fitOctave, estimateBpm, toBeats } from './detector.js';
import { notesToText, suggestRagas } from './notation.js';
import { RAGAS, RAGA_BY_ID, ALL_KEYS, keyTonicPc, detectKey, isMinorKey, freqToMidi, spelledName, swaraLabel } from './theory.js';
import { getCtx, unlockAudio, click, playNote } from './audio.js';
import { Keyboard } from './keyboard.js';
import { $, $$, esc, toast, openLayer, closeLayer } from './ui.js';
import { openEditor } from './editor.js';
import { detector, S, I, micError } from './app.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];

/** opts: {song?, onSaved} */
export function openStudio(opts = {}) {
  const song = opts.song || null;
  const st = {
    id: song?.yt?.id || null, a: song?.yt?.start ?? 0, b: song?.yt?.end ?? 0, offset: song?.yt?.offset || 0,
    bpm: song?.bpm || 90, speed: 1, loop: false, title: song?.title || '', taps: [], capture: 'listen',
    snap: 'auto', fit: true, grid: 0.25, keyGuess: song?.key || null, draft: null,
  };
  const el = openLayer(`
    <div class="topbar"><button class="icon" data-close>${I.close}</button><h2>YouTube studio</h2></div>
    <div class="wrap">
      <div class="row gap"><input class="in grow" id="yurl" placeholder="Paste a YouTube link" value="${st.id ? 'https://youtu.be/' + st.id : ''}" autocapitalize="off" autocomplete="off"><button class="btn primary small" id="yload">Load</button></div>
      <div class="ytframe" id="yframe" style="margin-top:10px"><div style="display:grid;place-items:center;color:var(--faint);font-weight:700">No video yet</div></div>
      <div class="row gap" style="margin-top:8px"><span class="note">Now</span><span class="now" id="ynow">0:00.0</span><span class="grow"></span>
        <div class="seg" id="yspeed"><button data-s="0.5">0.5×</button><button data-s="0.75">0.75×</button><button data-s="1" class="on">1×</button></div></div>

      <div class="ab">
        <div class="abbox"><div class="lab">Start (A)</div><input id="ya" value="${fmtTime(st.a)}"><div class="nudges"><button data-n="a:-1">−1s</button><button data-n="a:-0.1">−.1</button><button data-n="a:0.1">+.1</button><button data-n="a:1">+1s</button></div>
          <button class="btn small" style="width:100%;margin-top:6px" data-set="a">Set to now</button></div>
        <div class="abbox"><div class="lab">End (B)</div><input id="yb" value="${fmtTime(st.b)}"><div class="nudges"><button data-n="b:-1">−1s</button><button data-n="b:-0.1">−.1</button><button data-n="b:0.1">+.1</button><button data-n="b:1">+1s</button></div>
          <button class="btn small" style="width:100%;margin-top:6px" data-set="b">Set to now</button></div>
      </div>
      <div class="grid2" style="margin-top:10px"><button class="btn" id="yplay">${I.play} Play A→B</button><button class="btn" id="yloop">↻ Loop A→B</button></div>
      <p class="note" style="margin-top:8px">Tip: set <b>Start</b> exactly on the first beat of the phrase. That beat becomes beat 1 of your notes.</p>

      <h2 class="sec">Tempo</h2>
      <div class="card"><div class="row gap"><div class="grow"><label class="f" style="margin-top:0">BPM</label><input class="in" id="ybpm" inputmode="numeric" value="${st.bpm}"></div>
        <button class="btn" id="ytap" style="min-width:120px;align-self:flex-end">Tap beat</button></div>
        <p class="note" style="margin-top:8px">Play the part and tap along with the beat 8+ times. Leave it if you don't know — the draft will estimate it.</p></div>

      <h2 class="sec">Get the notes</h2>
      <div class="seg" id="ycap" style="display:flex"><button data-c="listen" class="on" style="flex:1">Listen & draft</button><button data-c="play" style="flex:1">Play it in</button><button data-c="type" style="flex:1">Type</button></div>
      <div class="card" id="ycapbox" style="margin-top:10px"></div>
      <div id="ydraft"></div>
    </div>`, { kind: 'full', onClose: () => { stop(); yt.destroy(); if (detector.running) detector.stop(); } });

  const f = (id) => $('#' + id, el);
  const yt = new YTPlayer(f('yframe'));
  let ready = false, raf = null, capturing = null;

  const load = async () => {
    const p = parseYouTube(f('yurl').value);
    if (!p) return toast('That does not look like a YouTube link');
    f('yframe').innerHTML = '<div style="display:grid;place-items:center;color:var(--faint);font-weight:700">Loading…</div>';
    try {
      await yt.load(p.id, st.id === p.id ? st.a : p.t);
      ready = true;
      if (st.id !== p.id) { st.a = p.t || 0; st.b = 0; }
      st.id = p.id;
      setTimeout(() => { const t = yt.title(); if (t && !st.title) st.title = t; }, 1500);
      showAB(); tick();
    } catch (e) { f('yframe').innerHTML = `<div style="display:grid;place-items:center;padding:16px;text-align:center" class="err">${esc(e.message)}</div>`; }
  };
  f('yload').onclick = () => { unlockAudio(); load(); };
  if (st.id) load();

  const tick = () => {
    cancelAnimationFrame(raf);
    const loop = () => { if (!el.isConnected) return; if (ready) f('ynow').textContent = fmtTime(yt.time()); raf = requestAnimationFrame(loop); };
    loop();
  };
  const showAB = () => { f('ya').value = fmtTime(st.a); f('yb').value = fmtTime(st.b); };
  f('ya').onchange = () => { st.a = parseTime(f('ya').value); showAB(); };
  f('yb').onchange = () => { st.b = parseTime(f('yb').value); showAB(); };
  $$('[data-n]', el).forEach((b) => b.onclick = () => {
    const [k, d] = b.dataset.n.split(':'); st[k] = Math.max(0, Math.round((st[k] + Number(d)) * 10) / 10); showAB();
    if (ready && k === 'a') { yt.seek(st.a); }
  });
  $$('[data-set]', el).forEach((b) => b.onclick = () => { if (!ready) return toast('Load a video first'); st[b.dataset.set] = Math.round(yt.time() * 10) / 10; showAB(); });
  const needAB = () => { if (!ready) { toast('Load a video first'); return false; } if (!(st.b > st.a + 0.5)) { toast('Set an End (B) after the Start (A)'); return false; } return true; };
  f('yplay').onclick = () => { if (!needAB()) return; yt.setRate(st.speed); yt.playRange(st.a, st.b); };
  f('yloop').onclick = () => {
    if (!needAB()) return;
    st.loop = !st.loop; f('yloop').classList.toggle('teal', st.loop);
    if (st.loop) { yt.setRate(st.speed); yt.loop(st.a, st.b); } else yt.pause();
  };
  f('yspeed').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; st.speed = +b.dataset.s; $$('button', f('yspeed')).forEach((x) => x.classList.toggle('on', x === b)); if (ready) st.speed = yt.setRate(st.speed); };
  f('ybpm').onchange = () => { st.bpm = Math.max(30, Math.min(260, +f('ybpm').value || 90)); st.bpmUser = true; };
  f('ytap').onclick = () => {
    const t = ready && yt.playing ? yt.time() : performance.now() / 1000 * st.speed;
    const prev = st.taps[st.taps.length - 1];
    if (prev != null && t - prev > 2.5) st.taps = [];
    st.taps.push(t);
    if (st.taps.length >= 4) {
      const iv = []; for (let i = 1; i < st.taps.length; i++) iv.push(st.taps[i] - st.taps[i - 1]);
      iv.sort((x, y) => x - y); const med = iv[Math.floor(iv.length / 2)];
      st.bpm = Math.round(60 / med); f('ybpm').value = st.bpm; st.bpmUser = true;
    }
    f('ytap').textContent = `Tap beat (${st.taps.length})`;
  };

  // ---------- capture modes ----------
  const capBox = f('ycapbox');
  const keyOpts = `<option value="auto">Auto-detect key</option><option value="off">Off (keep exact pitches)</option>
    <optgroup label="Raga (Sa = key)">${RAGAS.map((r) => `<option value="raga:${r.id}">${esc(r.name)}</option>`).join('')}</optgroup>`;
  const renderCap = () => {
    $$('button', f('ycap')).forEach((x) => x.classList.toggle('on', x.dataset.c === st.capture));
    if (st.capture === 'listen') {
      capBox.innerHTML = `<p>The section plays and the app listens through the microphone, then writes a <b>rough draft</b> of the melody. Works best on clear melody lines (a solo voice, flute or violin) — busy orchestration or heavy gamakas will need fixing by hand.</p>
        <p class="note" style="margin-top:8px">Turn the volume up. Best result: play the video from a laptop or speaker and let the phone listen.</p>
        <div class="grid2"><div><label class="f">Snap to scale</label><select class="in" id="ysnap">${keyOpts}</select></div>
        <div><label class="f">Sa / key</label><select class="in" id="ykey"><option value="">Auto</option>${ALL_KEYS.map((k) => `<option ${st.keyGuess === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div></div>
        <div class="toggle"><div class="tl">Move to right-hand range</div><label class="switch"><input type="checkbox" id="yfit" ${st.fit ? 'checked' : ''}><span></span></label></div>
        <canvas class="cap" id="ycv"></canvas>
        <button class="btn primary" id="ygo" style="width:100%;margin-top:10px">🎤 Listen to A→B</button>`;
      f('ysnap').value = st.snap; f('ysnap').onchange = () => (st.snap = f('ysnap').value);
      f('yfit').onchange = () => (st.fit = f('yfit').checked);
      f('ygo').onclick = () => startCapture('listen');
    } else if (st.capture === 'play') {
      capBox.innerHTML = `<p>Play the melody on your keyboard (the app listens) or on the keys below. With <b>video on</b>, the section plays while you record — use wired headphones so the mic only hears you.</p>
        <div class="toggle"><div class="tl">Video plays while recording</div><label class="switch"><input type="checkbox" id="ywith" checked><span></span></label></div>
        <div class="toggle"><div class="tl">Metronome click</div><label class="switch"><input type="checkbox" id="ymet"><span></span></label></div>
        <div class="toggle"><div class="tl">Input</div><div class="seg" id="yin"><button data-i="mic" class="${S.settings.input === 'mic' ? 'on' : ''}">Microphone</button><button data-i="touch" class="${S.settings.input !== 'mic' ? 'on' : ''}">Screen keys</button></div></div>
        <canvas class="cap" id="ycv" style="height:60px"></canvas>
        <canvas class="mini" id="ykb" style="height:120px"></canvas>
        <button class="btn primary" id="ygo" style="width:100%;margin-top:10px">● Record A→B</button>`;
      let inp = S.settings.input === 'mic' ? 'mic' : 'touch';
      f('yin').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; inp = b.dataset.i; $$('button', f('yin')).forEach((x) => x.classList.toggle('on', x === b)); };
      const kb = new Keyboard(f('ykb'), {
        onDown: (m) => { unlockAudio(); const h = playNote(m, 0, null, 0.8); kb.pressed.set(m, '#B794F6'); kb._h = kb._h || {}; kb._h[m] = h; if (capturing && capturing.touch) capturing.touch.push({ m, on: capturing.clock() }); kb.draw(); },
        onUp: (m) => { kb.pressed.delete(m); if (kb._h && kb._h[m]) kb._h[m].stop(); if (capturing && capturing.touch) { const n = [...capturing.touch].reverse().find((x) => x.m === m && x.off == null); if (n) n.off = capturing.clock(); } kb.draw(); },
      });
      kb.setRange(55, 84); kb.labels = 'both'; requestAnimationFrame(() => kb.draw());
      f('ygo').onclick = () => startCapture('play', { withVideo: f('ywith').checked, metro: f('ymet').checked, input: inp });
    } else {
      capBox.innerHTML = `<p>Type or paste the notes for this section — Western (C D E) or Carnatic (S R G), whichever you have. The YouTube link and timing are saved with the song so the original plays as your backing track.</p>
        <button class="btn primary" id="ygo" style="width:100%;margin-top:12px">✎ Open the note editor</button>`;
      f('ygo').onclick = () => toEditor('');
    }
  };
  f('ycap').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; st.capture = b.dataset.c; renderCap(); };
  renderCap();

  function stop() {
    if (!capturing) return;
    capturing.stopped = true;
    try { yt.pause(); } catch (e) { /* */ }
  }

  async function startCapture(kind, o = {}) {
    if (capturing && !capturing.stopped) { finishCapture(); return; }
    const useVideo = kind === 'listen' || o.withVideo;
    if (useVideo && !needAB()) return;
    if (useVideo) { yt.seek(st.a); yt.play(); } // start inside the tap (iOS needs a direct gesture)
    await unlockAudio();
    const useMic = kind === 'listen' || o.input === 'mic';
    if (useMic) {
      try { await detector.start(); detector.gateDb = S.settings.gateDb - (kind === 'listen' ? 6 : 0); }
      catch (e) { toast(micError(e)); return; }
    }
    st.bpm = Math.max(30, Math.min(260, +f('ybpm').value || st.bpm));
    const ctx = getCtx();
    const cap = capturing = { kind, frames: [], onsets: [], touch: useMic ? null : [], stopped: false, useVideo, useMic };
    const btn = f('ygo'); btn.textContent = '■ Stop'; btn.classList.remove('primary'); btn.classList.add('danger');
    const t0 = ctx.currentTime + (useVideo ? 0 : (60 / st.bpm) * 4); // count-in when recording without video
    cap.clock = () => (useVideo ? yt.time() - st.a : (ctx.currentTime - t0));
    if (useVideo) {
      yt.setRate(st.speed); yt.seek(st.a); yt.play();
      const w0 = performance.now(); while (!yt.playing && performance.now() - w0 < 8000) await new Promise((r) => setTimeout(r, 50));
      if (!yt.playing) { toast('The video did not start'); finishCapture(); return; }
    } else {
      for (let i = 0; i < 4; i++) click(ctx.currentTime + 0.05 + i * 60 / st.bpm, i === 0);
    }
    let nextClick = 0;
    const cv = f('ycv'); const g = cv.getContext('2d');
    const loop = () => {
      if (cap.stopped || !el.isConnected) return;
      const t = cap.clock();
      if (o.metro) { const spb = 60 / st.bpm; while (nextClick * spb < t + 0.15) { click(ctx.currentTime + (nextClick * spb - t) / (useVideo ? st.speed : 1), nextClick % 4 === 0); nextClick++; } }
      if (useMic) {
        const fr = detector.frame();
        if (t >= 0) {
          cap.frames.push({ t, midi: fr.freq ? freqToMidi(fr.freq) : null, db: fr.db, clarity: fr.clarity });
          if (fr.onset) cap.onsets.push(t);
        }
      }
      drawCapture(cv, g, cap, useVideo ? st.b - st.a : null);
      if (useVideo && t >= st.b - st.a) { finishCapture(); return; }
      requestAnimationFrame(loop);
    };
    loop();
  }

  function finishCapture() {
    const cap = capturing; if (!cap || cap.processed) return;
    cap.stopped = true; cap.processed = true;
    try { if (cap.useVideo) yt.pause(); } catch (e) { /* */ }
    if (detector.running) detector.stop();
    const btn = f('ygo'); if (btn) { btn.classList.add('primary'); btn.classList.remove('danger'); btn.textContent = cap.kind === 'listen' ? '🎤 Listen again' : '● Record again'; }
    let notes; // seconds
    if (cap.touch) {
      const end = cap.clock();
      notes = cap.touch.filter((n) => n.on >= -0.2).map((n) => ({ t: Math.max(0, n.on), d: Math.max(0.08, (n.off ?? end) - n.on), m: n.m }));
    } else {
      notes = segmentFrames(cap.frames.filter((x) => x.clarity > 0.8 || x.midi == null), { gateDb: detector.gateDb, onsets: cap.onsets, minDur: cap.kind === 'listen' ? 0.11 : 0.07 });
    }
    if (!notes.length) { f('ydraft').innerHTML = `<div class="card"><p class="err">No clear notes were heard.</p><p class="note">Turn the volume up, move closer, or lower the threshold in Settings → Mic check.</p></div>`; return; }
    let bpm = +f('ybpm').value || 0;
    if (!bpm || (cap.kind === 'listen' && !st.bpmUser && !song)) { bpm = estimateBpm(notes.map((n) => n.t)); f('ybpm').value = bpm; }
    st.bpm = bpm;
    // key / raga snapping (listen mode)
    let key = f('ykey') && f('ykey').value || st.keyGuess || null;
    if (!key) key = detectKey(notes);
    st.keyGuess = key;
    const sa = keyTonicPc(key);
    let raga = null;
    if (cap.kind === 'listen' && st.snap !== 'off') {
      if (st.snap.startsWith('raga:')) { raga = st.snap.slice(5); notes = snapToScale(notes, sa, RAGA_BY_ID[raga].semis); }
      else notes = snapToScale(notes, sa, isMinorKey(key) ? MINOR : MAJOR);
    }
    let shift = 0;
    if (cap.kind === 'listen' && st.fit) { const r = fitOctave(notes); notes = r.notes; shift = r.shift; }
    const beats = toBeats(notes, bpm, { grid: st.grid, origin: st.offset });
    const text = notesToText(beats, { key, ts: [4, 4] });
    const fits = suggestRagas(beats, sa).slice(0, 4).map((r) => r.name);
    st.draft = { text, key, raga, bpm, beats };
    f('ydraft').innerHTML = `<div class="card"><h3>Draft ready — ${beats.length} notes</h3>
      <p>Key guess <b>${esc(key)}</b> · ${bpm} BPM${shift ? ` · moved ${shift > 0 ? 'up' : 'down'} ${Math.abs(shift / 12)} octave(s)` : ''}${fits.length ? ` · fits ${esc(fits.join(', '))}` : ''}</p>
      <textarea class="in" id="ytext" spellcheck="false" style="margin-top:10px;min-height:140px">${esc(text)}</textarea>
      <div class="grid2" style="margin-top:10px"><button class="btn" id="yhear">${I.ear} Hear draft</button><button class="btn" id="ycomp">Compare with video</button></div>
      <button class="btn primary" id="ynext" style="width:100%;margin-top:10px">Continue → name it & save</button>
      <p class="note" style="margin-top:8px">${cap.kind === 'listen' ? 'This is a draft from a mixed recording — expect wrong or extra notes. Fix them in the next screen, or use “Play it in” for the parts it got wrong.' : 'Check the timing, then save.'}</p></div>`;
    f('yhear').onclick = () => { const spb = 60 / bpm; const t = getCtx().currentTime + 0.1; beats.forEach((n) => playNote(n.m, t + n.t * spb, n.d * spb, 0.8)); };
    f('ycomp').onclick = () => {
      if (!ready) return;
      yt.setRate(1); yt.playRange(st.a, st.b || st.a + 8);
      const spb = 60 / bpm; const t = getCtx().currentTime + 0.35; beats.forEach((n) => playNote(n.m, t + n.t * spb, n.d * spb, 0.6));
    };
    f('ynext').onclick = () => toEditor(f('ytext').value);
    f('ydraft').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toEditor(text) {
    const yt0 = st.id ? { id: st.id, start: st.a, end: st.b || null, offset: st.offset } : null;
    const pre = { title: st.title || yt.title() || '', yt: yt0, bpm: st.bpm, key: st.keyGuess || 'C', raga: st.draft?.raga || '', rh: text || '' };
    if (song && !song.builtin) {
      // updating an existing song: keep its notes unless a new draft was made
      const upd = { ...song, yt: yt0, bpm: text ? st.bpm : song.bpm };
      if (text) upd.src = { ...(song.src || {}), rh: text };
      closeLayer(el);
      openEditor(upd, { onSaved: opts.onSaved });
      return;
    }
    closeLayer(el);
    openEditor(null, { onSaved: opts.onSaved, prefill: pre });
  }
}

function drawCapture(cv, g, cap, total) {
  const dpr = window.devicePixelRatio || 1; const W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const span = total || Math.max(8, (cap.frames.length ? cap.frames[cap.frames.length - 1].t : 0) + 1);
  const X = (t) => (t / span) * W, Y = (m) => H - ((m - 45) / 45) * H;
  g.fillStyle = '#B794F6';
  cap.frames.forEach((fr) => { if (fr.midi != null && fr.clarity > 0.8) g.fillRect(X(fr.t), Y(fr.midi) - 1.5, 2, 3); });
  if (cap.touch) { g.fillStyle = '#FFB627'; cap.touch.forEach((n) => g.fillRect(X(n.on), Y(n.m) - 2, Math.max(3, X((n.off ?? n.on + 0.2) - n.on)), 4)); }
  const now = cap.clock ? cap.clock() : 0;
  g.fillStyle = 'rgba(255,182,39,0.8)'; g.fillRect(X(Math.max(0, now)), 0, 2, H);
}
