// Piticu Wrapped: every number on the story, computed live from the db (nothing hardcoded).
// year = null for the whole archive, or a 4-digit year for a per-year Wrapped.
import * as D from '../../data.js';

const lastOf = (a) => a[a.length - 1];
const isMonday = (e) => new Date(D.parseDate(e.date)).getUTCDay() === 1;

/** Consecutive regular shows (at most a week apart) that shared a song. */
function repeats(db, year) {
  const reg = db.aired.filter((e) => e.regular);
  const out = [];
  for (let i = 1; i < reg.length; i++) {
    const a = reg[i - 1], b = reg[i];
    if (year != null && b.year !== year) continue;
    if (D.daysBetween(a.date, b.date) > 7) continue;
    const prev = new Set(a.tracks.map((p) => p.song));
    for (const p of b.tracks) if (prev.has(p.song)) out.push({ song: p.song, from: a, to: b });
  }
  return out;
}

/** Longest gap between two consecutive plays of a song, optionally only gaps that end in `year`. */
function longestComeback(db, year) {
  let best = null;
  for (const s of db.songs.values()) {
    for (let i = 1; i < s.plays.length; i++) {
      const from = s.plays[i - 1].ep, to = s.plays[i].ep;
      if (year != null && to.year !== year) continue;
      const days = D.daysBetween(from.date, to.date);
      if (!best || days > best.days) best = { song: s, from, to, days };
    }
  }
  return best;
}

/** Longest run of consecutive regular shows with Depeche Mode, within `eps`. */
function longestRun(eps) {
  let best = 0, run = 0;
  for (const e of eps) { if (e.tracks.some((p) => D.isDM(p.artist))) best = Math.max(best, ++run); else run = 0; }
  return best;
}

/** Cumulative plays per artist, sampled at each step (years, or months in year mode). */
function race(db, year) {
  const plays = D.filterPlays(db, { year });
  const keyOf = year == null ? (p) => String(p.ep.year) : (p) => p.ep.date.slice(0, 7);
  const stepKeys = [...new Set(plays.map(keyOf))];
  const cum = new Map();
  const steps = [];
  let j = 0;
  for (const k of stepKeys) {
    while (j < plays.length && keyOf(plays[j]) === k) { cum.set(plays[j].artist, (cum.get(plays[j].artist) || 0) + 1); j++; }
    steps.push({ key: k, values: new Map(cum) });
  }
  // Candidates: anyone who was top 5 at some step (so overtakes are visible), capped at 9.
  const cand = new Set();
  for (const s of steps) {
    [...s.values].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([a]) => cand.add(a));
  }
  // Final order = the app's ranking (same tie-break as topArtists), so the race ends where the charts do.
  const order = new Map(D.topArtists(db, { year }, 0).map((r, i) => [r.artist, i]));
  const artists = [...cand].sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9)).slice(0, 9);
  return {
    artists,
    steps: steps.map((s) => ({ key: s.key, values: artists.map((a) => s.values.get(a) || 0) })),
  };
}

export function wrappedStats(db, year = null) {
  const all = year == null;
  const aired = all ? db.aired : db.aired.filter((e) => e.year === year);
  if (!aired.length) return null;
  const regular = aired.filter((e) => e.regular);
  const plays = aired.flatMap((e) => e.tracks);
  const songsSet = new Set(plays.map((p) => p.song));
  const artistsSet = new Set(plays.map((p) => p.artist));
  const t = D.totals(db);
  const cd = D.countdown(db, 400);
  const first = aired[0], last = lastOf(aired);

  // Depeche Mode
  const dmT = D.dmTracker(db);
  const dmPlays = plays.filter((p) => D.isDM(p.artist));
  const dmReg = dmPlays.filter((p) => p.ep.regular);
  const slots = new Map();
  for (const p of dmReg) slots.set(p.slot, (slots.get(p.slot) || 0) + 1);
  const maxSlot = Math.min(14, Math.max(0, ...regular.map((e) => e.tracks.length)));
  const slotList = Array.from({ length: maxSlot }, (_, i) => ({ slot: i + 1, n: slots.get(i + 1) || 0 }));
  const home = slotList.reduce((m, s) => (s.n > m.n ? s : m), { slot: 0, n: -1 });
  const withDM = regular.filter((e) => e.tracks.some((p) => D.isDM(p.artist))).length;
  const dm = {
    artist: dmT.artist,
    plays: dmPlays.length, share: plays.length ? dmPlays.length / plays.length : 0,
    streak: all ? dmT.current : longestRun(regular), streakRange: all ? dmT.currentRange : null,
    record: dmT.longest.len, withDM, regular: regular.length,
    home, openers: slots.get(1) || 0, slots: slotList,
  };

  // Rankings (app default: regular shows, Depeche Mode included)
  const opts = { year };
  const topSongs = D.topSongs(db, opts, 5);
  const topArtists = D.topArtists(db, opts, 5);
  const oc = D.openersClosers(db, opts);

  // Freshness
  const fr = D.freshness(db);
  const freshYear = all ? lastOf(fr.perYear) : fr.perYear.find((r) => r.year === year);

  // Played once (whole-archive count of 1, within this period)
  const once = [...songsSet].filter((s) => s.plays.length === 1);
  const debuts = plays.filter((p) => p.debut).length;

  // Busiest
  const perYear = db.years.map((y) => {
    const eps = db.aired.filter((e) => e.year === y);
    return { year: y, plays: eps.reduce((s, e) => s + e.tracks.length, 0), episodes: eps.length };
  });
  const busiest = perYear.reduce((m, r) => (r.plays > m.plays ? r : m));
  const longestNight = aired.reduce((m, e) => (e.tracks.length > m.tracks.length ? e : m));

  // Countdown dates for the remaining Mondays
  const lastReg = lastOf(db.aired.filter((e) => e.regular));
  const upcoming = Array.from({ length: Math.min(cd.left, 16) }, (_, i) => {
    const n = cd.latest.n + i + 1;
    return { n, date: D.addDays(lastReg.date, 7 * (n - lastReg.n)) };
  });

  return {
    year, all, years: db.years, first, last,
    span: { years: Math.max(1, Math.floor(D.daysBetween(first.date, last.date) / 365.25)), from: first.year, to: last.year },
    episodes: aired.length, regular: regular.length, specials: aired.filter((e) => !e.regular),
    nonMonday: aired.filter((e) => !isMonday(e)),
    plays: plays.length, songs: songsSet.size, artists: artistsSet.size, debuts,
    newArtists: [...artistsSet].filter((a) => a.plays[0].ep.year === year).length,
    archive: { first: t.first, last: t.last, plays: t.plays, songs: t.songs, artists: t.artists, episodes: t.episodes },
    countdown: { ...cd, upcoming },
    dm, topSongs, topArtists,
    openers: oc.openers, closers: oc.closers,
    freshness: { perYear: fr.perYear, focus: freshYear, zero: fr.zero.filter((e) => all || e.year === year) },
    once: { n: once.length, of: songsSet.size, share: songsSet.size ? once.length / songsSet.size : 0 },
    comeback: longestComeback(db, year),
    repeats: repeats(db, year), regularTotal: db.aired.filter((e) => e.regular).length,
    perYear, busiest, longestNight,
    perEpisode: aired.map((e) => ({ ep: e, n: e.tracks.length })),
    race: race(db, year),
  };
}
