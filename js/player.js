// Practice engine: Wait mode (notes wait for you), Play-along (in time, scored), Listen (demo).
import { getCtx, playNote, click, now as audioNow } from './audio.js';
import { pc, beatsPerBar } from './theory.js';
import { StaffView } from './staff.js';
import { FallingView } from './falling.js';
import { Keyboard, COLORS } from './keyboard.js';

const PERFECT = 0.12, GOOD = 0.25, WINDOW = 0.38; // seconds

export class Engine {
  constructor({ staffCanvas, fallCanvas, kbCanvas, settings, detector, onStatus, onFinish, onProgress }) {
    this.settings = settings; this.det = detector;
    this.onStatus = onStatus || (() => {}); this.onFinish = onFinish || (() => {}); this.onProgress = onProgress || (() => {});
    this.staff = new StaffView(staffCanvas);
    this.kb = new Keyboard(kbCanvas, { onDown: (m) => this.noteOn(m, 'touch'), onUp: (m) => this.noteOff(m, 'touch') });
    this.fall = new FallingView(fallCanvas, this.kb);
    this.staffCanvas = staffCanvas; this.fallCanvas = fallCanvas;
    this.raf = null; this.status = 'idle'; this.sounding = new Map(); this.popups = []; this.ghosts = [];
    this.yt = null; this.previewing = false;
  }

  // ---------- setup ----------
  load(song, opts = {}) {
    this.song = song;
    this.mode = opts.mode || 'wait';
    this.hands = opts.hands || 'B';
    this.tempo = opts.tempo || 1;
    this.view = opts.view || this.settings.view || 'staff';
    this.range = opts.range || null;
    this.loop = !!opts.loop;
    this.yt = opts.yt || null;
    this.useYT = !!(this.yt && song.yt && opts.useYT !== false);
    this.bpb = beatsPerBar(song.ts);
    this.sa = this.settings.saMode === 'C' ? 0 : song.sa ?? 0;
    this.staff.setSong(song); this.fall.setSong(song);
    this.kb.labels = this.settings.labels; this.kb.sa = this.sa; this.kb.raga = this.staff.raga; this.kb.sig = this.staff.sig; this.kb.spellPref = song.spelling || null; this.kb.letterMap = this.staff.letterMap;
    this.setView(this.view);
    this.prepare();
    this.status = 'ready'; this.onStatus('ready');
    this.loopRender();
  }

  handsMask() { return { R: this.hands !== 'L', L: this.hands !== 'R' }; }

  prepare() {
    const s = this.song; const mask = this.handsMask();
    const [a, b] = this.range || [0, s.beats + 0.001];
    this.rangeStart = a; this.rangeEnd = b;
    const inRange = (n) => n.t >= a - 1e-6 && n.t < b - 1e-6;
    // if this song has no notes for the chosen hand, fall back to both
    if (!s.notes.some((n) => mask[n.h] && inRange(n))) { this.hands = 'B'; }
    const m2 = this.handsMask();
    const play = []; this.autoList = [];
    s.notes.forEach((n, i) => { if (!inRange(n)) return; if (this.mode !== 'listen' && m2[n.h]) play.push(i); else this.autoList.push(i); });
    play.sort((x, y) => s.notes[x].t - s.notes[y].t);
    this.groups = [];
    play.forEach((i) => {
      const n = s.notes[i]; const g = this.groups[this.groups.length - 1];
      if (g && Math.abs(g.t - n.t) < 0.03) { g.idx.push(i); g.midis.push(n.m); }
      else this.groups.push({ t: n.t, idx: [i], midis: [n.m], hit: false, missed: false, pressed: new Set(), firstPress: null, hand: n.h });
    });
    this.autoList.sort((x, y) => s.notes[x].t - s.notes[y].t);
    this.states = new Map(); this.active = new Set();
    if (this.mode !== 'listen') this.autoList.forEach((i) => this.states.set(i, 'auto'));
    this.gi = 0; this.autoPtr = 0; this.clickBeat = null;
    this.stats = { perfect: 0, good: 0, miss: 0, mistakes: 0, total: this.groups.length, startedAt: 0 };
    this.viewBeat = this.groups.length ? Math.min(this.groups[0].t, a) - 0.5 : a;
    this.chordFrames = 0; this.lastMicOnset = -1; this.wrongArmed = false; this.activatedAt = 0;
    // keyboard range
    const ms = s.notes.filter(inRange).map((n) => n.m);
    let lo = ms.length ? Math.min(...ms) : 60, hi = ms.length ? Math.max(...ms) : 72;
    const minSpan = window.innerWidth > window.innerHeight ? 24 : 17;
    while (hi - lo < minSpan) { if ((hi - lo) % 2) lo--; else hi++; }
    this.kb.setRange(lo - 1, hi + 1);
    this.updateHints();
    this.onProgress(0);
  }

