# Piticu Dejun 400 — where we left off

Unofficial fan archive of Dan Amariei's Radio Guerrilla show **Piticu Dejun** (Mondays 21:00).
Live at **https://radurau.github.io/piticudejun/** (GitHub Pages, `main` / root, no build step).
Built 2026-10-16 for Radu's studio visit on **episode #400 (est. Mon 2026-12-07)**.

## Status (2026-10-20)
- Live and working. Data runs **#74–#392** (295 shows, 3,591 rows); the latest is #392 (2026-10-12).
- **#393 (aired Mon 2026-10-19) is not added yet.** Dan hadn't posted the playlist; Radu will add it later.
- Still to add before the demo: #393–#399, one per week.
- All 23 tests pass (`node tests/check_stats.mjs`). QA passed: no console errors, no overflow, 514 links checked, axe WCAG AA clean.

## Weekly update (one command)
```
cd ~/Documents/github/piticu
pbpaste | python3 add_episode.py --dry-run     # check the parsed list first
pbpaste | python3 add_episode.py --publish     # insert into MySQL, export JSON, commit, push
```
`--publish` runs `scripts/export_json.py` (MySQL to `data/shows.json`, then bumps the data version in `index.html`), followed by
`git add data index.html`, a commit "Episode #N" and a push. Pages redeploys in about a minute. `--publish` has **not yet
been run for real**, so watch the first one.

If Dan posts no text playlist, identify the songs with Shazam from the podcast MP3. The tools are in
`~/Documents/github/piticu/tools/`; see the README there.

## Pieces
- **Source of truth:** MySQL `radu.songs` in docker container `github-database-1`
  (`docker exec github-database-1 mysql -uroot --default-character-set=utf8mb4 radu`).
  The JSON in this repo is an export of it; don't hand-edit `data/shows.json`.
- `data/aliases.json` merges spelling variants (46 artists, 61 songs) at load. Add to it when a new variant appears.
- Views live in `js/views/*.js`, with stats in `js/data.js` (pure, Node-testable) and helpers in `js/ui.js`. See README "Architecture".
- Feature routes: `#/wrapped` (story; `?year=2025` for one year, `?s=N` for a slide), `#/setlist` (#400 set builder with
  on-air cue sheet and shareable `?s=` links), `#/dm` (Depeche Mode tracker). Press **P** or add `?present` for presenter mode.
- `sw.js` is the offline cache. **When you add a file, add it to `CORE` and bump `VERSION`.**
  Check the list with `node ~/Documents/github/piticu/tools/check_core.mjs`.
- Song previews use the iTunes Search API (no key, CORS open, about 20 requests/min, cached in localStorage).

## Open items (none block the demo)
- Episode 295 is an all-NULL placeholder row in MySQL (2024-07-22). Radu hasn't decided whether to delete it.
- `icons/icon-512.png` (99 KB) and `maskable-512.png` (80 KB) could be optimised.
- Some chips and buttons are 36–40px, under the 44px tap-target ideal.
- Old `pd:sl:dur:` localStorage keys aren't cleaned up (harmless).
- Missing archive episodes: #1–#73 and 24 gaps between #75 and #111. They predate the podcast archive (Jan 2021) and
  their Facebook posts have no text tracklists. Remaining ideas: list images or comments on FB posts, Spotify, ask Dan.
- Ideas we didn't build: spin-the-wheel picker, listener quiz, artist network graph, share-image export.

## Gotchas
- Push uses the personal SSH alias: `origin = git@github-personal:radurau/piticudejun.git`.
  The `gh` CLI's active account is a work account, so for API calls use `GH_TOKEN=$(gh auth token --user radurau) gh api ...`.
- Design notes and the feature research are in `~/Documents/github/piticu/tools/app-design/`.
