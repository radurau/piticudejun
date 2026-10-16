// Set builder smarts: per-song warnings, the Depeche Mode slot, and suggestions.
import * as D from '../../data.js';
import { plural } from '../../ui.js';

const RECENT_EPS = 10, HOT_EPS = 4, STAPLE = 8;

/** Precomputed context for one render. */
export function context(db) {
  const recent = db.aired.slice(-RECENT_EPS);
  const recentIdx = new Map(recent.map((e, i) => [e.n, recent.length - i])); // 1 = latest show
  const dm = D.dmTracker(db);
  const top = dm.slots.reduce((m, s) => (s.n > m.n ? s : m), { slot: 8, n: 0 });
  return {
    db, today: D.isoDate(Date.now()), recentIdx, latest: db.aired.at(-1),
    dm, dmSlot: top.slot, dmSlotShare: dm.regularPlays ? top.n / dm.regularPlays : 0,
    countdown: D.countdown(db, 400),
  };
}

const isDMName = (artist) => D.norm(artist) === D.DM_KEY;

/** Badges for one resolved row: [{ tone, text }]. `rows` = the whole resolved set (for duplicates). */
export function badges(cx, r, rows) {
  const out = [];
  if (!r.inArchive) out.push({ tone: 'new', text: 'Never played on the show' });
  else {
    const last = r.song.plays.at(-1).ep;
    const back = cx.recentIdx.get(last.n);
    if (back) {
      const weeks = Math.max(1, Math.round(D.daysBetween(last.date, cx.today) / 7));
      out.push({ tone: back <= HOT_EPS ? 'red' : 'warn', text: `Played ${weeks === 1 ? 'last week' : `${weeks} weeks ago`} (#${last.n})` });
    }
    const n = r.song.plays.length;
    if (n >= STAPLE) out.push({ tone: 'staple', text: `A show staple — played ${n} times` });
  }
  const artistKey = D.norm(r.artist);
  const same = rows.filter((x) => D.norm(x.artist) === artistKey).length;
  if (same > 1 && !isDMName(r.artist)) out.push({ tone: 'plain', text: same === 2 ? `${r.artist} twice in the set` : `${same}× ${r.artist} in the set` });
  if (same > 1 && isDMName(r.artist)) out.push({ tone: 'plain', text: `${same} Depeche Mode songs` });
  return out;
}

/** Set-level Depeche Mode hint: { kind: 'missing'|'move'|'ok', at } */
export function dmHint(cx, rows) {
  const at = rows.findIndex((r) => isDMName(r.artist));
  if (at < 0) return { kind: 'missing' };
  if (at + 1 !== cx.dmSlot && rows.length >= cx.dmSlot) return { kind: 'move', at };
  return { kind: 'ok', at };
}

const lastEp = (s) => s.plays.at(-1).ep;

/** DM songs worth suggesting: well-loved, not heard in the last 10 shows. */
export function dmPicks(cx, inSet, limit = 3) {
  return cx.dm.songs
    .filter((x) => !inSet.has(x.song.key) && !cx.recentIdx.has(x.last.n))
    .slice(0, limit).map((x) => x.song);
}

export function gems(cx, inSet, limit = 5) {
  return D.forgotten(cx.db, 6, 60).filter((x) => !inSet.has(x.song.key)).slice(0, limit)
    .map((x) => ({ song: x.song, meta: `${plural(x.n, 'play')} · not since #${x.last.n}, ${humanAgo(x.days)}` }));
}

export function favourites(cx, inSet, limit = 5) {
  return D.topSongs(cx.db, { dmAside: true }, 120)
    .filter((x) => !inSet.has(x.song.key) && !cx.recentIdx.has(x.last.n)).slice(0, limit)
    .map((x) => ({ song: x.song, meta: `#${x.rank} all-time · ${plural(x.n, 'play')} · last #${x.last.n}` }));
}

/** A random archive song, weighted toward the ones not played for a while. */
export function surprise(cx, inSet, avoid = null) {
  const pool = [];
  let total = 0;
  for (const s of cx.db.songs.values()) {
    if (inSet.has(s.key) || s.key === avoid) continue;
    const ep = lastEp(s);
    if (cx.recentIdx.has(ep.n)) continue;
    const days = Math.max(7, D.daysBetween(ep.date, cx.latest.date));
    const w = Math.pow(days, 1.5) * (1 + Math.min(s.plays.length, 6) * 0.15);
    total += w;
    pool.push([s, total]);
  }
  if (!pool.length) return null;
  const r = Math.random() * total;
  const s = pool.find(([, c]) => c >= r)?.[0] || pool.at(-1)[0];
  const days = D.daysBetween(lastEp(s).date, cx.latest.date);
  return { song: s, meta: `${plural(s.plays.length, 'play')} · last #${lastEp(s).n}, ${humanAgo(days)}` };
}

function humanAgo(days) {
  if (days < 60) return `${Math.max(1, Math.round(days / 7))} weeks ago`;
  if (days < 700) return `${Math.round(days / 30.44)} months ago`;
  return `${(days / 365.25).toFixed(1)} years ago`;
}
