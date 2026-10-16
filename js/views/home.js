// Home: on-air hero with the #400 countdown, headline stats, top songs, last tracklist,
// the Depeche Mode streak, on-this-day and the freshness curve.
import * as D from '../data.js';
import { html, raw, fmt, pct, plural, fmtDate, href, icon, statCard, secHead, songRow, rankList, vbars, RM } from '../ui.js';

function equalizer(n = 40) {
  // Deterministic pseudo-random bars, so screenshots and re-renders stay stable.
  let s = 7;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: n }, () =>
    html`<i style="--d:${(0.9 + r() * 1.6).toFixed(2)}s;--dl:-${(r() * 2).toFixed(2)}s;--lo:${(0.08 + r() * 0.2).toFixed(2)};--hi:${(0.45 + r() * 0.55).toFixed(2)}"></i>`);
}

export default {
  title: () => '',
  render(root, { db }) {
    const t = D.totals(db);
    const cd = D.countdown(db, 400);
    const dm = D.dmTracker(db);
    const top = D.topSongs(db, {}, 10);
    const last = t.last;
    const fr = D.freshness(db);
    const today = D.isoDate(Date.now());
    const otd = D.onThisDay(db, today, 3).slice(0, 4);
    const ticker = D.topArtists(db, { specials: true }, 24).map((a) => a.artist);
    const years = Math.floor(D.daysBetween(t.first.date, last.date) / 365.25);
    const C = 2 * Math.PI * 34;
    const regular = db.aired.filter((e) => e.regular);
    const strip = regular.slice(-40);

    root.innerHTML = String(html`
    <div class="grid">
      <section class="hero home-hero" aria-labelledby="home-h1">
        <div class="hero-top">
          <span class="onair"><span class="dot" aria-hidden="true"></span>On air · Luni 21:00</span>
          <span class="hero-meta">Radio Guerrilla<br>with Dan Amariei</span>
        </div>
        <div class="hero-body">
          <div>
            <div class="micro kicker amber">Mic dejun pentru urechi</div>
            <h1 class="wordmark" id="home-h1" tabindex="-1"><span>Piticu</span><span>Dejun <span class="grad-text">400</span></span></h1>
            <p class="tagline">Breakfast, served Mondays at nine. <em>${fmt(t.plays)}</em> times.</p>
          </div>
          <div class="countdown" role="group" aria-label="Countdown to episode 400">
            <div class="ring" aria-hidden="true">
              <svg viewBox="0 0 80 80"><circle class="track" cx="40" cy="40" r="34" fill="none" stroke-width="7"/>
                <circle class="prog" cx="40" cy="40" r="34" fill="none" stroke-width="7" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-offset="${(C * (1 - cd.progress)).toFixed(1)}"/></svg>
              <b>#${cd.latest.n}</b>
            </div>
            <div>
              <div class="big">${cd.left ? html`<span class="hl">${cd.left}</span> ${cd.left === 1 ? 'Monday' : 'Mondays'} to #400` : html`<span class="hl">#400</span> is on air`}</div>
              <p>${cd.left ? `Est. ${fmtDate(cd.date, 'day')}, 21:00 · if the weekly beat holds` : 'Happy 400th, Piticu Dejun!'}</p>
            </div>
          </div>
          <div class="eq" aria-hidden="true">${equalizer()}</div>
        </div>
        <div class="ticker" aria-label="Most played artists"><div class="ticker-in">
          ${[...ticker, ...ticker].map((a, i) => html`<a href="${href.artist(a)}" ${i >= ticker.length ? raw('tabindex="-1" aria-hidden="true"') : ''}>${a.name}</a>`)}
        </div></div>
      </section>

      <div class="home-side">
        <section aria-labelledby="h-stats">
          <h2 id="h-stats" class="sr-only">Headline numbers</h2>
          <div class="micro" style="margin:4px 0 12px">Since #${t.first.n} · ${fmtDate(t.first.date, 'month')}</div>
          <div class="stats">
            ${statCard({ label: 'Songs spun', value: t.plays, caption: `across #${t.first.n} → #${last.n}`, icon: 'vinyl', tone: 'hot' }, 0)}
            ${statCard({ label: 'Mondays archived', value: t.episodes, caption: `${years}+ years of evening breakfasts`, icon: 'cal', link: href.episodes() }, 1)}
            ${statCard({ label: 'Artists', value: t.artists, caption: `and ${fmt(t.songs)} different songs`, icon: 'mic', link: href.artists() }, 2)}
            ${statCard({ label: 'Depeche Mode', value: dm.plays, caption: `1 in ${Math.round(1 / dm.share)} songs. The house band.`, icon: 'note', share: dm.share, link: href.dm() }, 3)}
          </div>
        </section>
        <a class="card pad rv dm-streak" href="${href.dm()}" aria-label="Depeche Mode streak: ${dm.current} regular episodes in a row. Open the tracker.">
          <div class="dm-streak-top">
            <div><div class="micro">${icon('flame', 'ic hl')} Depeche Mode streak</div>
              <div class="dm-streak-n"><span class="num" data-count="${dm.current}">${dm.current}</span> <span>shows in a row</span></div></div>
            ${icon('right')}
          </div>
          <div class="strip" aria-hidden="true">${strip.map((e) => html`<i class="${e.tracks.some((p) => D.isDM(p.artist)) ? 'on' : ''}"></i>`)}</div>
          <p class="muted" style="font-size:13px">Every regular show since #${dm.currentRange?.from.n} (${fmtDate(dm.currentRange?.from.date || last.date, 'month')}). The last 40 shows, oldest first.</p>
        </a>
        <a class="card pad rv ask" href="#/search" style="--dl:120ms">
          ${icon('search')}<span><b>When was it last played?</b><small>Search ${fmt(t.songs)} songs, ${fmt(t.artists)} artists and every episode</small></span>${icon('right')}
        </a>
      </div>

      <section class="sec span-7" aria-labelledby="h-top">
        ${secHead({ kicker: 'All-time · regular shows', title: 'Top songs of all time', id: 'h-top', link: href.songs() })}
        ${rankList(top.map((s, i) => songRow(s.song, { rank: s.rank, n: s.n, max: top[0].n }, i)), { label: 'Top 10 songs' })}
      </section>

      <section class="sec span-5" aria-labelledby="h-last">
        ${secHead({ kicker: 'Last on air', title: 'The latest tracklist', id: 'h-last', link: href.episode(last), linkText: `#${last.n}` })}
        <div class="card">
          <a class="ep-head" href="${href.episode(last)}"><div class="ep-n">#${last.n}</div>
            <div><span class="micro">${fmtDate(last.date, 'long')}</span><p>${plural(last.tracks.length, 'track')} · ${plural(last.tracks.filter((p) => p.debut).length, 'debut')}${last.special ? ` · ${last.special}` : ''}</p></div></a>
          <ol class="rank">${last.tracks.slice(0, 7).map((p, i) => songRow(p.song, {
            slot: p.slot, meta: p.debut ? 'first time' : plural(p.song.plays.length, 'play'),
            badge: p.debut ? html`<span class="badge">new</span>` : null }, i))}</ol>
          ${last.tracks.length > 7 ? html`<div class="more-wrap"><a class="btn" href="${href.episode(last)}">All ${last.tracks.length} tracks ${icon('right')}</a></div>` : ''}
        </div>
      </section>

      <section class="sec span-6" aria-labelledby="h-fresh">
        ${secHead({ kicker: 'Freshness', title: 'New songs, year by year', id: 'h-fresh' })}
        <div class="card pad rv">
          <p class="prose" style="margin-bottom:6px">Share of plays that were a song's <b>first time</b> on the show. ${pct(fr.perYear[0].pct)} in ${fr.perYear[0].year}, ${pct(fr.perYear.at(-1).pct)} in ${fr.perYear.at(-1).year}.</p>
          ${vbars(fr.perYear.map((r) => ({ label: String(r.year), n: Math.round(r.pct * 100) })), { aria: `Percent of first-time songs per year: ${fr.perYear.map((r) => `${r.year} ${pct(r.pct)}`).join(', ')}` })}
          <div class="chips" style="margin-top:14px">${db.years.map((y) => html`<a class="chip" href="${href.year(y)}">${y} ${icon('right', 'ic')}</a>`)}</div>
        </div>
      </section>

      <section class="sec span-6" aria-labelledby="h-otd">
        ${secHead({ kicker: `On this day · ${fmtDate(today, 'short').replace(/ \d{4}$/, '')}`, title: 'This week, years ago', id: 'h-otd', link: href.episodes(), linkText: 'Calendar' })}
        ${otd.length ? html`<div class="card"><ol class="rank">${otd.map((o, i) => html`<li class="row no-rank rv" style="--dl:${i * 60}ms">
          <span class="cover" style="--h:${(o.ep.year * 47) % 360}" aria-hidden="true">${String(o.ep.year).slice(2)}</span>
          <div class="tt"><div class="s"><a href="${href.episode(o.ep)}">#${o.ep.n} · ${o.yearsAgo === 1 ? 'a year ago' : `${o.yearsAgo} years ago`}</a></div>
            <div class="a">${fmtDate(o.ep.date, 'day')} · opened with <b>${o.ep.tracks[0].artist.name}</b>, ${o.ep.tracks[0].song.title}</div></div>
          <a class="lb" href="${href.episode(o.ep)}" aria-label="Open episode ${o.ep.n}">${icon('right')}</a></li>`)}</ol></div>`
          : html`<div class="card pad muted">No show aired this week in earlier years.</div>`}
      </section>
    </div>`);

    // Countdown ring fills after first paint.
    const prog = root.querySelector('.ring .prog');
    const fill = () => prog.style.strokeDashoffset = prog.dataset.offset;
    if (RM()) fill(); else requestAnimationFrame(() => requestAnimationFrame(fill));
  },
};
