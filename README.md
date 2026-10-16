# Piticu Dejun 400

An unofficial fan archive of **Piticu Dejun**, Dan Amariei's Monday-night show on Radio Guerrilla
(21:00). It holds every archived playlist since #74 (April 2020), with top songs and artists, a page
for every artist, song and episode, a calendar of every Monday, the Depeche Mode streak tracker and a
countdown to episode #400. Each song opens in Spotify, YouTube Music or Apple Music, and you can tap
its cover to hear a 30-second preview.

It is a static site with no build step and no framework: vanilla HTML/CSS/JS and native ES modules,
hosted on GitHub Pages. It works as a PWA and keeps working offline once loaded.

Not affiliated with Radio Guerrilla. No station logos or artwork are used.

## Run locally

```sh
cd piticudejun
python3 -m http.server 8000      # then open http://127.0.0.1:8000/
```

Add `?present` to the URL, or press **P**, for presenter mode on a studio screen. It hides the
chrome and enlarges the type. Press **/** to jump to search. The service worker only registers on
https, or locally when you add `?sw`, so local edits never come back stale.

## Weekly flow

1. After Monday's show, copy Dan's Facebook playlist post.
2. `pbpaste | python3 ~/Documents/github/piticu/add_episode.py --publish`
   - inserts the episode into MySQL `radu.songs`
   - runs `scripts/export_json.py`, which rewrites `data/shows.json` (one episode per line) and
     bumps the `?v=<episodes>-<tracks>` data version in `index.html`
   - commits "Episode #N" and pushes; GitHub Pages deploys in about a minute
3. Leave out `--publish` to insert only, then run `python3 scripts/export_json.py` when ready.

If a new spelling variant shows up (for example "Blink 182" next to "Blink-182"), add it to
`data/aliases.json`. Case, accents and curly quotes are merged automatically.

## Tests

```sh
python3 tests/make_fixture.py   # expected numbers straight from MySQL
node tests/check_stats.mjs      # compares js/data.js with them
```

## Files

```
index.html            shell: nav, <main>, footer, icon sprite, mini player, <audio>, data version
css/app.css           the design system (tokens, components, responsive, motion)
js/app.js             bootstrap: theme, presenter mode, data load, router start, service worker
js/router.js          hash router and route table
js/data.js            pure data layer (no DOM): norm, aliases, buildDB, stats; Node-importable
js/ui.js              templating + shared components
js/preview.js         iTunes 30-second previews, shared <audio>, mini player, "listen" sheet
js/views/*.js         one module per route
data/shows.json       the archive (export of radu.songs)
data/aliases.json     spelling variant -> canonical, for artists and "Artist|Song"
scripts/export_json.py MySQL -> data/shows.json, bumps the data version
sw.js                 stale-while-revalidate for app + data, caches Google Fonts, never iTunes audio
tests/                SQL fixture + Node check
```

## Architecture

### Routes

| Hash | View |
|---|---|
| `#/` | home |
| `#/songs?tab=&year=&specials=1&dm=aside` | top songs, openers, closers, comebacks, forgotten |
| `#/artists?year=&specials=1&dm=aside` | top artists |
| `#/artist/<slug>` | artist page |
| `#/song/<artist-slug>/<song-slug>` | song page |
| `#/episodes?kind=&year=` | calendar heatmap and archive |
| `#/episode/<n>` | tracklist |
| `#/year/<yyyy>` | year in numbers |
| `#/search?q=` | search |
| `#/dm` | Depeche Mode tracker |
| `#/wrapped` | Piticu Wrapped (placeholder, separate agent) |
| `#/setlist` | Set builder (placeholder, separate agent) |

### The view interface

Each file in `js/views/` default-exports one object:

```js
export default {
  title(ctx) { return 'Songs'; },        // document title prefix ('' = app name only)
  render(root, ctx) {                    // fill root (the <main>); may return a cleanup function
    root.innerHTML = String(html`${pageHead({ title: 'Songs' })} ...`);
    root.addEventListener('click', ...); // listeners on root die with the next render
    return () => { /* optional: stop timers, audio, observers */ };
  },
};
```

`ctx` is `{ db, params, query, path, navigate(hash) }`. `params` holds the route's named regex
groups, `query` is a `URLSearchParams` built from the part after `?` in the hash, and `db` comes
from `buildDB()`.

After `render`, the router runs `hydrate(root)` (reveal, count-up and bar animations) and syncs the
preview buttons. It then focuses `[autofocus]` or the page `h1`, sets `document.title` and lights
up the nav item. When the browser supports the View Transitions API and reduced motion is off,
the page change is animated.

When a view re-renders part of itself, for example after a filter change, call `hydrate(el)` on the
new markup. Keep filters in the URL with `setQuery(path, {...})`, which uses `replaceState` and
never re-routes.

### Adding a route

1. Create `js/views/<name>.js` with the interface above.
2. Add `{ re: /^\/name$/, view: '<name>', tab: '<nav id>' }` to `routes` in `js/router.js`.
3. Optionally add a nav link with `data-tab="<nav id>"` in `index.html` (`.tab`, plus `rail-only`
   for desktop-only items), and add the file to `CORE` in `sw.js` so it works offline.
4. Put view-specific CSS at the end of `css/app.css`, scoped under a root class such as
   `.v-<name>`.

### `js/data.js` (pure, Node-safe)

- `norm(s)`, `slugify(s)`, `buildDB(shows, aliases)`, `episode(db, n)`, `artistBySlug`, `songBySlug`
- `db.episodes` (all of them, including #295 with no tracks), `db.aired` (episodes with tracks),
  `db.plays`, `db.songs` / `db.artists` (Maps keyed by normalised key), `db.years`
- play: `{ ep, song, artist, slot, last, debut }`; song: `{ key, slug, title, artist, plays }`;
  artist: `{ key, slug, name, plays, songs }`; episode: `{ n, date, year, special, regular, note, src, tracks }`
- stats: `totals`, `countdown(db, 400)`, `topSongs(db, opts, limit)`, `topArtists`,
  `filterPlays(db, { specials, dmAside, year, from, to })`, `songStats`, `artistStats`, `dmTracker`,
  `heatmap`, `freshness`, `openersClosers`, `comebacks`, `forgotten`, `onThisDay(db, iso)`,
  `yearStats`, `search(db, q)`
- dates: `parseDate`, `isoDate`, `daysBetween`, `addDays`, `mondayOf`

By default, rankings leave out specials (`specials: false`) and include Depeche Mode
(`dmAside: false`). A play is counted once per (episode, artist, song).

### `js/ui.js` helpers

- Templating: `` html`...${value}` `` escapes every value (nested `html` and arrays pass through),
  `raw(str)` marks trusted HTML, and `esc(str)` escapes a string. Use `String(html...)` when
  assigning to `innerHTML`.
- Formatting: `fmt(n)`, `pct(x)`, `plural(n, 'play')`, `fmtDate(iso, 'short'|'long'|'day'|'month')`,
  `ago(days)`.
- Links: `href.artist(a)`, `href.song(s)`, `href.episode(e)`, `href.year(y)`, `href.search(q)`, and so on.
  `listenUrl.spotify|ytmusic|apple(artist, song)`.
- Components: `pageHead({ kicker, title, sub, back })`, `secHead({ kicker, title, id, link })`,
  `songRow(song, { rank, n, max, meta, slot, badge, showArtist }, i)`, `artistRow(artist, {...}, i)`,
  `rankList(rows)`, `statCard({ label, value, caption, icon, tone, share, link, suffix }, i)`,
  `cover(name, { song, size })` (with `song`, it is the preview button), `listenButtons(song)`,
  `meter(n, max)`, `vbars(data, { aria })`, `sparkline(values, { aria })`, `episodeCard(ep)`,
  `chips(group, options, value, label)`, `toggle(name, label, checked)`, `icon(name)`,
  `comingSoon({...})`, `emptyState(text)`.
- Behaviour: `hydrate(root)`, `countUp(el, n)`, `onChips(root, (group, value) => ...)`,
  `setQuery(path, params)`, `tooltips(root)` (for `[data-tip]`), and `RM()` (prefers reduced motion).
- Previews (`js/preview.js`): any `[data-preview][data-artist][data-song]` button plays.
  `lookup(artist, song)` resolves the iTunes match (cached in localStorage), `stop()` stops
  playback, and `syncPreviewButtons()` restores the playing state after a re-render.
  `[data-listen]` opens the listen sheet.

The CSS classes from these components (`.card`, `.stat`, `.row`, `.chip`, `.seg`, `.btn`, `.badge`,
`.rv` with `--dl` delays, `.micro`, `.grad-text`, and the `--meter` / `--onair` / `--amber` /
`--violet` tokens) are the shared vocabulary. Please reuse them rather than adding new colours.
