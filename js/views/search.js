// Search: "when was it last played?" — songs, artists and episodes, accent/case-insensitive.
import * as D from '../data.js';
import { html, plural, fmtDate, href, icon, pageHead, songRow, artistRow, rankList, episodeCard, setQuery, hydrate, emptyState, secHead } from '../ui.js';
import { syncPreviewButtons } from '../preview.js';

const SUGGEST = ['Depeche Mode', 'Placebo', 'Nirvana', 'Never Let Me Down', 'Wonderwall', 'The Beatles', '#300', '2020'];

export default {
  title: ({ query }) => (query.get('q') ? `Search: ${query.get('q')}` : 'Search'),
  render(root, { db, query, path }) {
    root.innerHTML = String(html`
      ${pageHead({ kicker: 'Search', title: 'When was it last played?', sub: 'Songs, artists, episode numbers (#300) or dates (2024-07).' })}
      <form class="searchbox" role="search" style="margin:8px 0 20px" onsubmit="return false">
        ${icon('search')}
        <label class="sr-only" for="q">Search the archive</label>
        <input id="q" type="search" autofocus autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="Try “placebo” or “in bloom”" value="${query.get('q') || ''}">
      </form>
      <div id="results" aria-live="polite"></div>`);
    const input = root.querySelector('#q');
    const out = root.querySelector('#results');
    let timer = 0;
    const draw = () => {
      const q = input.value.trim();
      if (!q) {
        out.innerHTML = String(html`<div class="micro" style="margin-bottom:10px">Try</div><div class="chips" style="flex-wrap:wrap">${SUGGEST.map((s) => html`<button type="button" class="chip" data-q="${s}">${s}</button>`)}</div>`);
        return;
      }
      const r = D.search(db, q);
      const sMax = r.songs[0]?.n || 1;
      out.innerHTML = String(!r.songs.length && !r.artists.length && !r.episodes.length
        ? emptyState(html`Nothing matches “${q}”. Never played on Piticu Dejun… yet.`)
        : html`
          ${r.episodes.length ? html`<section class="sec" style="margin-top:0">${secHead({ title: 'Episodes' })}<div class="ep-grid">${r.episodes.map((e, i) => episodeCard(e, i))}</div></section>` : ''}
          ${r.artists.length ? html`<section class="sec" style="margin-top:${r.episodes.length ? 28 : 0}px">${secHead({ title: 'Artists' })}
            ${rankList(r.artists.map((a, i) => artistRow(a.artist, { meta: `${plural(a.n, 'play')} · last ${fmtDate(a.artist.plays.at(-1).ep.date)}` }, i)))}</section>` : ''}
          ${r.songs.length ? html`<section class="sec" style="margin-top:28px">${secHead({ title: 'Songs' })}
            ${rankList(r.songs.map((s, i) => songRow(s.song, { n: s.n, max: sMax, meta: html`last <a href="${href.episode(s.last)}">#${s.last.n}</a>, ${fmtDate(s.last.date)}` }, i)))}</section>` : ''}`);
      hydrate(out); syncPreviewButtons();
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { setQuery(path, { q: input.value.trim() }); draw(); }, 120);
    });
    out.addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]');
      if (b) { input.value = b.dataset.q; setQuery(path, { q: b.dataset.q }); draw(); input.focus(); }
    });
    draw();
    return () => clearTimeout(timer); // a pending keystroke must not rewrite the next page's URL
  },
};
