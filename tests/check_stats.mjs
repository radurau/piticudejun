// Compare js/data.js against SQL truth (tests/fixture.json, from tests/make_fixture.py).
//   node tests/check_stats.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as D from '../js/data.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const shows = read('../data/shows.json');
const db = D.buildDB(shows, read('../data/aliases.json'));
const F = read('./fixture.json');
let pass = 0;
const check = (name, fn) => { try { fn(); pass++; console.log(`ok   ${name}`); } catch (e) { console.log(`FAIL ${name}\n     ${e.message.split('\n').slice(0, 6).join('\n     ')}`); process.exitCode = 1; } };

const t = D.totals(db);
check('total plays', () => assert.equal(t.plays, F.plays));
check('archived episodes', () => assert.equal(t.episodes, F.episodes));
check('regular episodes', () => assert.equal(t.regular, F.regular_episodes));
check('distinct artists (after aliases)', () => assert.equal(t.artists, F.artists));
check('distinct songs (after aliases)', () => assert.equal(t.songs, F.songs));
check('artists played once', () => assert.equal(t.oneTimeArtists, F.artists_played_once));
check('songs played once', () => assert.equal(t.oneTimeSongs, F.songs_played_once));
check('plays per year (all shows)', () => {
  for (const [y, n] of Object.entries(F.plays_per_year)) assert.equal(D.filterPlays(db, { specials: true, year: +y }).length, n, `year ${y}`);
});
check('plays per year (regular shows)', () => {
  for (const [y, n] of Object.entries(F.regular_plays_per_year)) assert.equal(D.filterPlays(db, { year: +y }).length, n, `year ${y}`);
});
const dm = D.dmTracker(db);
check('Depeche Mode plays', () => assert.equal(dm.plays, F.dm_plays));
check('Depeche Mode plays in regular shows', () => assert.equal(dm.regularPlays, F.dm_regular_plays));
check('regular episodes with Depeche Mode', () => assert.equal(dm.episodesWith, F.dm_regular_episodes));

function compareTop(name, list, keyOf, exp) {
  check(`${name}: top-10 play counts`, () => assert.deepEqual(list.slice(0, 10).map((x) => x.n), exp.counts));
  check(`${name}: entries above the tie cut (${exp.cut})`, () =>
    assert.deepEqual(list.filter((x) => x.n > exp.cut).map(keyOf).sort(), exp.above_cut));
}
compareTop('top songs (regular)', D.topSongs(db, {}, 0), (x) => x.song.key, F.top_songs_regular);
compareTop('top artists (regular)', D.topArtists(db, {}, 0), (x) => x.artist.key, F.top_artists_regular);

// Invariants that do not need SQL.
check('every play counted once per (episode, artist, song)', () => {
  for (const e of db.episodes) assert.equal(new Set(e.tracks.map((p) => p.song.key)).size, e.tracks.length, `#${e.n}`);
});
check('episode 295 kept with an empty playlist', () => {
  const e = D.episode(db, 295); assert.ok(e); assert.equal(e.tracks.length, 0); assert.equal(e.note, 'playlist unknown');
});
check('normalisation merges case, accents and curly quotes', () => {
  assert.equal(D.norm('Motörhead'), D.norm('MOTORHEAD'));
  assert.equal(D.norm('Don’t  Look Back'), D.norm("don't look back"));
  assert.equal(D.norm('Trentemøller'), 'trentemoller');
});
check('aliases resolve to one artist and one song', () => {
  assert.equal(db.artists.get('blink-182')?.name, 'Blink-182');
  assert.ok(!db.artists.has('blink 182'));
  assert.equal(D.songBySlug(db, 'nirvana', 'heart-shaped-box')?.plays.length, 12);
});
check('slugs are unique and round-trip', () => {
  for (const a of db.artists.values()) {
    assert.equal(D.artistBySlug(db, a.slug), a);
    for (const s of a.songs) assert.equal(D.songBySlug(db, a.slug, s.slug), s);
  }
});
check('heatmap: one cell per Monday since 2020-04-13', () => {
  const cells = D.heatmap(db).years.flatMap((y) => y.cells);
  assert.equal(cells[0].monday, '2020-04-13');
  const weeks = D.daysBetween('2020-04-13', D.mondayOf(db.aired.at(-1).date)) / 7 + 1;
  assert.equal(cells.length, weeks);
  assert.equal(cells.reduce((s, c) => s + c.eps.length, 0), db.aired.length);
});
check('countdown lands on Monday 2026-12-07 for #400', () => {
  if (db.aired.at(-1).n === 392) assert.equal(D.countdown(db).date, '2026-12-07');
});
console.log(`\n${pass} checks passed${process.exitCode ? ', some FAILED' : ''}`);
