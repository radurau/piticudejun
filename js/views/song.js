// Song page: preview + listen links, first/last/longest gap, a timeline of every play.
import * as D from '../data.js';
import { html, fmt, plural, fmtDate, ago, href, icon, cover, pageHead, listenUrl, secHead, rankList, songRow, emptyState, tooltips } from '../ui.js';

export default {
  title: ({ db, params }) => { const s = D.songBySlug(db, params.artist, params.song); return s ? `${s.title} · ${s.artist.name}` : 'Song'; },
  render(root, { db, params }) {
    const s = D.songBySlug(db, params.artist, params.song);
    if (!s) {
      root.innerHTML = String(html`${pageHead({ title: 'Unknown song', back: { href: href.songs(), label: 'Songs' } })}${emptyState(html`Not in the archive. <a class="amber" href="#/search">Search</a>`)}`);
      return;
    }
    const st = D.songStats(s);
    const rank = D.topSongs(db, { specials: true }, 0).find((x) => x.song === s)?.rank;
    const first = D.parseDate(db.aired[0].date), span = D.parseDate(db.aired.at(-1).date) - first || 1;
    const usual = [...st.slots].sort((a, b) => b[1] - a[1])[0];
    const others = s.artist.songs.filter((x) => x !== s).sort((a, b) => b.plays.length - a.plays.length).slice(0, 5);
    const a = s.artist.name, t = s.title;

    root.innerHTML = String(html`
      <div class="entity" style="padding-top:8px">
        ${cover(a, { song: s, size: 'lg' })}
        <div>${pageHead({ kicker: html`Song · <a href="${href.artist(s.artist)}" class="amber">${a}</a>`, title: t,
          sub: `${plural(st.n, 'play')}${rank ? ` · #${rank} all-time` : ''} · ${st.n === 1 ? `played once, ${fmtDate(st.first.date)}` : `first ${fmtDate(st.first.date)}, last ${fmtDate(st.last.date)}`}`,
          back: { href: href.artist(s.artist), label: a } })}</div>
      </div>

      <section class="sec" aria-label="Listen" style="margin-top:20px">
        <div class="listen-grid">
          <a class="listen sp" href="${listenUrl.spotify(a, t)}" target="_blank" rel="noopener">${icon('sp')}<span>Spotify<small>Search and play</small></span>${icon('ext', 'ic go')}</a>
          <a class="listen yt" href="${listenUrl.ytmusic(a, t)}" target="_blank" rel="noopener">${icon('yt')}<span>YouTube Music<small>Full song, free</small></span>${icon('ext', 'ic go')}</a>
          <a class="listen am" href="${listenUrl.apple(a, t)}" target="_blank" rel="noopener">${icon('am')}<span>Apple Music<small>Search the store</small></span>${icon('ext', 'ic go')}</a>
        </div>
        <p class="credit" style="margin-top:10px">Tap the cover for a 30-second preview. Preview via Apple Music.</p>
      </section>

      <dl class="facts rv" style="margin-top:24px">
        <div><dt>Plays</dt><dd>${fmt(st.n)}<small>${st.specials ? `${st.specials} in specials` : 'all in regular shows'}</small></dd></div>
        <div><dt>Debut</dt><dd><a href="${href.episode(st.first)}">#${st.first.n}</a><small>${fmtDate(st.first.date)}</small></dd></div>
        <div><dt>Longest gap</dt><dd>${st.gap ? ago(st.gap.days) : '—'}<small>${st.gap ? `#${st.gap.from.n} → #${st.gap.to.n}` : 'only played once'}</small></dd></div>
        <div><dt>Usual slot</dt><dd>Track ${usual[0]}<small>${st.openers ? `opened ${plural(st.openers, 'show')}` : st.closers ? `closed ${plural(st.closers, 'show')}` : `${usual[1]} of ${st.n} plays`}</small></dd></div>
      </dl>

      <section class="sec" aria-labelledby="h-tl">
        ${secHead({ kicker: 'Every play', title: 'On the timeline', id: 'h-tl' })}
        <div class="card pad rv">
          <div class="timeline" role="img" aria-label="Plays from ${fmtDate(db.aired[0].date)} to ${fmtDate(db.aired.at(-1).date)}: ${s.plays.map((p) => `#${p.ep.n}`).join(', ')}">
            ${s.plays.map((p) => html`<a class="${p.ep.regular ? '' : 'special'}" href="${href.episode(p.ep)}" data-tip="#${p.ep.n} · ${fmtDate(p.ep.date)} · track ${p.slot}"
              style="left:${(((D.parseDate(p.ep.date) - first) / span) * 100).toFixed(2)}%" aria-label="Episode ${p.ep.n}, ${fmtDate(p.ep.date)}"></a>`)}
          </div>
          <div class="timeline-l" aria-hidden="true">${db.years.map((y) => html`<span>${y}</span>`)}</div>
        </div>
        <div class="card" style="margin-top:12px"><ol class="rank">
          ${s.plays.slice().reverse().map((p, i) => html`<li class="row no-rank rv" style="--dl:${Math.min(i, 12) * 50}ms">
            <span class="cover" style="--h:${(p.ep.year * 47) % 360}" aria-hidden="true">${p.slot}</span>
            <div class="tt"><div class="s"><a href="${href.episode(p.ep)}">#${p.ep.n}</a>${p.ep.special ? html`<span class="badge violet">${p.ep.special}</span>` : ''}${p.debut ? html`<span class="badge">debut</span>` : ''}</div>
              <div class="a">${fmtDate(p.ep.date, 'day')} · track ${p.slot} of ${p.ep.tracks.length}${p.slot === 1 ? ' · opener' : p.last ? ' · closer' : ''}</div></div>
            <a class="lb" href="${href.episode(p.ep)}" aria-label="Open episode ${p.ep.n}">${icon('right')}</a></li>`)}
        </ol></div>
      </section>

      ${others.length ? html`<section class="sec" aria-labelledby="h-more">
        ${secHead({ kicker: 'Also by', title: a, id: 'h-more', link: href.artist(s.artist), linkText: 'Artist' })}
        ${rankList(others.map((o, i) => songRow(o, { showArtist: false, meta: plural(o.plays.length, 'play') }, i)))}
      </section>` : ''}`);
    tooltips(root);
  },
};