  setView(v) {
    this.view = v;
    this.staffCanvas.style.display = v === 'staff' ? 'block' : 'none';
    this.fallCanvas.style.display = v === 'fall' ? 'block' : 'none';
  }
  setLabels(l) { this.settings.labels = l; this.kb.labels = l; }
  setTempo(k) {
    if (this.useYT && this.yt) { this.tempo = this.yt.setRate(k); return this.tempo; }
    const running = (this.status === 'playing' || this.status === 'countin') && this.mode !== 'wait';
    const beat = this.beat(); this.tempo = k;
    if (running) { const cin = this.countInEnd; this.startClock(beat); this.countInEnd = cin; }
    return this.tempo;
  }
  setHands(h) { this.hands = h; this.stop(); this.prepare(); this.status = 'ready'; this.onStatus('ready'); }
  setMode(m) { this.mode = m; this.stop(); this.prepare(); this.status = 'ready'; this.onStatus('ready'); }
  setRange(r, loop) { this.range = r; this.loop = loop; this.stop(); this.prepare(); this.status = 'ready'; this.onStatus('ready'); }

  spb() { return 60 / (this.song.bpm * this.tempo); } // real seconds per beat

  // ---------- transport ----------
  async start() {
    getCtx();
    this.stats.startedAt = performance.now();
    if (this.mode === 'wait') {
      this.status = 'playing'; this.onStatus('playing');
      this.activate(0);
      return;
    }
    const startBeat = this.rangeStart;
    if (this.useYT) {
      this.status = 'loading'; this.onStatus('loading');
      const rate = this.yt.setRate(this.tempo); this.tempo = rate;
      const pre = Math.max(0, this.ytTime(startBeat - this.bpb));
      this.yt.seek(pre); this.yt.play();
      const t0 = performance.now(); let asked = false;
      while (!this.yt.playing && performance.now() - t0 < 30000 && this.status === 'loading') {
        // iPhone may refuse to start an embedded video that wasn't tapped directly — ask the user to tap it once
        if (!asked && performance.now() - t0 > 2500) { asked = true; this.onStatus('yt-tap'); }
        await new Promise((r) => setTimeout(r, 50));
      }
      if (this.status !== 'loading') return;
      if (!this.yt.playing) { this.useYT = false; this.onStatus('yt-failed'); }
    }
    if (!this.useYT) {
      this.status = 'countin'; this.onStatus('countin');
      this.startClock(startBeat - this.bpb);
    } else { this.status = 'playing'; this.onStatus('playing'); }
    this.countInEnd = startBeat;
  }

  startClock(fromBeat) { this.t0 = audioNow() + 0.12; this.beat0 = fromBeat; this.clickBeat = Math.ceil(fromBeat - 1e-6); this.autoPtr = this.findAutoPtr(fromBeat); }
  ytTime(beat) { const y = this.song.yt; return y.start + (y.offset || 0) + beat * 60 / this.song.bpm; }
  /** current song position in beats */
  beat() {
    if (this.mode === 'wait') return this.viewBeat;
    if (this.useYT && this.yt) { const y = this.song.yt; return (this.yt.time() - y.start - (y.offset || 0)) * this.song.bpm / 60; }
    if (this.t0 == null) return this.rangeStart;
    return this.beat0 + (audioNow() - this.t0) / this.spb();
  }
  beatToCtx(b) { return audioNow() + (b - this.beat()) * this.spb(); }

