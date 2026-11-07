// YouTube IFrame player wrapper: load by link, loop A–B sections, speed control, smooth clock for syncing.

let apiPromise = null;
export function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { apiPromise = null; reject(new Error('Could not load YouTube — are you online?')); };
    document.head.appendChild(s);
    setTimeout(() => { if (!(window.YT && window.YT.Player)) { apiPromise = null; reject(new Error('YouTube took too long to load')); } }, 20000);
  });
  return apiPromise;
}

/** Accepts youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, music.youtube.com, or a bare 11-char ID. */
export function parseYouTube(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return { id: s, t: 0 };
  let u;
  try { u = new URL(s.startsWith('http') ? s : 'https://' + s); } catch (e) { return null; }
  let id = null;
  if (/youtu\.be$/.test(u.hostname)) id = u.pathname.slice(1, 12);
  else if (/youtube\.com$/.test(u.hostname) || /youtube-nocookie\.com$/.test(u.hostname)) {
    id = u.searchParams.get('v');
    const mm = /\/(shorts|embed|live|v)\/([\w-]{11})/.exec(u.pathname);
    if (!id && mm) id = mm[2];
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  const t = parseTime(u.searchParams.get('t') || u.searchParams.get('start') || '0');
  return { id, t };
}

/** "1:23", "83", "1m23s", "1:02:03.5" → seconds */
export function parseTime(v) {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s?)?$/.exec(s);
  if (hms && (hms[1] || hms[2] || hms[3])) return (Number(hms[1] || 0) * 3600) + (Number(hms[2] || 0) * 60) + Number(hms[3] || 0);
  const parts = s.split(':').map(Number);
  if (parts.some((x) => !isFinite(x))) return 0;
  return parts.reduce((acc, x) => acc * 60 + x, 0);
}
export function fmtTime(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

const ERRORS = {
  2: 'That link does not look like a valid YouTube video.',
  5: 'This video cannot be played in the embedded player.',
  100: 'Video not found (removed or private).',
  101: 'The owner of this video does not allow it to be played inside other apps. Try another upload of the same song (lyric videos and audio uploads usually allow it).',
  150: 'The owner of this video does not allow it to be played inside other apps. Try another upload of the same song (lyric videos and audio uploads usually allow it).',
};

export class YTPlayer {
  constructor(container) {
    this.container = container; this.p = null; this.ready = false; this.state = -1; this.rate = 1;
    this.anchor = { raw: -1, perf: 0 }; this.onState = null; this.onError = null; this.loopTimer = null;
  }
  async load(id, start = 0) {
    const YT = await loadYT();
    if (this.p && this.id === id) { this.seek(start); return this; }
    this.destroy();
    this.id = id;
    const el = document.createElement('div');
    this.container.innerHTML = ''; this.container.appendChild(el);
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('The video player did not start.')), 20000);
      this.p = new YT.Player(el, {
        videoId: id, width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(start), controls: 1, fs: 0, iv_load_policy: 3, origin: location.origin },
        events: {
          onReady: () => { clearTimeout(to); this.ready = true; resolve(); },
          onStateChange: (e) => { this.state = e.data; this.anchor.raw = -1; this.onState && this.onState(e.data); },
          onError: (e) => { clearTimeout(to); const msg = ERRORS[e.data] || 'YouTube error ' + e.data; this.lastError = msg; this.onError && this.onError(msg); reject(new Error(msg)); },
          onPlaybackRateChange: (e) => { this.rate = e.data; },
        },
      });
    });
    return this;
  }
  get playing() { return this.state === 1; }
  play() { this.p && this.p.playVideo(); }
  pause() { this.p && this.p.pauseVideo(); this.stopLoop(); }
  seek(t) { if (this.p) { this.p.seekTo(Math.max(0, t), true); this.anchor.raw = -1; } }
  setRate(r) {
    if (!this.p) return 1;
    const avail = (this.p.getAvailablePlaybackRates && this.p.getAvailablePlaybackRates()) || [0.5, 0.75, 1];
    const best = avail.reduce((b, x) => (Math.abs(x - r) < Math.abs(b - r) ? x : b), 1);
    this.p.setPlaybackRate(best); this.rate = best; return best;
  }
  duration() { return this.p && this.p.getDuration ? this.p.getDuration() : 0; }
  title() { try { return (this.p.getVideoData && this.p.getVideoData().title) || ''; } catch (e) { return ''; } }
  /** smooth current time: YouTube reports time in coarse steps, so interpolate between reports */
  time() {
    if (!this.p || !this.p.getCurrentTime) return 0;
    const raw = this.p.getCurrentTime();
    const perf = performance.now();
    if (!this.playing) { this.anchor.raw = raw; this.anchor.perf = perf; return raw; }
    if (raw !== this.anchor.raw) {
      const predicted = this.anchor.raw < 0 ? raw : this.anchor.t + ((perf - this.anchor.perf) / 1000) * this.rate;
      this.anchor = { raw, perf, t: Math.abs(predicted - raw) > 0.12 ? raw : predicted * 0.7 + raw * 0.3 };
    }
    return this.anchor.t + ((perf - this.anchor.perf) / 1000) * this.rate;
  }
  /** loop between a and b seconds */
  loop(a, b) {
    this.stopLoop();
    this.seek(a); this.play();
    this.loopTimer = setInterval(() => { if (this.playing && this.time() >= b) this.seek(a); }, 50);
  }
  playRange(a, b, onEnd) {
    this.stopLoop(); this.seek(a); this.play();
    this.loopTimer = setInterval(() => { if (this.playing && this.time() >= b) { this.pause(); onEnd && onEnd(); } }, 50);
  }
  stopLoop() { if (this.loopTimer) clearInterval(this.loopTimer); this.loopTimer = null; }
  destroy() { this.stopLoop(); try { this.p && this.p.destroy(); } catch (e) { /* */ } this.p = null; this.ready = false; this.id = null; }
}
