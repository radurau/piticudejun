// Track lengths for the runtime estimate. js/preview.js caches only the preview URL of an iTunes
// match (not trackTimeMillis), so this asks the same iTunes Search API, matching with the same
// scoring as preview.js, and caches { ms } per song. Slow and polite: one request every 1.5 s,
// at most 10 a minute, so the 30-second previews keep their share of the rate limit.
import { norm } from '../../data.js';
import { _test as P } from '../../preview.js';

const PREFIX = 'pd:sl:dur:';
const HIT_DAYS = 90, MISS_DAYS = 7, GAP_MS = 1500, PER_MIN = 10;
const keyOf = (artist, song) => norm(artist) + '|' + norm(song);
const mem = new Map();
const recent = [];
let queue = [], busy = false, listeners = new Set();

function read(k) {
  if (mem.has(k)) return mem.get(k);
  let c = null;
  try { c = JSON.parse(localStorage.getItem(PREFIX + k)); } catch { c = null; }
  if (c && Date.now() - c.t < (c.ms ? HIT_DAYS : MISS_DAYS) * 864e5) { mem.set(k, c); return c; }
  return null;
}
function write(k, v) {
  mem.set(k, v);
  try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch { /* storage blocked */ }
}

/** Known length in ms, or null (unknown / not looked up yet). */
export function durationOf(artist, song) {
  return read(keyOf(artist, song))?.ms || null;
}

async function fetchOne({ artist, song }) {
  const term = `${P.mainArtist(artist)} ${P.clean(song)}`;
  const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5&country=RO`);
  if (!res.ok) throw new Error('http ' + res.status);
  const { results = [] } = await res.json();
  let best = null, top = 0;
  for (const r of results) { const s = P.score(r, artist, song); if (s > top) { best = r; top = s; } }
  return best && top >= 3.5 && best.trackTimeMillis ? best.trackTimeMillis : null;
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const now = Date.now();
    while (recent.length && now - recent[0] > 60000) recent.shift();
    if (recent.length >= PER_MIN) { await new Promise((r) => setTimeout(r, 60000 - (now - recent[0]) + 50)); continue; }
    const job = queue.shift();
    const k = keyOf(job.artist, job.song);
    if (read(k)) continue;
    recent.push(Date.now());
    try {
      const ms = await fetchOne(job);
      write(k, { ms, t: Date.now() });
      listeners.forEach((fn) => fn(k, ms));
    } catch { /* offline or rate-limited: keep the 4-minute guess */ }
    if (queue.length) await new Promise((r) => setTimeout(r, GAP_MS));
  }
  busy = false;
}

/** Look up lengths for songs not cached yet; onUpdate(key, ms) fires per answer. */
export function want(songs) {
  for (const s of songs) {
    const k = keyOf(s.artist, s.song);
    if (read(k) || queue.some((j) => keyOf(j.artist, j.song) === k)) continue;
    queue.push(s);
  }
  pump();
}
export function onDuration(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function cancel() { queue = []; }

export const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
