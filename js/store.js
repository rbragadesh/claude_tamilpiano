// Persistence: settings + progress in localStorage, songs (and optional audio) in IndexedDB.
const LS = 'isaikeys.';
export const DEFAULT_SETTINGS = {
  input: 'mic', labels: 'both', view: 'staff', hints: true, octaveLenient: true, latency: 0.08, gateDb: -48,
  metronome: true, metronomeListen: false, autoOtherHand: true, notesWithOriginal: false, saMode: 'song',
  music: 0.8, click: 0.6, drone: 0.35, notation: 'auto', zoom: 0,
};
export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(LS + 'settings') || '{}') }; } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { try { localStorage.setItem(LS + 'settings', JSON.stringify(s)); } catch (e) { /* */ } }

export function loadProgress() { try { return JSON.parse(localStorage.getItem(LS + 'progress') || '{}'); } catch (e) { return {}; } }
export function saveProgress(p) { try { localStorage.setItem(LS + 'progress', JSON.stringify(p)); } catch (e) { /* */ } }
/** record a result; keeps best stars/score per key */
export function recordResult(key, res) {
  const p = loadProgress();
  const old = p[key] || { stars: 0, score: 0, plays: 0 };
  p[key] = { stars: Math.max(old.stars, res.stars || 0), score: Math.max(old.score, res.score || 0), plays: old.plays + 1, last: Date.now() };
  const today = new Date().toISOString().slice(0, 10);
  const days = new Set(p._days || []); days.add(today); p._days = [...days].slice(-400);
  saveProgress(p);
  return p[key];
}
export function streak() {
  const days = new Set(loadProgress()._days || []);
  let n = 0; const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- IndexedDB ----------
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open('isaikeys', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('songs')) d.createObjectStore('songs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}
const tx = async (store, mode, fn) => {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
  });
};
export const allSongs = () => tx('songs', 'readonly', (s) => s.getAll()).then((x) => x || []);
export const getSong = (id) => tx('songs', 'readonly', (s) => s.get(id));
export const putSong = (song) => { song.updated = Date.now(); return tx('songs', 'readwrite', (s) => s.put(song)); };
export const deleteSong = (id) => tx('songs', 'readwrite', (s) => s.delete(id));
export const putAudio = (id, blob) => tx('audio', 'readwrite', (s) => s.put(blob, id));
export const getAudio = (id) => tx('audio', 'readonly', (s) => s.get(id));

export async function requestPersistence() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* */ }
  return false;
}

export async function exportLibrary() {
  const songs = await allSongs();
  return JSON.stringify({ app: 'isai-keys', version: 1, exported: new Date().toISOString(), songs, progress: loadProgress() }, null, 1);
}
export async function importLibrary(text, { merge = true } = {}) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.songs)) throw new Error('Not an Isai Keys backup file');
  let n = 0;
  for (const s of data.songs) { if (s && s.id && Array.isArray(s.notes)) { await putSong(s); n++; } }
  if (data.progress && merge) { const p = loadProgress(); Object.entries(data.progress).forEach(([k, v]) => { if (!p[k] || (v.stars || 0) > (p[k].stars || 0)) p[k] = v; }); saveProgress(p); }
  return n;
}
