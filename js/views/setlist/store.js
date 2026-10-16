// Set builder: persistence (localStorage, with an in-memory fallback), share-link encoding and
// the "01. artist - song" text export. No DOM rendering here.
import { norm } from '../../data.js';

const LS_KEY = 'pd:setlist:v1';
export const DEFAULT_NAME = '#400';
export const TARGET_SONGS = 12;
export const TARGET_MIN = 60;
export const DEFAULT_SONG_SEC = 240;

export const uid = () => Math.random().toString(36).slice(2, 9);

let memory = null; // used when storage is blocked (private mode, previews)

function blank() {
  const id = uid();
  return { cur: id, sets: [{ id, name: DEFAULT_NAME, items: [], air: null, upd: Date.now() }] };
}

function valid(st) {
  return st && Array.isArray(st.sets) && st.sets.length && st.sets.every((s) => s && s.id && Array.isArray(s.items));
}

export function load() {
  let st = null;
  try { st = JSON.parse(localStorage.getItem(LS_KEY)); } catch { st = null; }
  if (!valid(st)) st = memory && valid(memory) ? memory : blank();
  if (!st.sets.some((s) => s.id === st.cur)) st.cur = st.sets[0].id;
  memory = st;
  return st;
}

export function save(st) {
  memory = st;
  const s = st.sets.find((x) => x.id === st.cur);
  if (s) s.upd = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(st)); return true; } catch { return false; }
}

export const current = (st) => st.sets.find((s) => s.id === st.cur) || st.sets[0];

export function newSet(st, name, items = []) {
  const taken = new Set(st.sets.map((s) => s.name));
  let n = name || 'New set', i = 2;
  const base = n;
  while (taken.has(n)) n = `${base} (${i++})`;
  const set = { id: uid(), name: n, items: items.map((it) => ({ ...it, id: uid() })), air: null, upd: Date.now() };
  st.sets.push(set);
  st.cur = set.id;
  return set;
}

export function deleteSet(st, id) {
  st.sets = st.sets.filter((s) => s.id !== id);
  if (!st.sets.length) { const b = blank(); st.sets = b.sets; st.cur = b.cur; }
  if (!st.sets.some((s) => s.id === st.cur)) st.cur = st.sets[0].id;
}

// ---------------------------------------------------------------- resolving items
/** Archive key for an "artist - song" pair, if that song is in the archive. */
export function findSong(db, artist, title) {
  return db.songs.get(norm(artist) + '|' + norm(title)) || null;
}

/** item = { id, k } (archive song key) or { id, a, t } (free text). Returns a view model. */
export function resolve(db, item) {
  let song = item.k ? db.songs.get(item.k) : null;
  if (!song && item.a) song = findSong(db, item.a, item.t);
  if (song) return { item, song, artist: song.artist.name, title: song.title, inArchive: true, key: song.key };
  const artist = item.a || 'Unknown artist', title = item.t || 'Unknown song';
  return { item, song: null, artist, title, inArchive: false, key: norm(artist) + '|' + norm(title) };
}

/** "Artist – Song" free text, split on the first spaced dash. */
export function parseFree(q) {
  const m = String(q).trim().match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (!m) return null;
  const a = m[1].trim(), t = m[2].trim();
  return a && t ? { a, t } : null;
}

// ---------------------------------------------------------------- share link
// Archive songs are 3 base-36 chars: 2 for the episode number of their first play, 1 for its slot.
// Free-text songs are "*" (older links: "~") + base64url("artist\u0001song"). Tokens are joined with ".".
const b64e = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export function encode(db, items) {
  return items.map((it) => {
    const r = resolve(db, it);
    if (r.song) {
      const p = r.song.plays[0];
      if (p.ep.n < 1296 && p.slot < 36) return p.ep.n.toString(36).padStart(2, '0') + p.slot.toString(36);
    }
    return '*' + b64e(`${r.artist}\u0001${r.title}`);
  }).join('.');
}

export function decode(db, s) {
  const out = [];
  for (const tok of String(s || '').split('.').filter(Boolean)) {
    try {
      if (tok[0] === '*' || tok[0] === '~') {
        const [a, t] = b64d(tok.slice(1)).split('\u0001');
        if (a && t) { const song = findSong(db, a, t); out.push(song ? { k: song.key } : { a, t }); }
      } else if (/^[0-9a-z]{3}$/.test(tok)) {
        const ep = db.byN.get(parseInt(tok.slice(0, 2), 36));
        const play = ep?.tracks[parseInt(tok[2], 36) - 1];
        if (play) out.push({ k: play.song.key });
      }
    } catch { /* skip a broken token */ }
  }
  return out;
}

export function shareUrl(db, set) {
  const q = new URLSearchParams({ s: encode(db, set.items), n: set.name });
  return `${location.origin}${location.pathname}#/setlist?${q}`;
}

// ---------------------------------------------------------------- text export
/** Same shape as Dan's Facebook posts, so add_episode.py can parse it later. */
export function asText(db, set) {
  const m = set.name.match(/#\s*(\d+)/);
  const head = `Piticu Dejun #${m ? m[1] : '400'}`;
  const lines = set.items.map((it, i) => {
    const r = resolve(db, it);
    return `${String(i + 1).padStart(2, '0')}. ${r.artist} - ${r.title}`;
  });
  return [head, '', ...lines].join('\n');
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.append(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
