// Piticu Wrapped: slide builders. Each returns { id, label, theme, dur, html, enter? } or null
// (a slide that has nothing to say for this period is skipped). All copy is built from `st`.
import { html, raw, fmt, pct, plural, fmtDate, href, icon, hue, initials } from '../../ui.js';
import { isDM } from '../../data.js';

const W = (i) => `--i:${i}`; // stagger index for .wr-in
/** Big count-up number. The visible digits are aria-hidden; the real value is in .sr-only. */
const num = (n, { suffix = '', cls = '', down = null } = {}) => {
  const txt = fmt(n) + suffix;
  return html`<span class="wr-num ${cls}" style="--ch:${txt.length}"><span aria-hidden="true" data-to="${n}" ${down != null ? raw(`data-from="${down}"`) : ''}>${fmt(down ?? n)}</span>${suffix ? html`<small aria-hidden="true">${suffix}</small>` : ''}<span class="sr-only">${txt}</span></span>`;
};
const periodLabel = (st) => (st.all ? `${st.span.from}–${st.span.to}` : String(st.year));
const weekday = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
const tieNote = (list, pick) => {
  if (!list.length) return '';
  const ties = list.filter((x) => x.n === list[0].n);
  return ties.length > 1 ? ` (tied with ${ties.slice(1, 3).map(pick).join(' and ')}${ties.length > 3 ? ` and ${ties.length - 3} more` : ''})` : '';
};
const art = (name, cls = '') => html`<span class="wr-art ${cls}" style="--h:${hue(name)}" aria-hidden="true">${initials(name)}</span>`;
const kicker = (text, i = 0) => html`<p class="wr-k wr-in" style="${W(i)}">${text}</p>`;
const line = (text, i) => html`<p class="wr-line wr-in" style="${W(i)}">${text}</p>`;

// ---------------------------------------------------------------- 1. intro
function intro(st) {
  const chips = [{ v: '', l: 'All years' }, ...st.years.map((y) => ({ v: String(y), l: String(y) }))];
  const cur = st.all ? '' : String(st.year);
  const title = st.all ? html`${st.span.years} years<br>of Mondays` : html`${plural(st.episodes, 'Monday')}<br>in ${st.year}`;
  return {
    id: 'intro', theme: 'ink', dur: 7000, label: 'Piticu Wrapped',
    html: html`<div class="wr-c wr-c-intro">
      <div class="wr-lamp wr-in" style="${W(0)}"><span class="dot" aria-hidden="true"></span>On air · Luni 21:00</div>
      <h1 class="wr-mark wr-in" style="${W(1)}" tabindex="-1"><span>Piticu</span><span class="grad">Wrapped</span></h1>
      <p class="wr-sub wr-in" style="${W(2)}">#${st.first.n} → #${st.last.n} · ${periodLabel(st)}</p>
      <h2 class="wr-h wr-xl wr-in" style="${W(3)}">${title}</h2>
      <p class="wr-line wr-in" style="${W(4)}"><i>Mic dejun pentru urechi</i>, served at nine in the evening. Here's how it went.</p>
      <nav class="wr-years wr-in" style="${W(5)}" aria-label="Choose a year">
        ${chips.map((c) => html`<a class="wr-chip" href="#/wrapped${c.v ? `?year=${c.v}` : ''}" ${c.v === cur ? raw('aria-current="page"') : ''}>${c.l}</a>`)}
      </nav>
      <p class="wr-tap wr-in" style="${W(6)}" aria-hidden="true"><span class="wr-tap-dot"></span>Tap to start</p>
    </div>`,
  };
}