  pause() {
    if (this.status !== 'playing' && this.status !== 'countin') return;
    this.pausedAt = this.beat(); this.status = 'paused'; this.onStatus('paused');
    if (this.useYT) this.yt.pause();
    this.stopSounds();
  }
  resume() {
    if (this.status !== 'paused') return;
    if (this.mode === 'wait') { this.status = 'playing'; this.onStatus('playing'); return; }
    const b = Math.max(this.rangeStart, this.pausedAt - this.bpb);
    // un-judge groups after the resume point so they can be played again
    this.groups.forEach((g) => { if (g.t >= b) { g.hit = false; g.missed = false; g.pressed.clear(); g.idx.forEach((i) => this.states.delete(i)); } });
    if (this.useYT) { this.yt.seek(this.ytTime(b)); this.yt.play(); this.status = 'playing'; }
    else { this.startClock(b - this.bpb); this.status = 'countin'; this.countInEnd = b; }
    this.onStatus(this.status);
  }
  restart() { this.stop(); this.prepare(); this.status = 'ready'; this.onStatus('ready'); }
  stop() {
    this.status = 'idle'; this.t0 = null;
    if (this.yt) { try { this.yt.pause(); } catch (e) { /* */ } }
    this.stopSounds();
  }
  destroy() { this.stop(); cancelAnimationFrame(this.raf); this.raf = null; this.destroyed = true; }
  stopSounds() { this.sounding.forEach((h) => h.stop()); this.sounding.clear(); }

  findAutoPtr(beat) { let k = 0; while (k < this.autoList.length && this.song.notes[this.autoList[k]].t < beat - 1e-6) k++; return k; }

  // ---------- input ----------
  noteOn(m, src) {
    if (src !== 'mic') {
      const h = playNote(m, 0, null, 0.85);
      const old = this.sounding.get('k' + m); if (old) old.stop();
      this.sounding.set('k' + m, h);
      this.kb.pressed.set(m, 'rgba(183,148,246,0.85)');
    }
    if (this.status !== 'playing' || this.previewing) return;
    const lenient = this.settings.octaveLenient;
    const eq = (a, b) => (lenient ? pc(a) === pc(b) : a === b);
    if (this.mode === 'wait') {
      const g = this.groups[this.gi]; if (!g) return;
      const tgt = g.midis.find((x) => eq(x, m));
      if (tgt != null) { g.pressed.add(tgt); this.kb.pressed.set(m, COLORS.good); if (g.midis.every((x) => g.pressed.has(x))) this.hitGroup(this.gi, null); }
      else this.wrong(m);
    } else if (this.mode === 'play') {
      const b = this.beat();
      const lat = 0; // touch: no latency compensation
      const cand = this.groups.filter((g) => !g.hit && !g.missed && Math.abs((b - lat - g.t) * this.spb()) <= WINDOW && g.midis.some((x) => eq(x, m)));
      if (!cand.length) { this.wrong(m); return; }
      const g = cand.sort((x, y) => Math.abs(x.t - b) - Math.abs(y.t - b))[0];
      if (g.firstPress == null) g.firstPress = b;
      g.pressed.add(g.midis.find((x) => eq(x, m)));
      this.kb.pressed.set(m, COLORS.good);
      if (g.midis.every((x) => g.pressed.has(x))) this.hitTimed(g, g.firstPress);
    }
  }
  noteOff(m, src) {
    if (src !== 'mic') { const h = this.sounding.get('k' + m); if (h) { h.stop(); this.sounding.delete('k' + m); } this.kb.pressed.delete(m); }
  }

