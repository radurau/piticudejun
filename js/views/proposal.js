// #/400 — the proposed playlist for episode #400: twelve songs with the reason for each, a link that
// opens the set in the set builder, and the message for Dan. Counts are read from the archive at
// render time, so they stay right as new episodes are added.
import * as D from '../data.js';
import { html, plural, fmtDate, href, icon, pageHead, secHead, songRow, rankList } from '../ui.js';
import * as S from './setlist/store.js';

const RECENT_EPS = 10;

/** The running order. `why` holds no numbers: the plays and last-played line is computed. */
const PICKS = [
  ['Cage the Elephant', 'In One Ear', 'The first song of the oldest show in the archive.'],
  ['Nirvana', 'In Bloom', 'From that same first show. Nirvana is the most present artist after Depeche Mode.'],
  ['The Vaccines', 'No One Knows', 'One of the most played songs that is not by Depeche Mode.'],
  ['Placebo', "You Don't Care About Us", "Placebo's most played song on the show."],
  ['Stereophonics', 'Dakota', 'Dan has opened the show with it more often than not.'],
  ['Faith No More', 'Land of Sunshine', 'The longest absence in the set.'],
  ['Twenty One Pilots', 'Nico and the Niners', 'Another song from the first archived show, rarely played since.'],
  ['Depeche Mode', 'Everything Counts', 'Nici o emisiune fără Depeche Mode: one of the most played songs on the show, in the slot Dan uses most.'],
  ['Oasis', 'Half the World Away', 'The fourth song from the first archived show; a breather after Depeche Mode.'],
  ['Muse', 'Plug In Baby', 'Lifts the energy back up before the end.'],
  ['Faithless', 'We Come 1', 'More often than not, it has opened or closed the show.'],
  ['The Beatles', 'A Day in the Life', 'The most played Beatles song; its last piano chord ends the hour.'],
];

const SWAPS = [
  ['A premiere in slot 8', 'Home, Waiting for the Night and Master and Servant have never been played in the archive, if a surprise beats the favourite.'],
  ['R.E.M. for Muse in slot 10', 'Imitation of Life: R.E.M. is the one top-ten artist the set leaves out.'],
  ['Your own song in slot 7', 'The weakest pick by the numbers, so the one to give up for a song that has never been on the show.'],
];

function messageFor(db, rows, link) {
  const first = db.aired[0].n, last = db.aired.at(-1).n;
  const dm = rows.find((r) => D.norm(r.artist) === D.DM_KEY);
  const dmPlays = dm?.song ? ` (${dm.song.plays.length} difuzări)` : '';
  const list = rows.map((r, i) => `${String(i + 1).padStart(2, '0')}. ${r.artist} - ${r.title}`).join('\n');
  return `Salut, Dan!

Pentru #400 am pregătit o propunere de playlist, construită din arhiva emisiunii (edițiile #${first}–#${last}). Ideea: „Piticu Dejun într-o oră” – piesele și trupele care au definit emisiunea, dar pe care nu le-ai mai dat de ceva vreme.

${list}

Câteva explicații:
- Începe cu In One Ear, prima piesă din cea mai veche ediție pe care o am în arhivă (#${first}). Din aceeași ediție mai sunt încă trei: In Bloom, Nico and the Niners și Half the World Away.
- Depeche Mode e pe poziția 8, unde îi pui tu cel mai des. ${dm ? dm.title : 'Piesa'} e una dintre cele mai difuzate piese din emisiune${dmPlays}. Nici o emisiune fără Depeche Mode!
- Se termină cu acordul final de pian din A Day in the Life.

Lista e aici, cu ultima difuzare a fiecărei piese:
${link}

E doar o propunere – schimbă ce vrei, emisiunea e a ta. Abia aștept să ne vedem în studio!

Radu`;
}

export default {
  title: () => 'Playlist for #400',
  render(root, { db }) {
    const latest = db.aired.at(-1);
    const recent = new Set(db.aired.slice(-RECENT_EPS).map((e) => e.n));
    const cd = D.countdown(db, 400);
    const items = PICKS.map(([a, t]) => { const s = S.findSong(db, a, t); return s ? { k: s.key } : { a, t }; });
    const rows = items.map((it) => S.resolve(db, it));
    const set = { name: S.DEFAULT_NAME, items };
    const builder = `#/setlist?${new URLSearchParams({ s: S.encode(db, items), n: set.name })}`;
    const message = messageFor(db, rows, `${location.origin}${location.pathname}#/400`);

    const meta = (r, why) => {
      if (!r.song) return html`${why} <b>Never played in the archive.</b>`;
      const last = r.song.plays.at(-1).ep, gap = latest.n - last.n;
      return html`${why} <b>${plural(r.song.plays.length, 'play')}</b> · last on <a href="${href.episode(last)}">#${last.n}</a>${gap ? `, ${plural(gap, 'show')} ago` : ''}${
        recent.has(last.n) ? html` · <b class="hl">played again recently, consider a swap</b>` : ''}`;
    };

    root.innerHTML = String(html`<div class="v-prop">
      ${pageHead({ kicker: `Episode #400 · ${fmtDate(cd.date, 'day')}`, title: 'The show in one hour',
        sub: `A proposed playlist for #400: twelve songs that define the show, drawn from ${plural(db.aired.length, 'archived show')} (#${db.aired[0].n}–#${latest.n}), with Depeche Mode where Dan usually puts them.`,
        back: { href: '#/setlist', label: 'Set builder' } })}
      <p class="prop-acts">
        <a class="btn primary" href="${builder}">${icon('queue')} Open in the set builder</a>
        <button class="btn" type="button" data-copy="list">Copy the list</button>
      </p>
      <section class="sec" aria-labelledby="h-prop-list">
        ${secHead({ kicker: 'Running order', title: 'Twelve songs', id: 'h-prop-list' })}
        ${rankList(rows.map((r, i) => r.song
          ? songRow(r.song, { slot: i + 1, meta: meta(r, PICKS[i][2]) }, i)
          : html`<li class="row rv"><span class="rk slot">${i + 1}</span><span></span><div class="tt"><div class="s">${r.title}</div><div class="a"><b>${r.artist}</b></div><div class="m">${meta(r, PICKS[i][2])}</div></div></li>`),
          { label: 'Proposed running order for episode 400' })}
      </section>
      <section class="sec" aria-labelledby="h-prop-swaps">
        ${secHead({ kicker: 'If you want to change it', title: 'Swaps', id: 'h-prop-swaps' })}
        <div class="card pad rv"><ul class="prop-swaps">${SWAPS.map(([t, d]) => html`<li><b>${t}.</b> ${d}</li>`)}</ul></div>
      </section>
      <section class="sec" aria-labelledby="h-prop-msg">
        ${secHead({ kicker: 'For Dan', title: 'Mesajul', id: 'h-prop-msg' })}
        <div class="card pad rv">
          <pre class="prop-msg" lang="ro" tabindex="0" aria-label="Mesaj pentru Dan">${message}</pre>
          <p><button class="btn" type="button" data-copy="msg">Copy the message</button></p>
        </div>
      </section>
    </div>`);

    const texts = { list: S.asText(db, set), msg: message };
    const onClick = async (e) => {
      const b = e.target.closest('[data-copy]');
      if (!b) return;
      const label = b.dataset.label || (b.dataset.label = b.textContent);
      b.textContent = (await S.copy(texts[b.dataset.copy])) ? 'Copied' : 'Could not copy';
      setTimeout(() => { b.textContent = label; }, 1600);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  },
};
