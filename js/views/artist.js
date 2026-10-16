// Artist page: plays, songs, timeline, first/last, every song ranked.
import * as D from '../data.js';
import { html, fmt, pct, plural, fmtDate, href, icon, cover, pageHead, songRow, rankList, vbars, secHead, emptyState } from '../ui.js';

export default {
  title: ({ db, params }) => D.artistBySlug(db, params.slug)?.name || 'Artist',
  render(root, { db, params }) {
    const a = D.artistBySlug(db, params.slug);
    if (!a) {
      root.innerHTML = String(html`${pageHead({ title: 'Unknown artist', back: { href: href.artists(), label: 'Artists' } })}${emptyState(html`No artist with that name. <a class="amber" href="#/search">Search</a>`)}`);
      return;
    }
    const st = D.artistStats(db, a);
    const rank = D.topArtists(db, { specials: true }, 0).find((x) => x.artist === a)?.rank;
    const best = st.perYear.reduce((m, y) => (y.n > m.n ? y : m), { n: -1 });
    const max = st.songs[0].n;
    const sub = `${plural(st.n, 'play')} · ${plural(st.songs.length, 'song')} · ${plural(st.episodes.length, 'episode')}${rank ? ` · #${rank} all-time` : ''}`;

    root.innerHTML = String(html`
      <div class="entity" style="padding-top:8px">
        ${cover(a.name, { size: 'lg' })}
        <div>${pageHead({ kicker: 'Artist', title: a.name, sub, back: { href: href.artists(), label: 'Artists' } })}</div>
      </div>
      ${D.isDM(a) ? html`<a class="note rv" href="${href.dm()}" style="margin-top:12px">${icon('flame')}<span><b>The house band.</b> Streaks, slots and every song in the Depeche Mode tracker →</span></a>` : ''}

      <dl class="facts rv" style="margin-top:20px">
        <div><dt>First played</dt><dd><a href="${href.episode(st.first)}">#${st.first.n}</a><small>${fmtDate(st.first.date)}</small></dd></div>
        <div><dt>Last played</dt><dd><a href="${href.episode(st.last)}">#${st.last.n}</a><small>${fmtDate(st.last.date)}</small></dd></div>
        <div><dt>Best year</dt><dd><a href="${href.year(best.year)}">${best.year}</a><small>${plural(best.n, 'play')}</small></dd></div>
        <div><dt>Share of all plays</dt><dd>${pct(st.share, 1)}<small>${(() => { const n = a.plays.filter((p) => !p.ep.regular).length; return n ? `${plural(n, 'play')} in specials` : 'all in regular shows'; })()}</small></dd></div>
      </dl>

      <div class="grid">
        <section class="sec span-7" aria-labelledby="h-songs">
          ${secHead({ kicker: 'Most played first', title: `Songs by ${a.name}`, id: 'h-songs' })}
          ${rankList(st.songs.map((s, i) => songRow(s.song, { rank: s.rank, n: s.n, max, showArtist: false, meta: `last ${fmtDate(s.last.date)}` }, i)), { label: `Songs by ${a.name}` })}
        </section>
        <section class="sec span-5" aria-labelledby="h-time">
          ${secHead({ kicker: 'Timeline', title: 'Plays per year', id: 'h-time' })}
          <div class="card pad rv">${vbars(st.perYear.map((y) => ({ label: String(y.year), n: y.n })), { aria: `Plays per year for ${a.name}: ${st.perYear.map((y) => `${y.year} ${y.n}`).join(', ')}` })}</div>
          ${secHead({ kicker: 'Appearances', title: `${plural(st.episodes.length, 'episode')}`, id: 'h-eps' })}
          <div class="card pad rv"><div class="ep-chips">${st.episodes.slice().reverse().map((e) => html`<a class="chip ${e.regular ? '' : 'special'}" href="${href.episode(e)}" title="${fmtDate(e.date)}">#${e.n}</a>`)}</div></div>
        </section>
      </div>`);
  },
};
