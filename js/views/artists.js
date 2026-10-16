// Artists: ranked artists with the same filters as Songs.
import * as D from '../data.js';
import { html, fmt, plural, pageHead, artistRow, rankList, statCard, hydrate, emptyState, icon } from '../ui.js';
import { readFilters, filterControls, bindFilters } from './songs.js';

const PAGE = 50;

export default {
  title: () => 'Top artists',
  render(root, { db, query, path }) {
    const f = readFilters(query);
    const t = D.totals(db);
    const loyal = [...db.artists.values()].filter((a) => a.songs.length === 1 && a.plays.length >= 5)
      .sort((a, b) => b.plays.length - a.plays.length).slice(0, 8);
    let limit = PAGE;
    root.innerHTML = String(html`
      ${pageHead({ kicker: 'Artists', title: 'Who gets the airtime', sub: `${fmt(t.artists)} artists so far. ${fmt(t.oneTimeArtists)} of them were played exactly once.` })}
      <div class="filters">${filterControls(db, f)}</div>
      <div class="cols-2 artists-layout">
        <div id="artists-list"></div>
        <aside>
          <div class="stats" style="margin-bottom:16px">
            ${statCard({ label: 'One-play artists', value: t.oneTimeArtists, caption: `${Math.round((t.oneTimeArtists / t.artists) * 100)}% of all artists`, icon: 'spark' }, 0)}
            ${statCard({ label: 'Different songs', value: t.songs, caption: `${(t.songs / t.artists).toFixed(1)} per artist on average`, icon: 'note' }, 1)}
          </div>
          <div class="sec-h"><div><div class="micro">Same song, every time</div><h2>Loyal to one track</h2></div></div>
          ${rankList(loyal.map((a, i) => artistRow(a, { meta: html`${plural(a.plays.length, 'play')}, always <b>${a.songs[0].title}</b>` }, i)), { label: 'Artists always played with the same song' })}
        </aside>
      </div>`);
    const out = root.querySelector('#artists-list');
    const draw = () => {
      const all = D.topArtists(db, { year: f.year, specials: f.specials, dmAside: f.dmAside }, 0);
      const max = all[0]?.n || 1;
      out.innerHTML = String(all.length ? html`
        <p class="micro" style="margin:0 0 12px">${f.year || 'All-time'} · ${f.specials ? 'all shows' : 'regular shows'}${f.dmAside ? ' · Depeche Mode aside' : ''} · ${fmt(all.length)} artists</p>
        ${rankList(all.slice(0, limit).map((a, i) => artistRow(a.artist, { rank: a.rank, n: a.n, max, meta: `${plural(a.songs, 'song')} · ${plural(a.episodes, 'episode')}` }, i)), { label: 'Top artists' })}
        ${all.length > limit ? html`<div class="more-wrap"><button class="btn" type="button" data-more>Show ${Math.min(PAGE, all.length - limit)} more ${icon('right')}</button></div>` : ''}`
        : emptyState('No artists match these filters.'));
      hydrate(out);
    };
    bindFilters(root.querySelector('.filters'), f, path, () => { limit = PAGE; draw(); });
    out.addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { limit += PAGE; draw(); } });
    draw();
  },
};
