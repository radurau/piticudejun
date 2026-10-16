// Year page: the year in numbers, its top songs/artists, freshness per episode and its shows.
import * as D from '../data.js';
import { html, fmt, pct, plural, href, icon, pageHead, statCard, secHead, songRow, artistRow, rankList, vbars, episodeCard, emptyState, tooltips } from '../ui.js';
import { heatmapCard } from './episodes.js';

export default {
  title: ({ params }) => params.year,
  render(root, { db, params }) {
    const y = +params.year;
    const nav = html`<div class="seg" role="navigation" aria-label="Years" style="margin-bottom:8px">${db.years.map((x) => html`<a href="${href.year(x)}" ${x === y ? html`aria-current="page"` : ''}>${x}</a>`)}</div>`;
    if (!db.years.includes(y)) {
      root.innerHTML = String(html`${pageHead({ kicker: 'Year', title: String(y), back: { href: href.episodes(), label: 'Episodes' } })}${nav}${emptyState('No archived shows in this year.')}`);
      return;
    }
    const ys = D.yearStats(db, y);
    const prev = D.freshness(db).perYear.find((r) => r.year === y - 1);
    const fresh = D.freshness(db).perEpisode.filter((r) => r.ep.year === y);
    const sMax = ys.topSongs[0]?.n || 1, aMax = ys.topArtists[0]?.n || 1;

    root.innerHTML = String(html`
      ${pageHead({ kicker: 'The year in numbers', title: String(y), sub: `${plural(ys.episodes.length, 'show')}${ys.specials ? ` (${ys.specials} special)` : ''} · ${plural(ys.plays, 'play')} · ${plural(ys.debuts, 'debut')}`, back: { href: href.episodes(), label: 'Episodes' } })}
      ${nav}
      <div class="stats year-stats" style="margin-top:12px">
        ${statCard({ label: 'Shows', value: ys.episodes.length, caption: `${(ys.plays / ys.episodes.length).toFixed(1)} tracks per show`, icon: 'cal', tone: 'hot' }, 0)}
        ${statCard({ label: 'Fresh songs', value: Math.round(ys.freshness.pct * 100), suffix: '%', caption: prev ? `${pct(prev.pct)} the year before` : 'first-time plays', icon: 'spark' }, 1)}
        ${statCard({ label: 'New artists', value: ys.newArtists, caption: 'first time on the show', icon: 'mic' }, 2)}
        ${statCard({ label: 'Longest show', value: ys.longest.tracks.length, caption: html`tracks in <a class="amber" href="${href.episode(ys.longest)}">#${ys.longest.n}</a>`, icon: 'vinyl' }, 3)}
      </div>
      <div class="grid">
        <section class="sec span-7" aria-labelledby="h-ys">
          ${secHead({ kicker: `${y} · regular shows`, title: 'Top songs', id: 'h-ys', link: href.songs(`?year=${y}`) })}
          ${rankList(ys.topSongs.map((s, i) => songRow(s.song, { rank: s.rank, n: s.n, max: sMax }, i)))}
        </section>
        <section class="sec span-5" aria-labelledby="h-ya">
          ${secHead({ kicker: `${y} · regular shows`, title: 'Top artists', id: 'h-ya', link: '#/artists?year=' + y })}
          ${rankList(ys.topArtists.map((a, i) => artistRow(a.artist, { rank: a.rank, n: a.n, max: aMax, meta: plural(a.songs, 'song') }, i)))}
        </section>
      </div>
      <section class="sec" aria-labelledby="h-yf">
        ${secHead({ kicker: 'Freshness per show', title: 'How much was new?', id: 'h-yf' })}
        <div class="card pad rv">${vbars(fresh.map((r) => ({ label: `#${r.ep.n}`, n: Math.round(r.pct * 100), tone: r.ep.special ? 'violet' : '' })),
          { aria: `Percent of first-time songs per show in ${y}`, showValues: false, labelEvery: Math.ceil(fresh.length / 8) })}</div>
      </section>
      <section class="sec" aria-labelledby="h-yc">
        ${secHead({ kicker: 'Calendar', title: `Mondays of ${y}`, id: 'h-yc' })}
        ${heatmapCard(db, { years: [y] })}
      </section>
      <section class="sec" aria-labelledby="h-ye">
        ${secHead({ kicker: 'Shows', title: `All of ${y}`, id: 'h-ye' })}
        <div class="ep-grid">${ys.episodes.slice().reverse().map((e, i) => episodeCard(e, i))}</div>
      </section>
      <nav class="pager" aria-label="Neighbouring years">
        ${db.years.includes(y - 1) ? html`<a class="btn" href="${href.year(y - 1)}">${icon('left')} ${y - 1}</a>` : html`<span></span>`}
        ${db.years.includes(y + 1) ? html`<a class="btn" href="${href.year(y + 1)}">${y + 1} ${icon('right')}</a>` : html`<span></span>`}
      </nav>`);
    tooltips(root);
  },
};
