// Songs: top songs with year / specials / "Depeche Mode aside" filters, plus openers,
// closers, comebacks and forgotten staples. Filters live in the hash query (?year=&specials=1&dm=aside&tab=).
import * as D from '../data.js';
import { html, fmt, plural, fmtDate, ago, href, pageHead, songRow, rankList, chips, toggle, onChips, setQuery, hydrate, emptyState, icon } from '../ui.js';
import { syncPreviewButtons } from '../preview.js';

const TABS = [
  { value: 'top', label: 'Top' }, { value: 'openers', label: 'Openers' }, { value: 'closers', label: 'Closers' },
  { value: 'comebacks', label: 'Comebacks' }, { value: 'forgotten', label: 'Forgotten' },
];
const PAGE = 50;

export function readFilters(query) {
  return {
    year: query.get('year') || null,
    specials: query.get('specials') === '1',
    dmAside: query.get('dm') === 'aside',
    tab: TABS.some((t) => t.value === query.get('tab')) ? query.get('tab') : 'top',
  };
}
export function filterControls(db, f, { tabs = null } = {}) {
  return html`
    ${tabs ? html`<div class="seg" role="group" aria-label="View">${tabs.map((t) => html`<button type="button" data-chip="tab" data-value="${t.value}" aria-pressed="${t.value === f.tab}">${t.label}</button>`)}</div>` : ''}
    <div class="controls">
      ${chips('year', [{ value: '', label: 'All years' }, ...db.years.map((y) => ({ value: y, label: String(y) }))], f.year ?? '', 'Year')}
      ${toggle('specials', 'Include specials', f.specials)}
      ${toggle('dm', 'Depeche Mode aside', f.dmAside)}
    </div>`;
}
export function bindFilters(root, f, path, rerender) {
  const sync = () => setQuery(path, { tab: f.tab === 'top' ? null : f.tab, year: f.year, specials: f.specials ? 1 : null, dm: f.dmAside ? 'aside' : null });
  onChips(root, (g, v) => { if (g === 'year') f.year = v || null; if (g === 'tab') f.tab = v; sync(); rerender(); });
  root.addEventListener('change', (e) => {
    if (e.target.name === 'specials') f.specials = e.target.checked;
    else if (e.target.name === 'dm') f.dmAside = e.target.checked;
    else return;
    sync(); rerender();
  });
}

function describe(f) {
  return [f.year ? `in ${f.year}` : 'all-time', f.specials ? 'all shows' : 'regular shows', f.dmAside ? 'Depeche Mode aside' : ''].filter(Boolean).join(' · ');
}

function list(db, f, limit) {
  const opts = { year: f.year, specials: f.specials, dmAside: f.dmAside };
  if (f.tab === 'top') {
    const all = D.topSongs(db, opts, 0);
    if (!all.length) return { body: emptyState('No plays match these filters.'), total: 0 };
    const max = all[0].n;
    return {
      total: all.length,
      body: rankList(all.slice(0, limit).map((s, i) => songRow(s.song, { rank: s.rank, n: s.n, max, meta: `last ${fmtDate(s.last.date)}` }, i)), { label: 'Top songs' }),
    };
  }
  if (f.tab === 'openers' || f.tab === 'closers') {
    const oc = D.openersClosers(db, opts)[f.tab];
    const kings = oc.artists.slice(0, 5);
    const max = oc.songs[0]?.n || 1;
    return {
      total: oc.songs.length,
      body: html`<div class="card pad rv" style="margin-bottom:12px"><div class="micro">${f.tab === 'openers' ? 'Kings of the opener' : 'Kings of the closer'}</div>
        <div class="kings">${kings.map((k) => html`<a class="chip" href="${href.artist(k.artist)}"><b>${k.artist.name}</b> ${k.n}×</a>`)}</div></div>
        ${rankList(oc.songs.slice(0, limit).map((s, i) => songRow(s.song, { rank: s.rank, n: s.n, max }, i)), { label: f.tab })}`,
    };
  }
  if (f.tab === 'comebacks') {
    let cb = D.comebacks(db, 0);
    if (f.year) cb = cb.filter((c) => c.to.year === +f.year);
    if (f.dmAside) cb = cb.filter((c) => !D.isDM(c.song.artist));
    if (!f.specials) cb = cb.filter((c) => c.from.regular && c.to.regular);
    return {
      total: cb.length,
      body: html`<p class="prose" style="margin-bottom:12px">The longest silences between two plays of the same song${f.year ? `, for comebacks in ${f.year}` : ''}.</p>
        ${rankList(cb.slice(0, limit).map((c, i) => songRow(c.song, { rank: i + 1, meta: html`<b>${ago(c.days)}</b> · <a href="${href.episode(c.from)}">#${c.from.n}</a> → <a href="${href.episode(c.to)}">#${c.to.n}</a>` }, i)), { label: 'Longest comebacks' })}`,
    };
  }
  const fg = D.forgotten(db, 5, 0).filter((x) => !f.dmAside || !D.isDM(x.song.artist));
  return {
    total: fg.length,
    body: html`<p class="prose" style="margin-bottom:12px">Staples with 5+ plays that have not been on air for the longest time. Ideas for #400?</p>
      ${rankList(fg.slice(0, limit).map((x, i) => songRow(x.song, { rank: i + 1, meta: html`${plural(x.n, 'play')} · silent for <b>${ago(x.days)}</b>` }, i)), { label: 'Forgotten staples' })}`,
  };
}

export default {
  title: () => 'Top songs',
  render(root, { db, query, path }) {
    const f = readFilters(query);
    let limit = PAGE;
    root.innerHTML = String(html`
      ${pageHead({ kicker: 'Songs', title: 'The chart', sub: `${fmt(db.songs.size)} different songs played ${fmt(db.plays.length)} times. Tap a cover for a 30-second preview.` })}
      <div class="filters"></div>
      <p class="micro" id="songs-desc" aria-live="polite" style="margin:4px 0 12px"></p>
      <div id="songs-list"></div>`);
    const filters = root.querySelector('.filters');
    filters.innerHTML = String(filterControls(db, f, { tabs: TABS }));
    const out = root.querySelector('#songs-list');
    const draw = () => {
      const { body, total } = list(db, f, limit);
      root.querySelector('#songs-desc').textContent = `${TABS.find((t) => t.value === f.tab).label} · ${describe(f)} · ${fmt(total)} songs`;
      out.innerHTML = String(html`${body}${total > limit ? html`<div class="more-wrap"><button class="btn" type="button" data-more>Show ${Math.min(PAGE, total - limit)} more ${icon('right')}</button></div>` : ''}`);
      hydrate(out); syncPreviewButtons();
    };
    bindFilters(filters, f, path, () => { limit = PAGE; draw(); });
    out.addEventListener('click', (e) => { if (e.target.closest('[data-more]')) { limit += PAGE; draw(); } });
    draw();
  },
};
