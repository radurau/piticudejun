// Episodes: calendar heatmap (one cell per Monday since 2020-04-13) and the archive grid.
import * as D from '../data.js';
import { html, fmt, plural, fmtDate, href, icon, pageHead, episodeCard, chips, onChips, setQuery, hydrate, tooltips, secHead } from '../ui.js';

/** Calendar heatmap. Exported so other views (Wrapped) can reuse it. */
export function heatmapCard(db, { years = null } = {}) {
  const hm = D.heatmap(db);
  const level = (e) => Math.max(1, Math.min(4, Math.ceil((e.tracks.length / 16) * 4)));
  const rows = hm.years.filter((y) => !years || years.includes(y.year));
  return html`<div class="card pad rv">
    <div class="heat" role="figure" aria-label="Calendar of every Monday since 13 April 2020. ${db.aired.length} shows archived; hollow cells are weeks with no archived playlist; violet cells are specials.">
      ${rows.map((y) => {
        const byCol = new Map(y.cells.map((c) => [c.col, c]));
        const cols = Math.max(52, ...y.cells.map((c) => c.col)) + 1;
        return html`<div class="heat-y"><a class="yl" href="${href.year(y.year)}" aria-hidden="true" tabindex="-1">${y.year}</a>
          <div class="cells" aria-hidden="true">${Array.from({ length: cols }, (_, col) => {
            const c = byCol.get(col);
            if (!c) return html`<span class="cell pad"></span>`;
            if (!c.ep) return html`<span class="cell missing" data-tip="Week of ${fmtDate(c.monday)} · not archived"></span>`;
            const e = c.ep;
            return html`<a class="cell ${e.special ? 'special' : ''}" data-l="${level(e)}" href="${href.episode(e)}" tabindex="-1"
              data-tip="#${e.n} · ${fmtDate(e.date)} · ${e.special || plural(e.tracks.length, 'track')}"></a>`;
          })}</div></div>`;
      })}
    </div>
    <div class="heat-legend" aria-hidden="true">
      <span>Fewer <i class="cell" data-l="1"></i><i class="cell" data-l="2"></i><i class="cell" data-l="3"></i><i class="cell" data-l="4"></i> more tracks</span>
      <span><i class="cell special"></i> Special</span>
      <span><i class="cell missing"></i> Not archived</span>
    </div>
  </div>`;
}

export default {
  title: () => 'Episodes',
  render(root, { db, query, path }) {
    const t = D.totals(db);
    const f = { kind: query.get('kind') || 'all', year: query.get('year') || '' };
    root.innerHTML = String(html`
      ${pageHead({ kicker: 'Episodes', title: 'Every Monday', sub: `${fmt(t.episodes)} shows archived, #${t.first.n} to #${t.last.n}: ${t.regular} regular and ${t.specials} specials. ${t.missing} episode numbers in between have no playlist yet.` })}
      <section class="sec" aria-labelledby="h-cal" style="margin-top:24px">
        ${secHead({ kicker: 'One square per Monday', title: 'The calendar', id: 'h-cal' })}
        ${heatmapCard(db)}
      </section>
      <section class="sec" aria-labelledby="h-arch">
        ${secHead({ kicker: 'Newest first', title: 'The archive', id: 'h-arch' })}
        <div class="controls filters">
          <div class="seg" role="group" aria-label="Kind">${[['all', 'All'], ['regular', 'Regular'], ['special', 'Specials']].map(([v, l]) => html`<button type="button" data-chip="kind" data-value="${v}" aria-pressed="${f.kind === v}">${l}</button>`)}</div>
          ${chips('year', [{ value: '', label: 'All years' }, ...db.years.map((y) => ({ value: y, label: String(y) }))], f.year, 'Year')}
        </div>
        <div id="ep-list"></div>
      </section>`);
    const out = root.querySelector('#ep-list');
    let shownYears = 2;
    const draw = () => {
      const eps = db.episodes.filter((e) => (f.kind === 'all' || (f.kind === 'special' ? e.special : !e.special)) && (!f.year || e.year === +f.year));
      const all = [...new Set(eps.map((e) => e.year))].sort((a, b) => b - a);
      const years = all.slice(0, shownYears);
      out.innerHTML = String(html`${years.map((y) => {
        const list = eps.filter((e) => e.year === y).reverse();
        return html`<div class="year-h"><h2>${y}</h2><span class="muted">${plural(list.length, 'show')}</span>
          <a class="link" href="${href.year(y)}" style="margin-left:auto">${y} in numbers ${icon('right')}</a></div>
          <div class="ep-grid">${list.map((e, i) => episodeCard(e, i))}</div>`;
      })}${all.length > years.length ? html`<div class="more-wrap" style="margin-top:20px"><button class="btn" type="button" data-older>Show ${all[years.length]}${all.length > years.length + 1 ? ` to ${all.at(-1)}` : ''} ${icon('right')}</button></div>` : ''}`);
      hydrate(out);
    };
    out.addEventListener('click', (e) => { if (e.target.closest('[data-older]')) { shownYears = 99; draw(); } });
    onChips(root.querySelector('.filters'), (g, v) => { f[g] = v; setQuery(path, { kind: f.kind === 'all' ? null : f.kind, year: f.year }); draw(); });
    tooltips(root);
    draw();
  },
};
