// Depeche Mode tracker: the streak, the slot, the songs, the rare nights without them.
import * as D from '../data.js';
import { html, fmt, pct, plural, fmtDate, href, icon, pageHead, statCard, secHead, songRow, rankList, vbars } from '../ui.js';

export default {
  title: () => 'Depeche Mode tracker',
  render(root, { db }) {
    const dm = D.dmTracker(db);
    if (!dm.artist) { root.innerHTML = String(pageHead({ title: 'No Depeche Mode yet' })); return; }
    const top = dm.slots.reduce((m, s) => (s.n > m.n ? s : m));
    const mid = dm.slots.slice(4, 8).reduce((s, x) => s + x.n, 0);
    const max = dm.songs[0].n;
    const recentWithout = dm.withoutDM.slice(-12).reverse();
    const regular = db.aired.filter((e) => e.regular);

    root.innerHTML = String(html`
      ${pageHead({ kicker: 'The house band', title: 'Depeche Mode tracker', sub: `Dan's running joke, in data: ${plural(dm.plays, 'play')}, ${pct(dm.share, 1)} of everything ever played on the show.` })}

      <section class="card pad rv dm-hero" aria-label="Current streak">
        <div class="micro">${icon('flame', 'ic hl')} Current streak</div>
        <div class="dm-hero-row">
          <span class="mega grad-text" data-count="${dm.current}" aria-label="${dm.current}">${dm.current}</span>
          <p><b>regular shows in a row</b> with at least one Depeche Mode song, from
            <a class="amber" href="${href.episode(dm.currentRange.from)}">#${dm.currentRange.from.n}</a> (${fmtDate(dm.currentRange.from.date)}) to
            <a class="amber" href="${href.episode(dm.currentRange.to)}">#${dm.currentRange.to.n}</a>.
            ${dm.longest.len > dm.current ? `The record is ${dm.longest.len}.` : 'That is the record, and it is still running.'}</p>
        </div>
        <div class="strip big" aria-hidden="true">${regular.map((e) => html`<i class="${e.tracks.some((p) => D.isDM(p.artist)) ? 'on' : ''}" title="#${e.n}"></i>`)}</div>
        <div class="spark-l" aria-hidden="true"><span>#${regular[0].n} · ${regular[0].year}</span><span>every regular show</span><span>#${regular.at(-1).n}</span></div>
      </section>

      <div class="stats" style="margin-top:16px">
        ${statCard({ label: 'Plays', value: dm.plays, caption: `${pct(dm.share, 1)} of all plays`, icon: 'note', tone: 'hot', share: dm.share }, 0)}
        ${statCard({ label: 'Shows with DM', value: dm.episodesWith, caption: `of ${dm.regularEpisodes} regular shows (${pct(dm.episodesWith / dm.regularEpisodes)})`, icon: 'cal' }, 1)}
        ${statCard({ label: 'Different songs', value: dm.songs.length, caption: `led by ${dm.songs[0].song.title}`, icon: 'vinyl' }, 2)}
        ${statCard({ label: 'Home slot', value: top.slot, caption: `track ${top.slot}, ${top.n} times · ${pct(mid / dm.regularPlays)} in slots 5–8`, icon: 'clock', tone: 'violet' }, 3)}
      </div>

      <div class="grid">
        <section class="sec span-7" aria-labelledby="h-slot">
          ${secHead({ kicker: 'Where in the show', title: 'The DM slot', id: 'h-slot' })}
          <div class="card pad rv">
            ${vbars(dm.slots.slice(0, 15).map((s) => ({ label: String(s.slot), n: s.n, tone: s.slot === top.slot ? '' : 'violet' })),
              { aria: `Depeche Mode plays by track position in regular shows: ${dm.slots.slice(0, 15).map((s) => `track ${s.slot}: ${s.n}`).join(', ')}` })}
            <p class="credit" style="margin-top:10px">Track position in regular shows. ${dm.slots[0].n ? `Opened a show only ${plural(dm.slots[0].n, 'time')}.` : 'Never the opener.'}</p>
          </div>
          ${secHead({ kicker: 'Per year', title: 'Shows with DM', id: 'h-dmy' })}
          <div class="card pad rv">
            ${vbars(dm.perYear.map((y) => ({ label: String(y.year), n: Math.round((y.withDM / (y.episodes || 1)) * 100) })),
              { aria: `Percent of regular shows with Depeche Mode per year: ${dm.perYear.map((y) => `${y.year} ${y.withDM} of ${y.episodes}`).join(', ')}` })}
            <p class="credit" style="margin-top:10px">Percent of regular shows each year with at least one Depeche Mode song.</p>
          </div>
        </section>
        <section class="sec span-5" aria-labelledby="h-dms">
          ${secHead({ kicker: 'Most played', title: 'Top DM songs', id: 'h-dms', link: href.artist(dm.artist), linkText: 'All songs' })}
          ${rankList(dm.songs.slice(0, 15).map((s, i) => songRow(s.song, { rank: s.rank, n: s.n, max, showArtist: false, meta: `last ${fmtDate(s.last.date)}` }, i)))}
        </section>
      </div>

      <section class="sec" aria-labelledby="h-without">
        ${secHead({ kicker: 'Rare nights', title: `${plural(dm.withoutDM.length, 'show')} without Depeche Mode`, id: 'h-without' })}
        <div class="card pad rv"><div class="ep-chips">
          ${dm.withoutDM.slice().reverse().map((e) => html`<a class="chip" href="${href.episode(e)}" title="${fmtDate(e.date)}">#${e.n}<span class="muted">${e.year}</span></a>`)}
        </div>
        <p class="credit" style="margin-top:12px">Latest: #${recentWithout[0]?.n} on ${fmtDate(recentWithout[0]?.date)}. ${fmt(dm.current)} shows ago and counting.</p></div>
      </section>`);
  },
};
