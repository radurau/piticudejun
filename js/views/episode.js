// Episode page: full tracklist with debut markers, note/source, prev/next.
import * as D from '../data.js';
import { html, plural, fmtDate, href, icon, pageHead, songRow, emptyState } from '../ui.js';

export default {
  title: ({ params }) => `#${params.n}`,
  render(root, { db, params }) {
    const e = D.episode(db, params.n);
    const i = e ? db.episodes.indexOf(e) : -1;
    const prev = db.episodes[i - 1], next = db.episodes[i + 1];
    if (!e) {
      const near = db.episodes.reduce((m, x) => (Math.abs(x.n - params.n) < Math.abs(m.n - params.n) ? x : m), db.episodes[0]);
      root.innerHTML = String(html`${pageHead({ kicker: 'Not archived', title: `#${params.n}`, sub: 'No playlist for this episode number has been found yet.', back: { href: href.episodes(), label: 'Episodes' } })}
        <p><a class="btn" href="${href.episode(near)}">Closest archived: #${near.n} ${icon('right')}</a></p>`);
      return;
    }
    const debuts = e.tracks.filter((p) => p.debut).length;
    const dm = e.tracks.filter((p) => D.isDM(p.artist)).length;
    const src = e.src && db.sources[e.src];
    const sub = e.tracks.length
      ? `${plural(e.tracks.length, 'track')} · ${plural(debuts, 'debut')}${dm ? ` · ${plural(dm, 'Depeche Mode song')}` : ' · no Depeche Mode'}`
      : 'Playlist unknown';

    root.innerHTML = String(html`
      ${pageHead({ kicker: fmtDate(e.date, 'long'), title: html`#${e.n}${e.special ? html` <span class="badge violet" style="font-size:12px;vertical-align:middle">${icon('spark', 'ic')} ${e.special}</span>` : ''}`, sub, back: { href: href.year(e.year), label: String(e.year) } })}
      ${e.note || src ? html`<div class="note rv" style="margin-top:8px">${icon('info')}<div>${e.note ? html`<div>${e.note}</div>` : ''}${src ? html`<div class="credit" style="margin-top:4px">Source: ${src}</div>` : ''}</div></div>` : ''}
      <section class="sec" aria-label="Tracklist" style="margin-top:20px">
        ${e.tracks.length ? html`<div class="card"><ol class="rank">${e.tracks.map((p, k) => songRow(p.song, {
          slot: p.slot,
          badge: p.debut ? html`<span class="badge">debut</span>` : null,
          meta: p.debut ? 'first time on the show' : `${plural(p.song.plays.length, 'play')} in the archive`,
        }, k))}</ol></div>` : emptyState('This episode is in the archive, but its playlist is unknown.')}
      </section>
      <nav class="pager" aria-label="Neighbouring episodes">
        ${prev ? html`<a class="btn" href="${href.episode(prev)}">${icon('left')} #${prev.n}</a>` : html`<span></span>`}
        <a class="btn" href="${href.episodes()}">All episodes</a>
        ${next ? html`<a class="btn" href="${href.episode(next)}">#${next.n} ${icon('right')}</a>` : html`<span></span>`}
      </nav>`);
  },
};
