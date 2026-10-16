// #/setlist — the #400 set builder: Radu's planner and on-air cue sheet.
// Build a running order from the archive (or free text), see warnings per song, take suggestions,
// share it with Dan as a link or as "01. artist - song" text, then run the show in on-air mode.
import * as D from '../data.js';
import { html, raw, plural, fmtDate, href, icon, cover, pageHead, listenUrl, hydrate, setQuery } from '../ui.js';
import { syncPreviewButtons } from '../preview.js';
import * as S from './setlist/store.js';
import * as I from './setlist/insights.js';
import { want, durationOf, onDuration, cancel as cancelDur, mmss } from './setlist/duration.js';
import { sortable } from './setlist/drag.js';
import { createOnAir } from './setlist/onair.js';
import { si } from './setlist/icons.js';

function ensureCss() {
  if (document.querySelector('link[data-setlist-css], link[href$="css/setlist.css"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = 'css/setlist.css'; l.dataset.setlistCss = '';
  document.head.append(l);
}

const pad2 = (n) => String(n).padStart(2, '0');
const badgeHtml = (list) => list.map((b) => html`<span class="sl-b ${b.tone}">${b.tone === 'new' ? si('sun', 'ic') : ''}${b.text}</span>`);

export default {
  title: () => 'Set builder',
  render(root, { db, query, path }) {
    ensureCss();
    const cx = I.context(db);
    let st = S.load();
    let shared = query.get('s') != null ? { items: S.decode(db, query.get('s')), name: query.get('n') || 'Shared set' } : null;
    let openRow = null, toastTimer = 0, surpriseSong = null;
    const cleanups = [];

    const set = () => S.current(st);
    const persist = () => S.save(st);
    const rowsOf = (items) => items.map((it) => S.resolve(db, it));
    const inSetKeys = () => new Set(rowsOf(set().items).map((r) => r.key));
    const msOf = (r) => durationOf(r.artist, r.title);
    const plannedMs = (rows) => rows.reduce((t, r) => t + (msOf(r) || S.DEFAULT_SONG_SEC * 1000), 0);
    const until400 = cx.countdown.left ? `${plural(cx.countdown.left, 'show')} to go · ` : '';

    root.innerHTML = String(html`<div class="v-setlist">
      ${pageHead({ kicker: html`<span class="sl-kick"><span class="dot" aria-hidden="true"></span>Episode #400 · ${fmtDate(cx.countdown.date, 'day')}</span>`,
        title: 'Set builder', sub: `${until400}Pick about ${S.TARGET_SONGS} songs for an hour on air, check when each was last played, then run the night from your phone.` })}
      <div class="sl-setbar" id="sl-setbar"></div>
      <div id="sl-shared"></div>
      <div class="sl-grid">
        <div class="sl-main">
          <section class="sl-sum card" id="sl-sum" aria-label="Set length"></section>
          <div class="sl-add">
            <form class="searchbox sl-search" role="search" onsubmit="return false">
              ${icon('search')}
              <label class="sr-only" for="sl-q">Add a song: search the archive, or type Artist – Song</label>
              <input id="sl-q" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"
                placeholder="Search, or type Artist – Song" aria-controls="sl-results">
              <button type="button" class="sl-clear" data-act="clear" aria-label="Clear search" hidden>${si('x')}</button>
            </form>
            <div id="sl-results" class="sl-results" aria-live="polite"></div>
          </div>
          <div id="sl-hints"></div>
          <section aria-labelledby="sl-h-list" class="sl-listwrap">
            <h2 class="sr-only" id="sl-h-list">Running order</h2>
            <div id="sl-list"></div>
          </section>
          <div id="sl-out"></div>
        </div>
        <aside class="sl-side" id="sl-side" aria-label="Suggestions"></aside>
      </div>
    </div>`);
    // The toast and the cue sheet live on <body>, outside .app, so presenter-mode zoom and the page
    // transition snapshot of <main> never touch them.
    document.querySelectorAll('.sl-host').forEach((h) => h.remove());
    const host = document.createElement('div');
    host.className = 'v-setlist sl-host';
    host.innerHTML = `<div class="sl-toast" id="sl-toast" role="status" aria-live="polite" hidden></div>
      <div class="sl-air" id="sl-air" hidden role="dialog" aria-modal="true" aria-label="On-air cue sheet"></div>`;
    document.body.append(host);

    const $ = (s) => root.querySelector(s);
    const input = $('#sl-q'), resultsEl = $('#sl-results'), listEl = $('#sl-list');

    // ------------------------------------------------------------ rows
    function rowHtml(r, i, rows, { ro = false, played = false } = {}) {
      const st2 = r.song ? D.songStats(r.song) : null;
      const ms = msOf(r);
      const meta = [r.inArchive ? `${plural(st2.n, 'play')} · last #${st2.last.n}` : 'Not in the archive', ms ? mmss(ms) : null].filter(Boolean).join(' · ');
      const fake = { title: r.title, artist: { name: r.artist } };
      const b = I.badges(cx, r, rows);
      const name = `${r.title} by ${r.artist}`;
      return html`<li class="sl-row ${played ? 'played' : ''} ${openRow === r.item.id ? 'open' : ''} ${ro ? 'ro' : ''}" ${ro ? '' : raw(`data-i="${i}"`)} data-id="${r.item.id || ''}">
        ${ro ? html`<span class="sl-grip ro"><span class="sl-n">${pad2(i + 1)}</span></span>`
          : html`<button type="button" class="sl-grip" data-act="grip" aria-label="Track ${i + 1}: ${name}. Drag, or press the arrow keys, to move it">
          <span class="sl-n">${played ? si('check', 'ic') : pad2(i + 1)}</span>${si('grip', 'ic g')}</button>`}
        ${cover(r.artist, { song: fake })}
        <div class="tt">
          <div class="s">${r.inArchive ? html`<a href="${href.song(r.song)}">${r.title}</a>` : r.title}</div>
          <div class="a"><b>${r.artist}</b></div>
          <div class="m sl-meta">${meta}</div>
          ${b.length ? html`<div class="sl-badges">${badgeHtml(b)}</div>` : ''}
        </div>
        ${ro ? html`<a class="lb sp" href="${listenUrl.spotify(r.artist, r.title)}" target="_blank" rel="noopener" aria-label="Play ${name} on Spotify (opens new tab)">${icon('sp')}</a>`
          : html`<button type="button" class="lb sl-more" data-act="more" aria-expanded="${openRow === r.item.id}" aria-label="Options for ${name}">${icon('more')}</button>
          <div class="sl-acts">
            <button type="button" class="sl-a" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move ${r.title} up">${si('up')}<span>Up</span></button>
            <button type="button" class="sl-a" data-act="down" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Move ${r.title} down">${si('down')}<span>Down</span></button>
            <a class="sl-a sp" href="${listenUrl.spotify(r.artist, r.title)}" target="_blank" rel="noopener" aria-label="Play ${name} on Spotify (opens new tab)">${icon('sp')}<span>Spotify</span></a>
            <a class="sl-a yt" href="${listenUrl.ytmusic(r.artist, r.title)}" target="_blank" rel="noopener" aria-label="Play ${name} on YouTube Music (opens new tab)">${icon('yt')}<span>YouTube</span></a>
            <button type="button" class="sl-a del" data-act="remove" aria-label="Remove ${r.title} from the set">${si('trash')}<span>Remove</span></button>
          </div>`}
      </li>`;
    }

    // ------------------------------------------------------------ sections
    function drawSetbar() {
      const s = set();
      $('#sl-setbar').innerHTML = String(html`
        <label class="sl-sel"><span class="micro">Set</span>
          <select id="sl-sel" aria-label="Choose a set">${st.sets.map((x) => html`<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${x.name} · ${x.items.length}</option>`)}</select>
          ${icon('right', 'ic chev')}</label>
        <button type="button" class="icon-btn" data-act="rename" aria-label="Rename this set">${si('edit')}</button>
        <button type="button" class="icon-btn" data-act="new" aria-label="Start a new set">${si('plus')}</button>
        <button type="button" class="icon-btn" data-act="delset" aria-label="Delete this set">${si('trash')}</button>`);
    }

    function drawSummary(rows) {
      const n = rows.length, ms = plannedMs(rows), min = Math.round(ms / 60000);
      const known = rows.filter((r) => msOf(r)).length;
      const over = min > S.TARGET_MIN + 3, left = S.TARGET_SONGS - n;
      const ids = new Set(set().items.map((x) => x.id));
      const played = (set().air?.played || []).filter((x) => ids.has(x)).length;
      const cap = !n ? `Aim for about ${S.TARGET_SONGS} songs and ${S.TARGET_MIN} minutes.`
        : `${left > 0 ? `${plural(left, 'song')} to go` : left === 0 ? 'Right on target' : `${plural(-left, 'song')} over the usual ${S.TARGET_SONGS}`} · ${
          known === n ? 'lengths from Apple Music' : known ? `${known} of ${n} lengths from Apple Music, the rest guessed at 4 min` : 'guessing 4 min a song'}`;
      $('#sl-sum').innerHTML = String(html`
        <div class="sl-sum-top">
          <div class="sl-fig"><span class="micro">Songs</span><b class="num">${n}<small>/ ${S.TARGET_SONGS}</small></b></div>
          <div class="sl-fig ${over ? 'over' : ''}"><span class="micro">Runtime</span><b class="num">${n ? '~' : ''}${min}<small>/ ${S.TARGET_MIN} min</small></b></div>
          <button type="button" class="btn primary sl-go" data-act="air" ${n ? '' : 'disabled'}><span class="dot" aria-hidden="true"></span>On air</button>
        </div>
        <div class="sl-meters" aria-hidden="true">
          <span class="sl-m"><i style="--w:${Math.min(1, n / S.TARGET_SONGS).toFixed(3)}"></i></span>
          <span class="sl-m ${over ? 'over' : ''}"><i style="--w:${Math.min(1, ms / (S.TARGET_MIN * 60000)).toFixed(3)}"></i></span>
        </div>
        <p class="sl-cap">${cap}</p>
        ${played ? html`<div class="sl-reset"><span>${si('check')}${played} of ${n} played on air</span>
          <button type="button" class="btn" data-act="reset-air">Reset</button></div>` : ''}`);
    }

    function drawHints(rows) {
      const h = $('#sl-hints');
      if (!rows.length) { h.innerHTML = ''; return; }
      const dm = I.dmHint(cx, rows);
      const share = Math.round(cx.dmSlotShare * 100);
      if (dm.kind === 'ok') { h.innerHTML = ''; return; }
      if (dm.kind === 'move') {
        h.innerHTML = String(html`<div class="sl-hint">${icon('dm')}
          <p><b>Depeche Mode slot.</b> DM is at track ${dm.at + 1}. On the show it most often lands at track ${cx.dmSlot} (${share}% of DM plays).</p>
          <button type="button" class="btn" data-act="dm-move" data-from="${dm.at}">Move to ${cx.dmSlot}</button></div>`);
        return;
      }
      const picks = I.dmPicks(cx, inSetKeys());
      h.innerHTML = String(html`<div class="sl-hint">${icon('dm')}
        <div><p><b>Depeche Mode slot.</b> No DM yet. On the show DM most often lands at track ${cx.dmSlot} (${share}% of DM plays). Add one there:</p>
        <div class="sl-picks">${picks.map((s) => html`<button type="button" class="chip" data-act="add-dm" data-k="${s.key}">${si('plus')} ${s.title}</button>`)}</div></div></div>`);
    }

    function drawList(rows) {
      if (!rows.length) {
        listEl.innerHTML = String(html`<div class="sl-empty rv">
          <div class="sl-empty-art" aria-hidden="true"><span class="num grad-text">#400</span>
            <div class="eq">${[...Array(9)].map((_, i) => html`<i style="--d:${1.2 + (i % 4) * 0.35}s;--dl:-${i * 0.21}s;--hi:${0.55 + ((i * 37) % 45) / 100}"></i>`)}</div></div>
          <h2>The studio is yours.</h2>
          <p>Dan is handing you the mic for episode #400. Search the archive above, type a song the show has never played as <b>Artist – Song</b>, or let the archive pick one.</p>
          <div class="sl-empty-acts">
            <button type="button" class="btn primary" data-act="surprise-add">${si('dice')} Surprise me</button>
            <button type="button" class="btn" data-act="focus">${icon('search')} Search songs</button>
          </div></div>`);
        hydrate(listEl);
        return;
      }
      const played = new Set(set().air?.played || []);
      listEl.innerHTML = String(html`<ol class="sl-list" aria-label="Running order, ${plural(rows.length, 'song')}">
        ${rows.map((r, i) => rowHtml(r, i, rows, { played: played.has(r.item.id) }))}</ol>
        <p class="sl-tip">${si('grip')} Long-press a song to drag it, or use ⋯ to move it up or down.</p>`);
      const ol = listEl.querySelector('.sl-list');
      cleanups.push(sortable(ol, { onDrop: (from, to) => move(from, to, true), onStart: () => { openRow = null; } }));
    }

    function drawOut(rows) {
      const out = $('#sl-out');
      if (!rows.length) { out.innerHTML = ''; return; }
      const canShare = !!navigator.share && matchMedia('(pointer: coarse)').matches;
      out.innerHTML = String(html`<section class="sl-out card pad" aria-labelledby="sl-h-out">
        <div class="micro" id="sl-h-out">Send it to Dan</div>
        <div class="sl-out-acts">
          <button type="button" class="btn" data-act="copy-link">${si('link')} Copy link</button>
          <button type="button" class="btn" data-act="copy-text">${si('copy')} Copy as text</button>
          ${canShare ? html`<button type="button" class="btn" data-act="share">${si('share')} Share</button>` : ''}
        </div>
        <details class="sl-text"><summary>Preview the text</summary><pre>${S.asText(db, set())}</pre></details>
        <p class="credit">The text matches Dan's Facebook posts, so it pastes straight into add_episode.py. There is no "export to Spotify": that needs Spotify's API and a login, which a static fan site can't do. Every song has a Spotify button instead.</p>
      </section>`);
    }

    function suggestRow(x) {
      const inSet = inSetKeys().has(x.song.key);
      return html`<li class="row no-rank sl-sug">
        ${cover(x.song.artist.name, { song: x.song })}
        <div class="tt"><div class="s"><a href="${href.song(x.song)}">${x.song.title}</a></div>
          <div class="a"><b>${x.song.artist.name}</b></div><div class="m">${x.meta}</div></div>
        <button type="button" class="lb sl-addbtn ${inSet ? 'on' : ''}" data-act="add" data-k="${x.song.key}" ${inSet ? 'disabled' : ''}
          aria-label="${inSet ? `${x.song.title} is in the set` : `Add ${x.song.title} by ${x.song.artist.name} to the set`}">${si(inSet ? 'check' : 'plus')}</button>
      </li>`;
    }

    function drawSide() {
      const keys = inSetKeys();
      if (!surpriseSong || keys.has(surpriseSong.song.key)) surpriseSong = I.surprise(cx, keys);
      const g = I.gems(cx, keys), f = I.favourites(cx, keys);
      $('#sl-side').innerHTML = String(html`
        <section class="sl-card sl-surprise">
          <div class="sl-card-h"><div><div class="micro">${si('dice', 'ic')} Surprise me</div><h2>Let the archive pick</h2></div>
            <button type="button" class="icon-btn" data-act="reroll" aria-label="Pick another random song">${si('restart')}</button></div>
          <p class="sl-card-cap">Random, weighted toward songs that haven't been on air for a while.</p>
          ${surpriseSong ? html`<ol class="rank">${suggestRow(surpriseSong)}</ol>` : ''}
        </section>
        <section class="sl-card">
          <div class="sl-card-h"><div><div class="micro">${si('gem', 'ic')} Forgotten gems</div><h2>Staples gone quiet</h2></div></div>
          <p class="sl-card-cap">Played six times or more, then nothing for the longest.</p>
          <ol class="rank">${g.map(suggestRow)}</ol>
        </section>
        <section class="sl-card">
          <div class="sl-card-h"><div><div class="micro">${si('heart', 'ic')} Fan favourites</div><h2>The all-time greats</h2></div></div>
          <p class="sl-card-cap">Most played (Depeche Mode aside), none heard in the last ten shows.</p>
          <ol class="rank">${f.map(suggestRow)}</ol>
        </section>`);
      syncPreviewButtons();
    }

    function drawShared() {
      const el = $('#sl-shared');
      if (!shared) { el.innerHTML = ''; return; }
      const rows = rowsOf(shared.items.map((it, i) => ({ ...it, id: 'sh' + i })));
      const ms = plannedMs(rows);
      want(rows.map((r) => ({ artist: r.artist, song: r.title })));
      el.innerHTML = String(html`<section class="sl-shared" aria-labelledby="sl-h-shared">
        <div class="sl-shared-h">
          <div><div class="micro">${si('link', 'ic')} Shared with you</div>
            <h2 id="sl-h-shared">${shared.name}</h2>
            <p class="muted">${plural(rows.length, 'song')} · ~${Math.round(ms / 60000)} min</p></div>
          <div class="sl-shared-acts">
            <button type="button" class="btn primary" data-act="import" ${rows.length ? '' : 'disabled'}>${si('plus')} Import</button>
            <button type="button" class="btn" data-act="dismiss">Dismiss</button>
          </div>
        </div>
        ${rows.length ? html`<ol class="sl-list ro">${rows.map((r, i) => rowHtml(r, i, rows, { ro: true }))}</ol>`
          : html`<p class="muted">This link has no songs we could read.</p>`}
      </section>`);
    }

    // ------------------------------------------------------------ search
    function drawResults() {
      const q = input.value.trim();
      $('.sl-clear').hidden = !q;
      if (!q) { resultsEl.innerHTML = ''; resultsEl.classList.remove('on'); return; }
      const keys = inSetKeys();
      const free = S.parseFree(q);
      const r = D.search(db, q, { songs: 8, artists: 0, episodes: 0 });
      let songs = r.songs;
      if (!songs.length && free) songs = D.search(db, `${free.a} ${free.t}`, { songs: 8, artists: 0, episodes: 0 }).songs;
      const exact = free && S.findSong(db, free.a, free.t);
      const rows = songs.map((x) => {
        const inSet = keys.has(x.song.key);
        return html`<li><button type="button" class="sl-res ${inSet ? 'on' : ''}" data-act="add" data-k="${x.song.key}" ${inSet ? 'aria-disabled="true"' : ''}>
          ${cover(x.song.artist.name)}
          <span class="tt"><span class="s">${x.song.title}</span><span class="a"><b>${x.song.artist.name}</b> · ${plural(x.n, 'play')} · last #${x.last.n}</span></span>
          <span class="sl-plus" aria-hidden="true">${si(inSet ? 'check' : 'plus')}</span>
          <span class="sr-only">${inSet ? 'already in the set' : 'add to the set'}</span></button></li>`;
      });
      const freeRow = free && !exact ? html`<li><button type="button" class="sl-res free" data-act="add-free">
          <span class="cover sl-free-cover" aria-hidden="true">${si('sun')}</span>
          <span class="tt"><span class="s">${free.t}</span><span class="a"><b>${free.a}</b> · add as never played</span></span>
          <span class="sl-plus" aria-hidden="true">${si('plus')}</span></button></li>` : '';
      resultsEl.innerHTML = String(html`<ul class="sl-res-list" aria-label="Search results">${freeRow}${rows}</ul>
        ${!free && songs.length < 3 ? html`<p class="sl-res-hint">Not in the archive? Type it as <b>Artist – Song</b> to add it as never played.</p>` : ''}
        ${!songs.length && !free ? html`<p class="sl-res-hint">Nothing in the archive matches “${q}”.</p>` : ''}`);
      resultsEl.classList.add('on');
    }

    // ------------------------------------------------------------ actions
    function redraw({ side = true, setbar = true } = {}) {
      const rows = rowsOf(set().items);
      while (cleanups.length) cleanups.pop()();
      if (setbar) drawSetbar();
      drawSummary(rows); drawHints(rows); drawList(rows); drawOut(rows);
      if (side) drawSide();
      if (input.value.trim()) drawResults();
      syncPreviewButtons();
      want(rows.map((r) => ({ artist: r.artist, song: r.title })));
      if (air.isOpen) air.render();
    }

    function add(item, { at = null, quiet = false } = {}) {
      const s = set();
      const r = S.resolve(db, item);
      if (rowsOf(s.items).some((x) => x.key === r.key)) { toast(`${r.title} is already in the set`); return; }
      const it = r.song ? { id: S.uid(), k: r.song.key } : { id: S.uid(), a: item.a, t: item.t };
      if (at != null && at <= s.items.length) s.items.splice(at, 0, it); else s.items.push(it);
      persist();
      redraw();
      if (!quiet) toast(`Added ${r.title}${r.inArchive ? '' : ' · never played on the show'}`);
      requestAnimationFrame(() => listEl.querySelector(`[data-id="${it.id}"]`)?.classList.add('flash'));
    }

    function move(from, to, dragged = false) {
      const items = set().items;
      if (to < 0 || to >= items.length || from === to) return;
      const [it] = items.splice(from, 1);
      items.splice(to, 0, it);
      persist();
      redraw({ side: false, setbar: false });
      const row = listEl.querySelector(`[data-id="${it.id}"]`);
      if (row) {
        row.classList.add(dragged ? 'dropped' : 'flash');
        if (!dragged) row.querySelector(`[data-act="${to < from ? 'up' : 'down'}"]:not([disabled])`)?.focus({ preventScroll: true })
          || row.querySelector('[data-act="grip"]')?.focus({ preventScroll: true });
      }
    }

    function remove(i) {
      const s = set();
      const [it] = s.items.splice(i, 1);
      if (!it) return;
      if (s.air) s.air.played = (s.air.played || []).filter((x) => x !== it.id);
      openRow = null;
      persist();
      redraw();
      const name = S.resolve(db, it).title;
      toast(`Removed ${name}`, () => {
        const cur = set();
        if (cur !== s) return;
        cur.items.splice(Math.min(i, cur.items.length), 0, it);
        persist(); redraw();
        listEl.querySelector(`[data-id="${it.id}"]`)?.classList.add('flash');
      });
    }

    function toast(msg, undo = null) {
      const t = host.querySelector('#sl-toast');
      t.innerHTML = String(html`<span>${msg}</span>${undo ? html`<button type="button" class="sl-undo">Undo</button>` : ''}`);
      t.hidden = false;
      requestAnimationFrame(() => t.classList.add('on'));
      clearTimeout(toastTimer);
      t.onclick = (e) => {
        if (!e.target.closest('.sl-undo')) return;
        t.classList.remove('on'); undo?.(); undo = null;
      };
      toastTimer = setTimeout(() => { t.classList.remove('on'); }, undo ? 5000 : 2400);
    }

    async function copyText() {
      const ok = await S.copy(S.asText(db, set()));
      toast(ok ? 'Copied: paste it into a post or add_episode.py' : 'Could not copy. Long-press the text preview instead.');
    }

    // ------------------------------------------------------------ on-air
    const airEl = host.querySelector('#sl-air');
    const air = createOnAir(airEl, {
      getSet: set,
      resolveAll: () => rowsOf(set().items),
      badgesFor: (r, rows) => badgeHtml(I.badges(cx, r, rows)),
      plannedMs,
      persist,
      onCopyText: copyText,
      requestClose: () => air.close(),
      onExit: () => { setQuery(path, {}); redraw({ side: false }); },
    });

    // ------------------------------------------------------------ events
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || !root.contains(b) || airEl.contains(b)) return;
      const act = b.dataset.act;
      const row = b.closest('.sl-row[data-i]');
      const i = row ? +row.dataset.i : -1;
      switch (act) {
        case 'add': if (b.getAttribute('aria-disabled') !== 'true') add({ k: b.dataset.k }); break;
        case 'add-free': { const f = S.parseFree(input.value); if (f) { add(f); input.value = ''; drawResults(); input.focus(); } break; }
        case 'add-dm': add({ k: b.dataset.k }, { at: set().items.length >= cx.dmSlot - 1 ? cx.dmSlot - 1 : null }); break;
        case 'dm-move': move(+b.dataset.from, cx.dmSlot - 1); break;
        case 'clear': input.value = ''; drawResults(); input.focus(); break;
        case 'focus': input.focus(); input.scrollIntoView({ block: 'center', behavior: 'smooth' }); break;
        case 'surprise-add': { const x = I.surprise(cx, inSetKeys()); if (x) add({ k: x.song.key }); break; }
        case 'reroll': surpriseSong = I.surprise(cx, inSetKeys(), surpriseSong?.song.key); drawSide(); hydrate($('#sl-side')); break;
        case 'more': openRow = openRow === row.dataset.id ? null : row.dataset.id;
          listEl.querySelectorAll('.sl-row').forEach((r) => { const on = r.dataset.id === openRow; r.classList.toggle('open', on); r.querySelector('.sl-more')?.setAttribute('aria-expanded', String(on)); });
          break;
        case 'up': move(i, i - 1); break;
        case 'down': move(i, i + 1); break;
        case 'remove': remove(i); break;
        case 'air': clearTimeout(toastTimer); host.querySelector('#sl-toast').classList.remove('on'); if (air.open()) setQuery(path, { air: 1 }); break;
        case 'copy-text': copyText(); break;
        case 'reset-air': set().air = null; persist(); redraw({ side: false }); toast('Show reset: nothing marked as played'); break;
        case 'copy-link': S.copy(S.shareUrl(db, set())).then((ok) => toast(ok ? 'Link copied: send it to Dan' : 'Could not copy the link')); break;
        case 'share': navigator.share({ title: `Piticu Dejun ${set().name}`, text: S.asText(db, set()), url: S.shareUrl(db, set()) }).catch(() => {}); break;
        case 'new': S.newSet(st, 'New set'); persist(); openRow = null; redraw(); startRename(); break;
        case 'rename': startRename(); break;
        case 'delset': {
          const s = set();
          if (s.items.length && !confirm(`Delete “${s.name}” and its ${plural(s.items.length, 'song')}?`)) break;
          S.deleteSet(st, s.id); persist(); redraw(); toast(`Deleted ${s.name}`); break;
        }
        case 'import': {
          const cur = set();
          let s;
          if (!cur.items.length) { s = cur; s.items = shared.items.map((it) => ({ ...it, id: S.uid() })); s.air = null; if (!st.sets.some((x) => x !== cur && x.name === shared.name)) s.name = shared.name; }
          else s = S.newSet(st, shared.name, shared.items);
          persist(); shared = null; setQuery(path, {}); drawShared(); redraw();
          toast(`Imported “${s.name}” · ${plural(s.items.length, 'song')}`); break;
        }
        case 'dismiss': shared = null; setQuery(path, {}); drawShared(); break;
        default: break;
      }
    });

    root.addEventListener('keydown', (e) => {
      const g = e.target.closest?.('[data-act="grip"]');
      if (g && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const i = +g.closest('.sl-row').dataset.i, to = i + (e.key === 'ArrowUp' ? -1 : 1);
        const id = set().items[i]?.id;
        move(i, to);
        listEl.querySelector(`[data-id="${id}"] [data-act="grip"]`)?.focus({ preventScroll: true });
      }
    });

    root.addEventListener('change', (e) => {
      if (e.target.id === 'sl-sel') { st.cur = e.target.value; openRow = null; persist(); redraw(); }
    });

    function startRename() {
      const bar = $('#sl-setbar');
      const s = set();
      bar.innerHTML = String(html`<form class="sl-rename" onsubmit="return false">
        <label class="sr-only" for="sl-name">Set name</label>
        <input id="sl-name" value="${s.name}" maxlength="40" autocomplete="off" enterkeyhint="done">
        <button type="submit" class="btn primary">Save</button></form>`);
      const inp = bar.querySelector('input');
      inp.focus(); inp.select();
      const done = () => { const v = inp.value.trim(); if (v) { s.name = v; persist(); } drawSetbar(); drawOut(rowsOf(s.items)); };
      bar.querySelector('form').addEventListener('submit', done);
      inp.addEventListener('blur', () => setTimeout(() => { if (bar.contains(inp)) done(); }, 120));
      inp.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); drawSetbar(); } });
    }

    input.addEventListener('input', drawResults);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = resultsEl.querySelector('.sl-res:not(.on)');
        if (first) first.click();
      } else if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; drawResults(); }
      else if (e.key === 'ArrowDown') { const f = resultsEl.querySelector('.sl-res'); if (f) { e.preventDefault(); f.focus(); } }
    });
    resultsEl.addEventListener('keydown', (e) => {
      const b = e.target.closest('.sl-res');
      if (!b) return;
      const all = [...resultsEl.querySelectorAll('.sl-res')], i = all.indexOf(b);
      if (e.key === 'ArrowDown') { e.preventDefault(); all[i + 1]?.focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (all[i - 1] || input).focus(); }
    });

    const offDur = onDuration(() => {
      const rows = rowsOf(set().items);
      drawSummary(rows);
      rows.forEach((r) => {
        const m = listEl.querySelector(`[data-id="${r.item.id}"] .sl-meta`);
        const ms = msOf(r);
        if (m && ms && !m.textContent.includes(mmss(ms))) m.textContent += ` · ${mmss(ms)}`;
      });
      if (shared) drawShared();
    });

    // ------------------------------------------------------------ first paint
    drawShared();
    redraw();
    if (query.get('air') && set().items.length) air.open();

    return () => {
      while (cleanups.length) cleanups.pop()();
      offDur(); cancelDur(); clearTimeout(toastTimer);
      air.close(true);
      host.remove();
    };
  },
};