  wrong(m) {
    this.stats.mistakes++;
    this.ghosts.push({ m, until: performance.now() + 600 });
    this.kb.flashKey(m, COLORS.bad);
    if (this.mode === 'play') this.popup('Wrong note', COLORS.bad);
  }
  popup(text, color) { this.popups.push({ text, color, born: performance.now() }); if (this.popups.length > 4) this.popups.shift(); }

  // ---------- wait mode ----------
  activate(gi) {
    this.gi = gi; this.active.clear();
    const g = this.groups[gi];
    if (!g) { this.finish(); return; }
    g.idx.forEach((i) => this.active.add(i)); g.pressed.clear();
    this.activatedAt = audioNow(); this.chordFrames = 0; this.wrongArmed = false;
    this.updateHints();
  }
  hitGroup(gi) {
    const g = this.groups[gi]; if (!g || g.hit) return;
    g.hit = true; g.idx.forEach((i) => this.states.set(i, 'hit'));
    this.stats.perfect++;
    g.midis.forEach((m) => this.kb.flashKey(m, COLORS.good, 250));
    // other hand plays its part up to the next group, in tempo
    const next = this.groups[gi + 1];
    const until = next ? next.t : this.rangeEnd;
    if (this.settings.autoOtherHand) {
      while (this.autoPtr < this.autoList.length && this.song.notes[this.autoList[this.autoPtr]].t < until - 1e-6) {
        const n = this.song.notes[this.autoList[this.autoPtr]];
        if (n.t >= g.t - 1e-6) {
          const when = audioNow() + 0.02 + (n.t - g.t) * this.spb();
          playNote(n.m, when, Math.min(n.d, (until - n.t) + 0.5) * this.spb(), 0.55);
          this.recentAuto = { ms: n.m, until: when + n.d * this.spb() };
        }
        this.autoPtr++;
      }
    }
    this.onProgress((gi + 1) / this.groups.length);
    if (gi + 1 >= this.groups.length) {
      if (this.loop) { setTimeout(() => { if (this.status === 'playing') { this.resetJudgements(); this.activate(0); } }, 600); this.active.clear(); }
      else setTimeout(() => this.finish(), 450);
      this.active.clear();
      return;
    }
    this.activate(gi + 1);
  }
  resetJudgements() {
    this.groups.forEach((g) => { g.hit = false; g.missed = false; g.pressed.clear(); g.firstPress = null; g.idx.forEach((i) => this.states.delete(i)); });
    this.autoPtr = 0; this.viewBeat = this.groups.length ? this.groups[0].t - 0.5 : this.rangeStart;
  }

  // ---------- play-along ----------
  hitTimed(g, atBeat) {
    if (g.hit) return;
    g.hit = true; g.idx.forEach((i) => this.states.set(i, 'hit'));
    const err = Math.abs((atBeat - g.t) * this.spb());
    if (err <= PERFECT) { this.stats.perfect++; this.popup('Perfect', COLORS.good); }
    else { this.stats.good++; this.popup(atBeat < g.t ? 'Early' : 'Late', '#FFD166'); }
  }

  updateHints() {
    this.kb.hints.clear();
    if (!this.settings.hints) return;
    if (this.mode === 'wait') { const g = this.groups[this.gi]; if (g) g.idx.forEach((i) => this.kb.hints.set(this.song.notes[i].m, this.song.notes[i].h)); }
  }