// ---------------------------------------------------------------- 2. totals
function totals(st) {
  const odd = st.nonMonday.length;
  return {
    id: 'totals', theme: 'onair', dur: 7000, label: `${st.episodes} shows`,
    html: html`<div class="wr-c">
      ${kicker(st.all ? 'Since April 2020' : `Piticu Dejun in ${st.year}`)}
      <div class="wr-big wr-in" style="${W(1)}">${num(st.episodes)}</div>
      <h2 class="wr-h wr-in" style="${W(2)}">Mondays of breakfast<span class="wr-fn">${odd ? `*` : ''}</span></h2>
      <div class="wr-trio">
        <div class="wr-in" style="${W(3)}">${num(st.plays, { cls: 'sm' })}<span>songs played</span></div>
        <div class="wr-in" style="${W(4)}">${num(st.all ? st.songs : st.debuts, { cls: 'sm' })}<span>${st.all ? 'different songs' : 'played for the first time'}</span></div>
        <div class="wr-in" style="${W(5)}">${num(st.all ? st.artists : st.newArtists, { cls: 'sm' })}<span>${st.all ? 'artists' : 'new artists'}</span></div>
      </div>
      ${line(odd ? html`*Fine, ${odd === 1 ? 'one was' : `${odd} were`} on a ${odd === 1 ? weekday(st.nonMonday[0].date) : 'different day'} (#${st.nonMonday.map((e) => e.n).join(', #')}). We don't talk about it.` : `That's about ${(st.plays / Math.max(1, st.episodes)).toFixed(0)} songs a night, every night, rain or shine.`, 6)}
    </div>`,
  };
}

// ---------------------------------------------------------------- 3. top song (+ preview)
function topSong(st) {
  const top = st.topSongs[0];
  if (!top) return null;
  const s = top.song, a = s.artist;
  const runners = st.topSongs.slice(1, 4);
  return {
    id: 'song', theme: 'violet', dur: 9000, label: `Most played song: ${s.title}`,
    html: html`<div class="wr-c wr-c-song">
      ${kicker(st.all ? 'The most played song' : `Song of ${st.year}`)}
      <div class="wr-disc-wrap wr-in" style="${W(1)}">
        <button type="button" class="wr-play" data-preview data-artist="${a.name}" data-song="${s.title}"
          aria-label="Play a 30-second preview of ${s.title} by ${a.name}">
          <span class="wr-disc" style="--h:${hue(a.name)}" aria-hidden="true"><span class="wr-label">${initials(a.name)}</span></span>
          <span class="wr-glyph" aria-hidden="true">${icon('play', 'ic i-play')}${icon('stop', 'ic i-stop')}</span>
          <svg class="pv-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.5" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg>
        </button>
        <span class="wr-play-hint" aria-hidden="true">${icon('play')} 30s preview</span>
      </div>
      <h2 class="wr-h wr-title wr-in" style="${W(2)}">${s.title}</h2>
      <p class="wr-artist wr-in" style="${W(3)}">${a.name}</p>
      <p class="wr-pill wr-in" style="${W(4)}"><b>${plural(top.n, 'play')}</b>${tieNote(st.topSongs, (x) => x.song.title)}</p>
      ${line(isDM(a) ? `No surprise: it's Depeche Mode. First on ${fmtDate(top.first.date)}, last on ${fmtDate(top.last.date)}.` : `First on ${fmtDate(top.first.date)}, last on ${fmtDate(top.last.date)}. Some songs just stay for breakfast.`, 5)}
      ${runners.length ? html`<ol class="wr-runners wr-in" style="${W(6)}" aria-label="Runners-up">${runners.map((r) => html`<li><b>${r.rank}</b><span>${r.song.title}<small>${r.song.artist.name}</small></span><em>${r.n}</em></li>`)}</ol>` : ''}
      <p class="wr-credit wr-in" style="${W(7)}">Preview via Apple Music</p>
    </div>`,
  };
}

// ---------------------------------------------------------------- 4. Depeche Mode
function dm(st) {
  const d = st.dm;
  if (!d.artist || !d.plays) return null;
  const max = Math.max(1, ...d.slots.map((s) => s.n));
  const oneIn = d.share ? Math.round(1 / d.share) : 0;
  return {
    id: 'dm', theme: 'dm', dur: 9000, label: 'Depeche Mode, the house band',
    html: html`<div class="wr-c">
      ${kicker('The house band')}
      <div class="wr-big wr-in" style="${W(1)}">${num(d.streak)}</div>
      <h2 class="wr-h wr-in" style="${W(2)}">${st.all ? 'shows in a row with Depeche Mode' : `shows in a row with Depeche Mode in ${st.year}`}</h2>
      ${line(st.all && d.streakRange ? `Every regular show since #${d.streakRange.from.n} (${fmtDate(d.streakRange.from.date, 'month')}). ${d.streak >= d.record ? 'A record, and still running.' : `The record is ${d.record}.`}` : `In ${d.withDM} of ${plural(d.regular, 'regular show')}. Dan's not obsessed. He's consistent.`, 3)}
      <div class="wr-facts">
        <div class="wr-fact wr-in" style="${W(4)}"><b>${pct(d.share, 1)}</b><span>of all plays${oneIn > 1 ? html`<br>1 in ${oneIn} songs` : ''}</span></div>
        <div class="wr-fact wr-in" style="${W(5)}"><b>${d.home.slot}</b><span>usual slot<br>(${plural(d.home.n, 'time')})</span></div>
        <div class="wr-fact wr-in" style="${W(6)}"><b>${d.openers}</b><span>${d.openers ? `times opened<br>the show` : html`times opened<br>the show. Ever.`}</span></div>
      </div>
      <div class="wr-slots wr-in" style="${W(7)}" role="img" aria-label="Depeche Mode plays by track position: ${d.slots.map((s) => `track ${s.slot} ${s.n}`).join(', ')}">
        ${d.slots.map((s, i) => html`<div class="${s.slot === d.home.slot ? 'hot' : ''}"><i style="--h:${(s.n / max).toFixed(3)};--d:${i * 50}ms"></i><span>${s.slot}</span></div>`)}
      </div>
      <p class="wr-axis wr-in" style="${W(8)}">Track position in the show →</p>
    </div>`,
  };
}

// ---------------------------------------------------------------- 5. top 5 artists (bar race)
function artists(st) {
  const r = st.race;
  if (!r.steps.length) return null;
  const top = st.topArtists;
  const lead = top[0], second = top[1];
  const ratio = lead && second ? lead.n / second.n : 0;
  const stepLabel = (k) => (st.all ? k : fmtDate(`${k}-01`, 'month').split(' ')[0]);
  return {
    id: 'artists', theme: 'plum', dur: 10000, label: 'Top 5 artists',
    html: html`<div class="wr-c">
      ${kicker(st.all ? 'Top artists, race to the top' : `Top artists of ${st.year}`)}
      <h2 class="wr-h wr-in" style="${W(1)}">${lead ? lead.artist.name : ''} ${ratio >= 2 ? html`lapped the field` : html`took the crown`}</h2>
      ${line(ratio >= 2 ? `${ratio.toFixed(1)}× the plays of ${second.artist.name}, the runner-up.` : second ? `${plural(lead.n, 'play')}, just ahead of ${second.artist.name} (${second.n}).` : '', 2)}
      <div class="wr-race wr-in" style="${W(3)}" data-race='${JSON.stringify(r.steps.map((s) => ({ k: stepLabel(s.key), v: s.values })))}'
        role="img" aria-label="Top artists: ${top.map((a) => `${a.artist.name} ${a.n}`).join(', ')}">
        <span class="wr-race-step" aria-hidden="true">${stepLabel(r.steps.at(-1).key)}</span>
        ${r.artists.map((a, i) => html`<div class="wr-race-row ${isDM(a) ? 'dm' : ''}" style="--r:${i}" data-i="${i}">
          <div class="wr-race-t"><b class="rk">${i + 1}</b><span class="nm">${a.name}</span><span class="v">${r.steps.at(-1).values[i]}</span></div>
          <span class="bar"><i></i></span></div>`)}
      </div>
    </div>`,
    enter: raceEnter,
  };
}

function raceEnter(el, { RM, later }) {
  const box = el.querySelector('.wr-race');
  if (!box) return;
  const steps = JSON.parse(box.dataset.race);
  const rows = [...box.querySelectorAll('.wr-race-row')];
  const stepEl = box.querySelector('.wr-race-step');
  const apply = (s, first = false) => {
    const vals = s.v;
    const order = vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const max = Math.max(1, order[0][0]);
    order.forEach(([v, i], rank) => {
      const row = rows[i];
      row.style.setProperty('--r', rank);
      row.style.setProperty('--w', first ? 0 : (v / max).toFixed(4));
      row.classList.toggle('off', rank > 4 || v === 0);
      row.querySelector('.rk').textContent = rank + 1;
      row.querySelector('.v').textContent = fmt(v);
    });
    stepEl.textContent = s.k;
  };
  if (RM || steps.length === 1) { box.classList.add('go'); apply(steps.at(-1)); return; }
  apply(steps[0], true);
  box.classList.remove('go');
  const gap = Math.max(380, Math.min(800, 5200 / steps.length));
  later(() => { box.classList.add('go'); apply(steps[0]); }, 650);
  steps.slice(1).forEach((s, i) => later(() => apply(s), 650 + gap * (i + 1)));
}

// ---------------------------------------------------------------- 6. freshness
function freshness(st) {
  const rows = st.freshness.perYear;
  const f = st.freshness.focus;
  if (!f || !rows.length) return null;
  const firstY = rows[0];
  const falling = rows.every((r, i) => i === 0 || r.pct <= rows[i - 1].pct);
  const zero = st.freshness.zero;
  return {
    id: 'fresh', theme: 'paper', dur: 8000, label: 'Freshness by year',
    html: html`<div class="wr-c">
      ${kicker(`First-time songs in ${f.year}`)}
      <div class="wr-big wr-in" style="${W(1)}">${num(Math.round(f.pct * 100), { suffix: '%' })}</div>
      <h2 class="wr-h wr-in" style="${W(2)}">${st.all
        ? html`of ${f.year}'s songs were brand new. In ${firstY.year}: ${pct(firstY.pct)}.`
        : html`of the songs in ${f.year} had never been played before`}</h2>
      <div class="wr-cols wr-in" style="${W(3)}" role="img" aria-label="Share of first-time songs per year: ${rows.map((r) => `${r.year} ${pct(r.pct)}`).join(', ')}">
        ${rows.map((r, i) => html`<div class="${r.year === f.year ? 'hot' : ''}"><em>${pct(r.pct)}</em><i style="--h:${r.pct.toFixed(3)};--d:${i * 90}ms"></i><span>${r.year}</span></div>`)}
      </div>
      ${line(falling && st.all
        ? html`Down every single year. <i>Bine, bine</i>: the classics are winning.${zero.length ? ` ${plural(zero.length, 'show')} had no first-timers at all.` : ''}`
        : zero.length ? `${plural(zero.length, 'show')} that year had no first-timers at all. Comfort food, Monday edition.` : 'Every show that year had at least one brand-new song.', 4)}
    </div>`,
  };
}

// ---------------------------------------------------------------- 7. comeback
function comeback(st) {
  const c = st.comeback;
  if (!c) return null;
  const a0 = st.archive.first.date, a1 = st.archive.last.date;
  const span = Math.max(1, (Date.parse(a1) - Date.parse(a0)));
  const x0 = (Date.parse(c.from.date) - Date.parse(a0)) / span, x1 = (Date.parse(c.to.date) - Date.parse(a0)) / span;
  return {
    id: 'comeback', theme: 'amber', dur: 8000, label: `Longest comeback: ${c.song.title}`,
    html: html`<div class="wr-c">
      ${kicker(st.all ? 'The longest comeback' : `Comeback of ${st.year}`)}
      <div class="wr-big wr-in" style="${W(1)}">${num(c.days)}</div>
      <h2 class="wr-h wr-in" style="${W(2)}">days between two plays of one song</h2>
      <div class="wr-time wr-in" style="${W(3)}" aria-hidden="true">
        <span class="track"></span>
        <span class="seg" style="--x0:${x0.toFixed(4)};--x1:${x1.toFixed(4)}"></span>
        <span class="pin a" style="--x:${x0.toFixed(4)}"><b>#${c.from.n}</b>${fmtDate(c.from.date, 'month')}</span>
        <span class="pin b" style="--x:${x1.toFixed(4)}"><b>#${c.to.n}</b>${fmtDate(c.to.date, 'month')}</span>
      </div>
      <div class="wr-songcard wr-in" style="${W(4)}">${art(c.song.artist.name)}<div><b>${c.song.title}</b><span>${c.song.artist.name}</span></div></div>
      ${line(`That's ${(c.days / 365.25).toFixed(1)} years. Welcome back, we kept your seat warm.`, 5)}
    </div>`,
  };
}

// ---------------------------------------------------------------- 8. the next-week repeat
function repeat(st) {
  const r = st.repeats;
  const ex = r.at(-1);
  return {
    id: 'repeat', theme: 'sunset', dur: 8000, label: 'Songs played two weeks running',
    html: html`<div class="wr-c">
      ${kicker('Rule #1: never play it next week')}
      <div class="wr-big wr-in" style="${W(1)}">${num(r.length)}</div>
      <h2 class="wr-h wr-in" style="${W(2)}">${r.length === 1 ? 'time' : 'times'} a song came back the very next Monday</h2>
      ${ex ? html`<div class="wr-pair wr-in" style="${W(3)}">
          <div class="wr-ep"><b>#${ex.from.n}</b><span>${fmtDate(ex.from.date)}</span></div>
          <div class="wr-pair-mid">${art(ex.song.artist.name, 'sm')}<b>${ex.song.title}</b><span>${ex.song.artist.name}</span></div>
          <div class="wr-ep"><b>#${ex.to.n}</b><span>${fmtDate(ex.to.date)}</span></div>
        </div>
        ${line(r.length === 1 ? `Once, in ${plural(st.all ? st.regularTotal : st.regular, 'regular show')}. ${isDM(ex.song.artist) ? 'Of course it was Depeche Mode.' : 'Nobody noticed. We noticed.'}` : `The latest: ${ex.song.title}, #${ex.from.n} and #${ex.to.n}.`, 4)}`
      : line(`Not once in ${plural(st.regular, 'regular show')}. The rule held all year.`, 3)}
    </div>`,
  };
}

// ---------------------------------------------------------------- 9. played once
function once(st) {
  const o = st.once;
  if (!o.of) return null;
  const lit = Math.round(o.share * 100);
  return {
    id: 'once', theme: 'onair', dur: 8000, label: 'Songs played only once',
    html: html`<div class="wr-c">
      ${kicker('One night only')}
      <div class="wr-big wr-in" style="${W(1)}">${num(Math.round(o.share * 100), { suffix: '%' })}</div>
      <h2 class="wr-h wr-in" style="${W(2)}">of the songs ${st.all ? '' : `played in ${st.year} `}were played exactly once${st.all ? '' : ', ever'}</h2>
      <div class="wr-dots wr-in" style="${W(3)}" aria-hidden="true">${Array.from({ length: 100 }, (_, i) => html`<i class="${i < lit ? 'on' : ''}" style="--d:${(i < lit ? i : 0) * 14}ms"></i>`)}</div>
      ${line(html`${fmt(o.n)} of ${fmt(o.of)} songs. One and done: <i>a fost odată</i>.`, 4)}
    </div>`,
  };
}

// ---------------------------------------------------------------- 10. openers & closers
function openClose(st) {
  const o = st.openers.artists[0], c = st.closers.artists[0];
  if (!o || !c) return null;
  const os = st.openers.songs.filter((x) => x.n === st.openers.songs[0].n);
  const ties = (list) => list.filter((x) => x.n === list[0].n).length - 1;
  const panel = (k, ic, x, list, i) => html`<div class="wr-oc wr-in" style="${W(i)}">
    <div class="wr-oc-k">${icon(ic)} ${k}</div>
    <div class="wr-oc-b">${art(x.artist.name)}<div><b>${x.artist.name}</b><span>${plural(x.n, 'show')}${ties(list) ? ` · tied with ${ties(list)} more` : ''}</span></div></div></div>`;
  return {
    id: 'openclose', theme: 'ink', dur: 8000, label: 'Top opener and closer',
    html: html`<div class="wr-c">
      ${kicker('First song, last song')}
      <h2 class="wr-h wr-in" style="${W(1)}">${o.artist.name} at the door, ${c.artist.name} on the lights</h2>
      ${panel('Opens the show', 'play', o, st.openers.artists, 2)}
      ${panel('Closes the show', 'moon', c, st.closers.artists, 3)}
      ${os[0] && os[0].n > 1 ? line(html`Favourite first song: ${os.slice(0, 2).map((x, i) => html`${i ? ' and ' : ''}<b>${x.song.title}</b>`)} (${plural(os[0].n, 'time')}${os.length > 1 ? ' each' : ''}).`, 4) : line('No song opened two shows. Every night a new door.', 4)}
    </div>`,
  };
}

// ---------------------------------------------------------------- 11. specials gallery
function specials(st) {
  const sp = st.specials;
  if (!sp.length) return null;
  const longest = sp.reduce((m, e) => (e.tracks.length > m.tracks.length ? e : m));
  return {
    id: 'specials', theme: 'violet', dur: 9000, label: `${sp.length} specials`,
    html: html`<div class="wr-c">
      ${kicker('Theme nights')}
      <div class="wr-big wr-mid wr-in" style="${W(1)}">${num(sp.length)}</div>
      <h2 class="wr-h wr-in" style="${W(2)}">${sp.length === 1 ? 'special' : 'specials'}${sp.length > 1 ? `, from ${sp[0].special} to ${sp.at(-1).special}` : `: ${sp[0].special}`}</h2>
      <ul class="wr-gallery ${sp.length > 9 ? 'dense' : ''}" aria-label="Specials">
        ${sp.map((e, i) => html`<li class="wr-in" style="--i:${3 + Math.min(i, 14) * 0.35};--h:${hue(e.special)}"><b>${e.special.replace(/\s*\(.*\)$/, '')}</b><span>#${e.n} · ${e.year}</span></li>`)}
      </ul>
      ${line(`The biggest: ${longest.special}, ${plural(longest.tracks.length, 'track')} (#${longest.n}).`, 9)}
    </div>`,
  };
}

// ---------------------------------------------------------------- 12. busiest year / longest night
function busiest(st) {
  if (st.all) {
    const rows = st.perYear, b = st.busiest;
    const max = Math.max(...rows.map((r) => r.plays));
    return {
      id: 'busiest', theme: 'amber', dur: 8000, label: `Busiest year: ${b.year}`,
      html: html`<div class="wr-c">
        ${kicker('The busiest year')}
        <div class="wr-big wr-in" style="${W(1)}"><span class="wr-num" style="--ch:4">${b.year}</span></div>
        <h2 class="wr-h wr-in" style="${W(2)}">${fmt(b.plays)} songs in ${plural(b.episodes, 'show')}</h2>
        <div class="wr-cols wr-in" style="${W(3)}" role="img" aria-label="Songs played per year: ${rows.map((r) => `${r.year} ${r.plays}`).join(', ')}">
          ${rows.map((r, i) => html`<div class="${r.year === b.year ? 'hot' : ''}"><em>${fmt(r.plays)}</em><i style="--h:${(r.plays / max).toFixed(3)};--d:${i * 90}ms"></i><span>${r.year}</span></div>`)}
        </div>
        ${line(busyLine(st), 4)}
      </div>`,
    };
  }
  const L = st.longestNight, rows = st.perEpisode;
  const max = Math.max(...rows.map((r) => r.n));
  return {
    id: 'busiest', theme: 'amber', dur: 8000, label: `Longest night of ${st.year}`,
    html: html`<div class="wr-c">
      ${kicker(`The longest night of ${st.year}`)}
      <div class="wr-big wr-in" style="${W(1)}">${num(L.tracks.length)}</div>
      <h2 class="wr-h wr-in" style="${W(2)}">songs in #${L.n}${L.special ? `, ${L.special}` : ''}</h2>
      <div class="wr-cols thin wr-in" style="${W(3)}" role="img" aria-label="Songs per show in ${st.year}, longest #${L.n} with ${L.tracks.length}">
        ${rows.map((r, i) => html`<div class="${r.ep === L ? 'hot' : ''}"><i style="--h:${(r.n / max).toFixed(3)};--d:${Math.min(i, 52) * 18}ms"></i></div>`)}
      </div>
      ${line(`${fmtDate(L.date, 'long')}. A regular night that year had about ${(st.plays / st.episodes).toFixed(0)}.`, 4)}
    </div>`,
  };
}

function busyLine(st) {
  const b = st.busiest, rest = st.perYear.filter((r) => r !== b).sort((x, y) => y.plays - x.plays);
  const r2 = rest[0];
  const gap = r2 ? b.plays - r2.plays : 0;
  const lead = !r2 ? '' : gap <= 10 ? `Photo finish: just ${plural(gap, 'song')} ahead of ${r2.year}. ` : `${plural(gap, 'song')} clear of ${r2.year}. `;
  return `${lead}${b.episodes >= 50 ? 'Barely a Monday off all year.' : `About ${(b.plays / b.episodes).toFixed(0)} songs a night.`}`;
}

// ---------------------------------------------------------------- 13. countdown to #400
function countdown(st) {
  const cd = st.countdown;
  const from = Math.max(cd.left, cd.target - st.archive.first.n);
  return {
    id: 'countdown', theme: 'onair', dur: 8000, label: cd.left ? `${cd.left} to #400` : '#400 is here',
    html: html`<div class="wr-c">
      ${kicker('The countdown')}
      ${cd.left ? html`
        <div class="wr-big wr-in" style="${W(1)}">${num(cd.left, { down: from })}</div>
        <h2 class="wr-h wr-in" style="${W(2)}">${cd.left === 1 ? 'Monday' : 'Mondays'} to #400</h2>
        ${cd.upcoming.length && cd.upcoming.length === cd.left ? html`<ol class="wr-mondays wr-in" style="${W(3)}" aria-label="Upcoming shows">
          ${cd.upcoming.map((u, i) => html`<li class="${u.n === cd.target ? 'goal' : ''}" style="--d:${i * 80}ms"><b>${u.n === cd.target ? '400' : u.n}</b><span>${fmtDate(u.date).replace(/ \d{4}$/, '')}</span></li>`)}
        </ol>` : html`<div class="wr-prog wr-in" style="${W(3)}"><i style="--w:${cd.progress.toFixed(4)}"></i></div>`}
        ${line(html`Est. <b>${fmtDate(cd.date, 'day')}, 21:00</b>, if the weekly beat holds. <i>Hai că mai e puțin.</i>`, 4)}`
      : html`
        <div class="wr-big wr-in" style="${W(1)}"><span class="wr-num" style="--ch:4">#400</span></div>
        <h2 class="wr-h wr-in" style="${W(2)}">is on air. La mulți ani, Piticu Dejun!</h2>`}
    </div>`,
  };
}

// ---------------------------------------------------------------- 14. finale
function finale(st) {
  const left = st.countdown.left;
  return {
    id: 'finale', theme: 'finale', dur: 0, label: 'See you at #400',
    html: html`<div class="wr-c wr-c-fin">
      <div class="wr-lamp wr-in" style="${W(0)}"><span class="dot" aria-hidden="true"></span>${st.all ? 'Piticu Wrapped' : `Piticu Wrapped ${st.year}`}</div>
      <h2 class="wr-h wr-fin wr-in" style="${W(1)}">${left ? html`See you<br>at <span class="grad">#400</span>` : html`Happy<br><span class="grad">#400</span>`}</h2>
      <p class="wr-ro wr-in" style="${W(2)}">Ne auzim luni.</p>
      <div class="wr-card wr-in" style="${W(3)}">
        <div><b>${fmt(st.episodes)}</b><span>shows</span></div>
        <div><b>${fmt(st.plays)}</b><span>songs</span></div>
        <div><b>${st.dm.streak}</b><span>DM in a row</span></div>
        <div><b>${st.topArtists[0] ? st.topArtists[0].artist.name : '–'}</b><span>top artist</span></div>
        <p>#${st.first.n} → #${st.last.n} · ${periodLabel(st)} · Mondays 21:00</p>
      </div>
      <div class="wr-ctas wr-in" style="${W(4)}">
        <a class="wr-btn primary" href="#/">Explore the archive ${icon('right')}</a>
        <button type="button" class="wr-btn" data-replay>Watch again</button>
      </div>
    </div>`,
  };
}

export const builders = [intro, totals, topSong, dm, artists, freshness, comeback, repeat, once, openClose, specials, busiest, countdown, finale];
export const buildSlides = (st) => builders.map((b) => b(st)).filter(Boolean);
