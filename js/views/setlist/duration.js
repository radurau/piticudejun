// Track lengths for the runtime estimate. They come from the same iTunes match as the 30-second
// previews: js/preview.js lookup() keeps trackTimeMillis in its localStorage cache, so a song whose
// preview was played already has a length, and every request shares preview.js's rate limit.
// Slow and polite on top of that: one request every 1.5 s and at most 10 a minute from here, so the
// previews always keep their share of the budget.
import { norm } from '../../data.js';
import { lookup, cachedLookup } from '../../preview.js';

const OLD_PREFIX = 'pd:sl:dur:'; // lengths cached by earlier versions, still honoured
const OLD_HIT_DAYS = 90, GAP_MS = 1500, PER_MIN = 10, RATE_BACKOFF_MS = 15000;
const keyOf = (artist, song) => norm(artist) + '|' + norm(song);
const mem = new Map(); // key -> { ms } for answers in this session (and old-cache hits)
const recent = [];
let queue = [], busy = false, listeners = new Set();

/** { ms } if the length is known or known to be unavailable, else null (not looked up yet). */
function read(artist, song) {
  const k = keyOf(artist, song);
  if (mem.has(k)) return mem.get(k);
  const c = cachedLookup(artist, song, { needMs: true });
  if (c) { const v = { ms: c.ms || null }; mem.set(k, v); return v; }
  let old = null;
  try { old = JSON.parse(localStorage.getItem(OLD_PREFIX + k)); } catch { old = null; }
  if (old?.ms && Date.now() - old.t < OLD_HIT_DAYS * 864e5) { const v = { ms: old.ms }; mem.set(k, v); return v; }
  return null;
}

/** Known length in ms, or null (unknown / not looked up yet). */
export function durationOf(artist, song) {
  return read(artist, song)?.ms || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const now = Date.now();
    while (recent.length && now - recent[0] > 60000) recent.shift();
    if (recent.length >= PER_MIN) { await sleep(60000 - (now - recent[0]) + 50); continue; }
    const job = queue.shift();
    if (read(job.artist, job.song)) continue;
    recent.push(Date.now());
    try {
      const hit = await lookup(job.artist, job.song, { needMs: true });
      const ms = hit?.ms || null;
      mem.set(keyOf(job.artist, job.song), { ms });
      listeners.forEach((fn) => fn(keyOf(job.artist, job.song), ms));
    } catch (e) {
      // The previews used up the shared budget: put the song back and retry later. Other errors
      // (offline, http) keep the 4-minute guess.
      if (e.message === 'rate') { queue.unshift(job); await sleep(RATE_BACKOFF_MS); continue; }
    }
    if (queue.length) await sleep(GAP_MS);
  }
  busy = false;
}

/** Look up lengths for songs not cached yet; onUpdate(key, ms) fires per answer. */
export function want(songs) {
  for (const s of songs) {
    const k = keyOf(s.artist, s.song);
    if (read(s.artist, s.song) || queue.some((j) => keyOf(j.artist, j.song) === k)) continue;
    queue.push(s);
  }
  pump();
}
export function onDuration(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function cancel() { queue = []; }

export const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