  // ---------- the loop ----------
  loopRender() {
    cancelAnimationFrame(this.raf);
    let last = performance.now();
    const tick = () => {
      if (this.destroyed) return;
      const t = performance.now(); const dt = Math.min(0.1, (t - last) / 1000); last = t;
      try { this.update(dt); this.render(); } catch (e) { console.error(e); }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  update(dt) {
    const det = this.det && this.det.running ? this.det.frame() : null;
    this.kb.micNote = det && det.stable != null ? det.stable : null;
    const lenient = this.settings.octaveLenient;
    const eq = (a, b) => (lenient ? pc(a) === pc(b) : a === b);
    if (det && det.onset) this.lastMicOnset = det.t;
    const autoSounding = (m) => this.recentAuto && this.recentAuto.until > audioNow() && eq(this.recentAuto.ms, m);

    if (this.mode === 'wait') {
      const g = this.groups[this.gi];
      const target = g ? g.t - 0.15 : this.viewBeat;
      this.viewBeat += (target - this.viewBeat) * Math.min(1, dt * 9);
      if (this.status === 'playing' && g && det && !this.previewing) {
        const fresh = this.lastMicOnset > this.activatedAt;
        if (g.midis.length === 1) {
          if (fresh && det.stable != null) {
            if (eq(det.stable, g.midis[0])) this.hitGroup(this.gi);
            // only call it wrong once a *new* pitch has settled after the attack (the old note rings on for a few frames)
            else if (!this.wrongArmed && !autoSounding(det.stable) && det.clarity > 0.9 && det.stableSince != null &&
              det.stableSince >= this.lastMicOnset - 0.005 && det.t - det.stableSince >= 0.05 && det.t - this.lastMicOnset < 0.5) { this.wrongArmed = true; this.wrong(det.stable); }
          }
        } else if (fresh && det.t - this.lastMicOnset < 1.2) {
          const r = this.det.present(g.midis, lenient);
          this.chordFrames = r.ok ? this.chordFrames + 1 : 0;
          if (this.chordFrames >= 2) this.hitGroup(this.gi);
        }
      }
    } else if (this.status === 'playing' || this.status === 'countin') {
      const b = this.beat();
      if (this.status === 'countin' && b >= this.countInEnd) { this.status = 'playing'; this.onStatus('playing'); }
      // metronome (only with the app's own clock)
      const metro = this.mode === 'play' ? this.settings.metronome : this.settings.metronomeListen;
      if (!this.useYT && this.clickBeat != null) {
        while (this.clickBeat < b + 0.25 / this.spb() + 1e-6) {
          if (metro || this.status === 'countin' || this.clickBeat < this.countInEnd) click(this.beatToCtx(this.clickBeat), Math.round(this.clickBeat) % this.bpb === 0);
          this.clickBeat++;
        }
      }
      // auto / listen notes
      const playNotes = this.mode === 'listen' ? !this.useYT || this.settings.notesWithOriginal : this.settings.autoOtherHand;
      while (this.autoPtr < this.autoList.length) {
        const n = this.song.notes[this.autoList[this.autoPtr]];
        if (n.t > b + 0.2 / this.spb()) break;
        if (n.t >= b - 0.05 && playNotes) {
          playNote(n.m, this.beatToCtx(n.t), n.d * this.spb(), this.mode === 'listen' ? 0.8 : 0.55);
          this.recentAuto = { ms: n.m, until: this.beatToCtx(n.t + n.d) };
        }
        this.autoPtr++;
      }
      // what is sounding now (for highlighting)
      this.active.clear();
      if (this.mode === 'listen') this.autoList.forEach((i) => { const n = this.song.notes[i]; if (n.t <= b && b < n.t + n.d) this.active.add(i); });
      // judge play-along
      if (this.mode === 'play' && this.status === 'playing') {
        const spb = this.spb();
        const lat = this.det && this.det.running ? (this.settings.latency || 0.08) / spb : 0;
        this.kb.hints.clear();
        for (const g of this.groups) {
          if (g.t > b + 1.2) break;
          if (g.hit || g.missed) continue;
          const dtSec = (b - g.t) * spb;
          if (dtSec > WINDOW) { g.missed = true; g.idx.forEach((i) => this.states.set(i, 'miss')); this.stats.miss++; this.popup('Miss', COLORS.bad); continue; }
          if (this.settings.hints && dtSec > -0.6 * spb - 0.25) g.idx.forEach((i) => this.kb.hints.set(this.song.notes[i].m, this.song.notes[i].h));
          if (Math.abs(dtSec) <= 0.5 * spb + 0.1) g.idx.forEach((i) => this.active.add(i));
          if (det && Math.abs(dtSec) <= WINDOW + 0.1) {
            const onsetBeat = this.lastMicOnset > 0 ? b - (audioNow() - this.lastMicOnset) / spb - lat : null;
            if (onsetBeat == null || Math.abs((onsetBeat - g.t) * spb) > WINDOW) continue;
            if (g.midis.length === 1) { if (det.stable != null && eq(det.stable, g.midis[0])) { this.hitTimed(g, onsetBeat); this.lastMicOnset = -1; } }
            else if (this.det.present(g.midis, lenient).ok) { this.hitTimed(g, onsetBeat); this.lastMicOnset = -1; }
          }
        }
      }
      const total = Math.max(0.001, this.rangeEnd - this.rangeStart);
      this.onProgress(Math.max(0, Math.min(1, (b - this.rangeStart) / total)));
      if (b > this.rangeEnd + 0.6) {
        if (this.loop) {
          this.groups.forEach((g) => { g.hit = false; g.missed = false; g.pressed.clear(); g.firstPress = null; g.idx.forEach((i) => this.states.delete(i)); });
          if (this.mode !== 'listen') this.autoList.forEach((i) => this.states.set(i, 'auto'));
          if (this.useYT) { this.yt.seek(this.ytTime(this.rangeStart - Math.min(this.bpb, this.rangeStart))); this.autoPtr = 0; }
          else { this.startClock(this.rangeStart - this.bpb); this.status = 'countin'; this.countInEnd = this.rangeStart; }
        } else this.finish();
      }
    }
    const nowMs = performance.now();
    this.ghosts = this.ghosts.filter((x) => x.until > nowMs);
    this.popups = this.popups.filter((x) => nowMs - x.born < 900);
  }

  render() {
    const st = {
      beat: this.mode === 'wait' ? this.viewBeat : this.beat(),
      states: this.states, active: this.active, labels: this.settings.labels, sa: this.sa,
      ghosts: this.ghosts, popups: this.popups, range: this.range, handsMask: this.mode === 'listen' ? null : this.handsMask(),
      ppb: this.settings.zoom ? this.settings.zoom : null,
    };
    if (this.view === 'staff') this.staff.draw(st); else this.fall.draw(st);
    this.kb.draw();
  }

  finish() {
    if (this.status === 'done') return;
    this.status = 'done'; this.active.clear(); this.kb.hints.clear(); this.kb.pressed.clear();
    if (this.useYT) this.yt.pause();
    const s = this.stats;
    let score = 0, stars = 0;
    if (this.mode === 'wait') { score = s.total ? s.total / (s.total + s.mistakes) : 1; stars = score >= 0.9 ? 3 : score >= 0.75 ? 2 : 1; }
    else if (this.mode === 'play') { score = s.total ? (s.perfect + 0.75 * s.good) / s.total : 0; stars = score >= 0.9 ? 3 : score >= 0.7 ? 2 : score >= 0.45 ? 1 : 0; }
    this.onStatus('done');
    this.onFinish({ mode: this.mode, score, stars, ...s, seconds: (performance.now() - s.startedAt) / 1000 });
  }

  /** Wait mode helper: hear the original (YouTube) or the notes around the current position */
  previewHere(bars = 2) {
    const g = this.groups[this.gi]; const from = Math.max(this.rangeStart, (g ? g.t : this.viewBeat) - 1);
    const to = from + bars * this.bpb;
    this.previewing = true;
    const done = () => { this.previewing = false; this.lastMicOnset = -1; this.activatedAt = audioNow(); };
    if (this.yt && this.song.yt) {
      const rate = this.yt.setRate(Math.min(1, this.tempo));
      this.yt.playRange(this.ytTime(from), this.ytTime(to), done);
      setTimeout(done, ((to - from) * 60 / this.song.bpm / rate + 3) * 1000);
      return;
    }
    const spb = this.spb();
    this.song.notes.forEach((n) => { if (n.t >= from && n.t < to) playNote(n.m, audioNow() + 0.05 + (n.t - from) * spb, n.d * spb, 0.75); });
    setTimeout(done, ((to - from) * spb + 0.4) * 1000);
  }
}
