// Web Audio: a light piano-like synth, metronome clicks and a tanpura-style drone.
import { midiToFreq } from './theory.js';

let ctx = null, master, musicBus, clickBus, droneBus, pianoWave, droneWave;
const vols = { music: 0.8, click: 0.6, drone: 0.35 };

export function getCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = 0.9;
  master.connect(comp); comp.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = vols.music; musicBus.connect(master);
  clickBus = ctx.createGain(); clickBus.gain.value = vols.click; clickBus.connect(master);
  droneBus = ctx.createGain(); droneBus.gain.value = vols.drone; droneBus.connect(master);
  // piano-ish harmonic recipe
  const h = [0, 1, 0.55, 0.32, 0.22, 0.12, 0.09, 0.05, 0.04, 0.025, 0.015];
  pianoWave = ctx.createPeriodicWave(new Float32Array(h.length), Float32Array.from(h));
  // tanpura: bright, buzzy (jawari) spectrum
  const d = [0]; for (let k = 1; k < 32; k++) d.push((k < 4 ? 1 : 1.6) / Math.pow(k, 0.9));
  droneWave = ctx.createPeriodicWave(new Float32Array(d.length), Float32Array.from(d));
  return ctx;
}

export function setSession(type) {
  try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) { /* not supported */ }
}

/** Must be called from a user gesture (tap) on iOS. */
export async function unlockAudio() {
  const c = getCtx();
  try { if (c.state !== 'running') await c.resume(); } catch (e) { /* ignore */ }
  try {
    const b = c.createBuffer(1, 1, c.sampleRate); const s = c.createBufferSource();
    s.buffer = b; s.connect(c.destination); s.start(0);
  } catch (e) { /* ignore */ }
  return c;
}

export function setVolumes(v) {
  Object.assign(vols, v);
  if (!ctx) return;
  musicBus.gain.value = vols.music; clickBus.gain.value = vols.click; droneBus.gain.value = vols.drone;
}
export const now = () => (ctx ? ctx.currentTime : 0);

/**
 * Play a note. Returns {stop(at)}.
 * @param {number} m midi  @param {number} when ctx time  @param {number} dur seconds (null = until stop())
 */
export function playNote(m, when = 0, dur = 0.6, vel = 0.8) {
  const c = getCtx();
  const t0 = Math.max(when || 0, c.currentTime);
  const f = midiToFreq(m);
  const osc = c.createOscillator(); osc.setPeriodicWave(pianoWave); osc.frequency.value = f;
  const osc2 = c.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = f * 2.002;
  const g2 = c.createGain(); g2.gain.value = 0.12;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
  const g = c.createGain(); g.gain.value = 0;
  const peak = 0.32 * vel * Math.min(1.25, Math.max(0.55, 1.1 - (m - 60) / 70));
  const tau = Math.max(0.35, 1.5 * Math.pow(2, -(m - 48) / 24)); // lower notes ring longer
  lp.frequency.setValueAtTime(Math.min(12000, f * 9), t0);
  lp.frequency.setTargetAtTime(Math.min(6000, f * 3.5), t0 + 0.01, 0.35);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.006);
  g.gain.setTargetAtTime(peak * 0.0001, t0 + 0.006, tau);
  osc.connect(lp); osc2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(musicBus);
  osc.start(t0); osc2.start(t0);
  let stopped = false;
  const stop = (at) => {
    if (stopped) return; stopped = true;
    const te = Math.max(at ?? c.currentTime, t0 + 0.02);
    try {
      g.gain.cancelScheduledValues(te);
      g.gain.setTargetAtTime(0, te, 0.07);
      osc.stop(te + 0.5); osc2.stop(te + 0.5);
    } catch (e) { /* already stopped */ }
  };
  if (dur != null) stop(t0 + Math.max(0.08, dur));
  else { osc.stop(t0 + 12); osc2.stop(t0 + 12); }
  return { stop, t0 };
}

export function click(when, accent = false) {
  const c = getCtx();
  const t0 = Math.max(when, c.currentTime);
  const o = c.createOscillator(); o.type = 'square'; o.frequency.value = accent ? 1760 : 1175;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(accent ? 0.35 : 0.22, t0 + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
  o.connect(hp); hp.connect(g); g.connect(clickBus); o.start(t0); o.stop(t0 + 0.06);
}

// ---------- Tanpura drone (Pa – Sa – Sa – low Sa cycle) ----------
let droneTimer = null, droneNext = 0, droneStep = 0, droneSa = 48;
function pluck(m, when) {
  const c = getCtx();
  const o = c.createOscillator(); o.setPeriodicWave(droneWave); o.frequency.value = midiToFreq(m);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.18, when + 0.04);
  g.gain.setTargetAtTime(0.0001, when + 0.05, 1.6);
  o.connect(lp); lp.connect(g); g.connect(droneBus); o.start(when); o.stop(when + 5);
}
export function startDrone(saMidi = 48, usePa = true) {
  stopDrone();
  const c = getCtx();
  droneSa = saMidi; droneStep = 0; droneNext = c.currentTime + 0.05;
  const cycle = [usePa ? saMidi - 5 : saMidi - 1, saMidi + 12, saMidi + 12, saMidi];
  const gaps = [0.9, 0.9, 0.9, 1.5];
  droneTimer = setInterval(() => {
    while (droneNext < c.currentTime + 0.25) {
      pluck(cycle[droneStep % 4], droneNext);
      droneNext += gaps[droneStep % 4]; droneStep++;
    }
  }, 60);
}
export function stopDrone() { if (droneTimer) clearInterval(droneTimer); droneTimer = null; }
export const droneOn = () => !!droneTimer;
