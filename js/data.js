// Pure data layer: normalisation, aliases, indexes and stats.
// No DOM access here, so Node can import it (see tests/check_stats.mjs).

export const DM_KEY = 'depeche mode';
export const FIRST_MONDAY = '2020-04-13';
const DAY = 86400000;

// ---------------------------------------------------------------- normalisation
const CHAR_MAP = { ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ı: 'i', ð: 'd', þ: 'th' };

/** Grouping key, close to MySQL's accent- and case-insensitive collation:
 *  NFKD, strip accents, curly to straight quotes, lowercase, collapse spaces. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[øæœßłđıðþ]/g, (c) => CHAR_MAP[c])
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** URL-safe slug from a string (already-normalised keys give stable slugs). */
export function slugify(s) {
  return norm(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

/** Compile data/aliases.json into normalised lookup maps. */
export function compileAliases(aliases = {}) {
  const artists = new Map();
  const songs = new Map();
  for (const [from, to] of Object.entries(aliases.artists || {})) artists.set(norm(from), to);
  for (const [key, to] of Object.entries(aliases.songs || {})) {
    const i = key.lastIndexOf('|');
    if (i < 0) continue;
    const artist = key.slice(0, i);
    const canonArtist = artists.get(norm(artist)) ?? artist;
    songs.set(norm(canonArtist) + '|' + norm(key.slice(i + 1)), to);
  }
  return {
    artist: (raw) => artists.get(norm(raw)) ?? raw,
    song: (artistKey, raw) => songs.get(artistKey + '|' + norm(raw)) ?? raw,
  };
}

// ---------------------------------------------------------------- dates
export const parseDate = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const isoDate = (t) => new Date(t).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY);
export const addDays = (iso, n) => isoDate(parseDate(iso) + n * DAY);
/** Monday (ISO date) of the week containing iso. */
export function mondayOf(iso) {
  const t = parseDate(iso);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // 0 = Monday
  return isoDate(t - dow * DAY);
}

// ---------------------------------------------------------------- helpers
function bump(map, key, by = 1) { map.set(key, (map.get(key) || 0) + by); }
function mostCommon(counter) {
  let best = null, n = -1;
  for (const [k, v] of counter) if (v > n) { best = k; n = v; }
  return best;
}
/** Competition ranking (1, 2, 2, 4) over an array already sorted by `n` desc. */
export function withRanks(items, value = (x) => x.n) {
  let rank = 0, prev = null;
  return items.map((it, i) => {
    const v = value(it);
    if (v !== prev) { rank = i + 1; prev = v; }
    return { ...it, rank };
  });
}
function uniqueSlug(used, base) {
  let s = base, i = 2;
  while (used.has(s)) s = `${base}-${i++}`;
  used.add(s);
  return s;
}

// ---------------------------------------------------------------- index
/**
 * Build the in-memory database from shows.json (+ aliases.json).
 * Every play is counted once per (episode, artist, song).
 */
export function buildDB(shows, aliasData = {}) {
  const alias = compileAliases(aliasData);
  const episodes = [...shows.episodes].sort((a, b) => a.n - b.n).map((e) => ({
    n: e.n, date: e.date, special: e.special || null, note: e.note || null, src: e.src || null,
    year: +e.date.slice(0, 4), regular: !e.special, tracks: [],
  }));
  const artists = new Map();
  const songs = new Map();
  const plays = [];
  const artistLabels = new Map();
  const songLabels = new Map();
  const artistSlugs = new Set();
  const raw = new Map(shows.episodes.map((e) => [e.n, e.tracks || []]));

  for (const ep of episodes) {
    const seen = new Set();
    for (const [rawArtist, rawSong] of raw.get(ep.n)) {
      const artistName = alias.artist(rawArtist);
      const artistKey = norm(artistName);
      const songName = alias.song(artistKey, rawSong);
      const songKey = artistKey + '|' + norm(songName);
      if (seen.has(songKey)) continue;
      seen.add(songKey);

      let artist = artists.get(artistKey);
      if (!artist) {
        artist = { key: artistKey, slug: uniqueSlug(artistSlugs, slugify(artistKey)), name: artistName, plays: [], songs: [] };
        artist.songSlugs = new Set();
        artists.set(artistKey, artist);
        artistLabels.set(artistKey, new Map());
      }
      bump(artistLabels.get(artistKey), artistName);

      let song = songs.get(songKey);
      if (!song) {
        song = { key: songKey, slug: uniqueSlug(artist.songSlugs, slugify(songKey.slice(artistKey.length + 1))), title: songName, artist, plays: [] };
        songs.set(songKey, song);
        artist.songs.push(song);
        songLabels.set(songKey, new Map());
      }
      bump(songLabels.get(songKey), songName);

      const play = { ep, song, artist, slot: ep.tracks.length + 1, last: false, debut: song.plays.length === 0 };
      ep.tracks.push(play);
      song.plays.push(play);
      artist.plays.push(play);
      plays.push(play);
    }
    if (ep.tracks.length) ep.tracks[ep.tracks.length - 1].last = true;
  }
  for (const [k, a] of artists) { a.name = mostCommon(artistLabels.get(k)); delete a.songSlugs; }
  for (const [k, s] of songs) s.title = mostCommon(songLabels.get(k));

  const aired = episodes.filter((e) => e.tracks.length);
  const db = {
    show: shows.show, generated: shows.generated, sources: shows.sources || {},
    episodes, aired, artists, songs, plays,
    years: [...new Set(aired.map((e) => e.year))].sort(),
    byN: new Map(episodes.map((e) => [e.n, e])),
    artistBySlug: new Map([...artists.values()].map((a) => [a.slug, a])),
  };
  return db;
}

export const episode = (db, n) => db.byN.get(+n) || null;
export const artistBySlug = (db, slug) => db.artistBySlug.get(slug) || null;
export const songBySlug = (db, artistSlug, songSlug) =>
  artistBySlug(db, artistSlug)?.songs.find((s) => s.slug === songSlug) || null;
export const isDM = (artist) => artist.key === DM_KEY;

// ---------------------------------------------------------------- filters
/**
 * opts: { specials = false (include special episodes), dmAside = false (hide Depeche Mode),
 *         year = null, from = null, to = null (episode numbers) }
 */
export function filterPlays(db, opts = {}) {
  const { specials = false, dmAside = false, year = null, from = null, to = null } = opts;
  return db.plays.filter((p) =>
    (specials || p.ep.regular) && (!dmAside || !isDM(p.artist)) &&
    (year == null || p.ep.year === +year) && (from == null || p.ep.n >= from) && (to == null || p.ep.n <= to));
}

function lastOf(list) { return list[list.length - 1]; }

/** Top songs: [{ song, n, first, last, rank }] sorted by plays desc, then most recent. */
export function topSongs(db, opts = {}, limit = 50) {
  const by = new Map();
  for (const p of filterPlays(db, opts)) {
    const o = by.get(p.song) || by.set(p.song, { song: p.song, n: 0, first: p.ep, last: p.ep }).get(p.song);
    o.n++; o.last = p.ep;
  }
  const list = [...by.values()].sort((a, b) => b.n - a.n || b.last.n - a.last.n);
  return withRanks(limit ? list.slice(0, limit) : list);
}

/** Top artists: [{ artist, n, songs, episodes, rank }]. */
export function topArtists(db, opts = {}, limit = 50) {
  const by = new Map();
  for (const p of filterPlays(db, opts)) {
    let o = by.get(p.artist);
    if (!o) by.set(p.artist, (o = { artist: p.artist, n: 0, songSet: new Set(), epSet: new Set(), last: p.ep }));
    o.n++; o.songSet.add(p.song); o.epSet.add(p.ep); o.last = p.ep;
  }
  const list = [...by.values()]
    .map(({ songSet, epSet, ...o }) => ({ ...o, songs: songSet.size, episodes: epSet.size }))
    .sort((a, b) => b.n - a.n || b.songs - a.songs || b.last.n - a.last.n);
  return withRanks(limit ? list.slice(0, limit) : list);
}

// ---------------------------------------------------------------- totals
export function totals(db) {
  const aired = db.aired;
  const regular = aired.filter((e) => e.regular);
  const first = aired[0], last = lastOf(aired);
  const nums = new Set(db.episodes.map((e) => e.n));
  let missing = 0;
  for (let n = first.n; n <= last.n; n++) if (!nums.has(n)) missing++;
  const regPlays = regular.reduce((s, e) => s + e.tracks.length, 0);
  return {
    episodes: aired.length, regular: regular.length, specials: aired.length - regular.length,
    plays: db.plays.length, artists: db.artists.size, songs: db.songs.size,
    first, last, missing, avgTracks: regPlays / regular.length,
    oneTimeSongs: [...db.songs.values()].filter((s) => s.plays.length === 1).length,
    oneTimeArtists: [...db.artists.values()].filter((a) => a.plays.length === 1).length,
  };
}

/** Countdown to a milestone episode, assuming one show per week after the latest regular one. */
export function countdown(db, target = 400) {
  const lastReg = lastOf(db.aired.filter((e) => e.regular));
  const latest = lastOf(db.aired);
  const left = Math.max(0, target - latest.n);
  const date = addDays(lastReg.date, 7 * (target - lastReg.n));
  return { target, latest, left, date, progress: Math.min(1, latest.n / target) };
}

// ---------------------------------------------------------------- song / artist
export function songStats(song) {
  const plays = song.plays;
  let gap = null;
  for (let i = 1; i < plays.length; i++) {
    const d = daysBetween(plays[i - 1].ep.date, plays[i].ep.date);
    if (!gap || d > gap.days) gap = { days: d, from: plays[i - 1].ep, to: plays[i].ep };
  }
  const slots = new Map();
  for (const p of plays) bump(slots, p.slot);
  return {
    n: plays.length, first: plays[0].ep, last: lastOf(plays).ep, gap,
    openers: plays.filter((p) => p.slot === 1).length,
    closers: plays.filter((p) => p.last).length,
    specials: plays.filter((p) => !p.ep.regular).length,
    slots,
  };
}

export function artistStats(db, artist) {
  const plays = artist.plays;
  const perYear = new Map(db.years.map((y) => [y, 0]));
  for (const p of plays) bump(perYear, p.ep.year);
  const songs = artist.songs
    .map((s) => ({ song: s, n: s.plays.length, last: lastOf(s.plays).ep }))
    .sort((a, b) => b.n - a.n || b.last.n - a.last.n);
  const eps = [...new Set(plays.map((p) => p.ep))];
  return {
    n: plays.length, songs: withRanks(songs), episodes: eps,
    first: plays[0].ep, last: lastOf(plays).ep, perYear: [...perYear].map(([year, n]) => ({ year, n })),
    share: plays.length / db.plays.length,
  };
}

// ---------------------------------------------------------------- Depeche Mode
export function dmTracker(db) {
  const regular = db.aired.filter((e) => e.regular);
  const has = (e) => e.tracks.some((p) => p.artist.key === DM_KEY);
  let current = 0;
  for (let i = regular.length - 1; i >= 0 && has(regular[i]); i--) current++;
  const currentRange = current ? { from: regular[regular.length - current], to: lastOf(regular) } : null;
  let best = { len: 0 }, run = 0, start = null;
  for (const e of regular) {
    if (has(e)) { if (!run) start = e; run++; if (run > best.len) best = { len: run, from: start, to: e }; }
    else run = 0;
  }
  const dmPlays = db.plays.filter((p) => p.artist.key === DM_KEY);
  const regPlays = dmPlays.filter((p) => p.ep.regular);
  const maxSlot = Math.max(...regular.map((e) => e.tracks.length));
  const slots = Array.from({ length: maxSlot }, (_, i) => ({ slot: i + 1, n: 0 }));
  for (const p of regPlays) slots[p.slot - 1].n++;
  const perYear = db.years.map((y) => {
    const eps = regular.filter((e) => e.year === y);
    return { year: y, episodes: eps.length, withDM: eps.filter(has).length, plays: regPlays.filter((p) => p.ep.year === y).length };
  });
  const artist = db.artists.get(DM_KEY);
  return {
    artist, current, currentRange, longest: best,
    episodesWith: regular.filter(has).length, regularEpisodes: regular.length,
    withoutDM: regular.filter((e) => !has(e)),
    plays: dmPlays.length, regularPlays: regPlays.length, share: dmPlays.length / db.plays.length,
    slots, perYear,
    songs: artist ? artistStats(db, artist).songs : [],
  };
}

// ---------------------------------------------------------------- calendar & freshness
/** One cell per Monday since 2020-04-13, grouped by year; col = Monday index within the year. */
export function heatmap(db, until = null) {
  const byWeek = new Map();
  for (const e of db.aired) byWeek.set(mondayOf(e.date), e);
  const end = mondayOf(until || lastOf(db.aired).date);
  const years = new Map();
  for (let d = FIRST_MONDAY; d <= end; d = addDays(d, 7)) {
    const y = +d.slice(0, 4);
    const firstMonday = mondayOf(`${y}-01-07`);
    const col = Math.round(daysBetween(firstMonday, d) / 7);
    if (!years.has(y)) years.set(y, []);
    years.get(y).push({ monday: d, col, ep: byWeek.get(d) || null });
  }
  const max = Math.max(...db.aired.map((e) => e.tracks.length));
  return { max, years: [...years].map(([year, cells]) => ({ year, cells })) };
}

/** Share of plays that were a song's first-ever appearance (across all archived episodes). */
export function freshness(db) {
  const perEpisode = db.aired.map((e) => {
    const debuts = e.tracks.filter((p) => p.debut).length;
    return { ep: e, debuts, plays: e.tracks.length, pct: debuts / e.tracks.length };
  });
  const perYear = db.years.map((year) => {
    const rows = perEpisode.filter((r) => r.ep.year === year);
    const plays = rows.reduce((s, r) => s + r.plays, 0);
    const debuts = rows.reduce((s, r) => s + r.debuts, 0);
    return { year, plays, debuts, pct: debuts / plays, episodes: rows.length };
  });
  return { perEpisode, perYear, zero: perEpisode.filter((r) => r.ep.regular && r.debuts === 0).map((r) => r.ep) };
}

// ---------------------------------------------------------------- slots & comebacks
export function openersClosers(db, opts = {}) {
  const eps = db.aired.filter((e) => (opts.specials || e.regular) && (opts.year == null || e.year === +opts.year));
  const count = (pick) => {
    const bySong = new Map(), byArtist = new Map();
    for (const e of eps) {
      const p = pick(e);
      if (!p || (opts.dmAside && isDM(p.artist))) continue;
      bump(bySong, p.song); bump(byArtist, p.artist);
    }
    const sort = (m, k) => withRanks([...m].map(([x, n]) => ({ [k]: x, n })).sort((a, b) => b.n - a.n));
    return { songs: sort(bySong, 'song'), artists: sort(byArtist, 'artist') };
  };
  return { openers: count((e) => e.tracks[0]), closers: count((e) => lastOf(e.tracks)), episodes: eps.length };
}

/** Longest gaps between two consecutive plays of the same song (one entry per song). */
export function comebacks(db, limit = 20) {
  const out = [];
  for (const s of db.songs.values()) {
    const g = s.plays.length > 1 ? songStats(s).gap : null;
    if (g) out.push({ song: s, ...g });
  }
  return out.sort((a, b) => b.days - a.days).slice(0, limit);
}

/** Staples (>= minPlays) that have not been played for the longest time. */
export function forgotten(db, minPlays = 6, limit = 10) {
  const latest = lastOf(db.aired);
  return [...db.songs.values()]
    .filter((s) => s.plays.length >= minPlays)
    .map((s) => ({ song: s, n: s.plays.length, last: lastOf(s.plays).ep, days: daysBetween(lastOf(s.plays).ep.date, latest.date) }))
    .sort((a, b) => b.days - a.days).slice(0, limit);
}

// ---------------------------------------------------------------- on this day / years
/** Episodes that aired within ±window days of today's month-day in earlier years. */
export function onThisDay(db, todayIso, window = 3) {
  const y = +todayIso.slice(0, 4);
  const out = [];
  for (let back = 1; back <= y - 2020; back++) {
    const target = `${y - back}${todayIso.slice(4)}`;
    let best = null;
    for (const e of db.aired) {
      const d = Math.abs(daysBetween(target, e.date));
      if (d <= window && (!best || d < best.d)) best = { ep: e, d, yearsAgo: back };
    }
    if (best) out.push(best);
  }
  return out;
}

export function yearStats(db, year, opts = {}) {
  year = +year;
  const eps = db.aired.filter((e) => e.year === year);
  const fr = freshness(db).perYear.find((r) => r.year === year);
  const plays = eps.reduce((s, e) => s + e.tracks.length, 0);
  const debutSongs = eps.flatMap((e) => e.tracks.filter((p) => p.debut));
  const artistsDebut = new Set();
  for (const a of db.artists.values()) if (a.plays[0].ep.year === year) artistsDebut.add(a);
  return {
    year, episodes: eps, plays, specials: eps.filter((e) => !e.regular).length,
    freshness: fr, debuts: debutSongs.length, newArtists: artistsDebut.size,
    topSongs: topSongs(db, { ...opts, year }, 10),
    topArtists: topArtists(db, { ...opts, year }, 10),
    longest: eps.reduce((m, e) => (!m || e.tracks.length > m.tracks.length ? e : m), null),
  };
}

// ---------------------------------------------------------------- search
/** Search songs, artists and episodes. Every query token must match (accent/case-insensitive). */
export function search(db, q, limits = { songs: 30, artists: 12, episodes: 8 }) {
  const query = norm(q);
  if (!query) return { songs: [], artists: [], episodes: [] };
  const tokens = query.split(' ');
  const matchAll = (hay) => tokens.every((t) => hay.includes(t));
  const score = (name, n) => n + (norm(name).startsWith(query) ? 1000 : 0) + (norm(name) === query ? 5000 : 0);

  const artists = [...db.artists.values()]
    .filter((a) => matchAll(a.key))
    .map((a) => ({ artist: a, n: a.plays.length, s: score(a.name, a.plays.length) }))
    .sort((x, y) => y.s - x.s).slice(0, limits.artists);

  const songs = [...db.songs.values()]
    .filter((s) => matchAll(s.key.replace('|', ' ')))
    .map((s) => ({ song: s, n: s.plays.length, last: lastOf(s.plays).ep, s: score(s.title, s.plays.length) }))
    .sort((x, y) => y.s - x.s || y.last.n - x.last.n).slice(0, limits.songs);

  let episodes = [];
  const num = query.match(/^#?\s*(\d{1,3})$/);
  if (num) { const e = episode(db, num[1]); if (e) episodes = [e]; }
  else if (/^\d{4}(-\d{2}){0,2}$/.test(query)) episodes = db.aired.filter((e) => e.date.startsWith(query)).slice(0, limits.episodes);
  else episodes = db.aired.filter((e) => e.special && matchAll(norm(e.special))).slice(0, limits.episodes);
  return { songs, artists, episodes };
}
