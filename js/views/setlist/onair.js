// On-air mode: a full-screen, high-contrast cue sheet. Current song huge, "next up" below,
// big listen + preview buttons, Next marks the song as played. Keeps the screen awake.
import { html, icon, listenUrl, cover } from '../../ui.js';
import { syncPreviewButtons, stop as stopPreview } from '../../preview.js';
import { si } from './icons.js';

const pad2 = (n) => String(n).padStart(2, '0');
export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${pad2(m)}:${pad2(s % 60)}`;
}

/**
 * el: the overlay element. api: { getSet(), resolveAll() -> rows, badgesFor(row, rows), persist(),
 *   plannedMs(rows), onExit(), onCopyText() }
 */
export function createOnAir(el, api) {
  let open = false, tickTimer = 0, lock = null, returnFocus = null;

  const set = () => api.getSet();

  async function lockOn() {
    try {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; paintWake(); });
    } catch { lock = null; }
    paintWake();
  }
  function lockOff() { try { lock?.release(); } catch { /* ignore */ } lock = null; }
  function paintWake() {
    const w = el.querySelector('.air-wake');
    if (!w) return;
    w.textContent = lock ? 'Screen stays awake' : 'wakeLock' in navigator ? 'Screen may sleep' : 'Keep your screen on';
    w.classList.toggle('on', !!lock);
  }
  const onVis = () => { if (open && document.visibilityState === 'visible' && !lock) lockOn(); };

  function paintClock() {
    const t = el.querySelector('#air-t');
    const air = set().air;
    if (t && air) t.textContent = clock((air.end || Date.now()) - air.start);
  }

  function render() {
    const s = set();
    const rows = api.resolveAll();
    const air = s.air;
    const pos = Math.min(air.pos, rows.length);
    const now = rows[pos], next = rows[pos + 1];
    const planned = api.plannedMs(rows);
    const segs = rows.map((r, i) => html`<i class="${i < pos ? 'done' : i === pos ? 'now' : ''}"></i>`);
    const fake = (r) => ({ title: r.title, artist: { name: r.artist } });

    const btn = (cls, url, ic, label, sub) => html`<a class="air-btn ${cls}" href="${url}" target="_blank" rel="noopener"
      aria-label="${label} (opens new tab)">${icon(ic)}<span>${sub}</span></a>`;

    el.innerHTML = String(html`<div class="air-in ${now ? '' : 'wrap'}">
      <header class="air-top">
        <span class="onair"><span class="dot" aria-hidden="true"></span>On air</span>
        <div class="air-clock" aria-label="Time since show start"><b id="air-t">00:00</b><span>of ~${Math.round(planned / 60000)} min</span></div>
        <button type="button" class="icon-btn air-x" data-air="exit" aria-label="Exit on-air mode">${icon('close')}</button>
      </header>
      <div class="air-prog" aria-hidden="true">${segs}</div>
      ${now ? html`
      <section class="air-now" aria-live="polite">
        <div class="air-k"><span class="micro">Now playing</span><span class="air-pos"><b>${pad2(pos + 1)}</b> / ${pad2(rows.length)}</span></div>
        <h2 class="air-title" id="air-title">${now.title}</h2>
        <p class="air-artist">${now.artist}</p>
        <div class="air-badges">${api.badgesFor(now, rows)}</div>
        <div class="air-acts">
          <button type="button" class="air-btn pv air-pv" data-preview data-artist="${now.artist}" data-song="${now.title}"
            aria-label="Play a 30-second preview of ${now.title} by ${now.artist}">
            ${icon('play', 'ic i-play')}${icon('stop', 'ic i-stop')}<span class="t-idle">Preview 30s</span><span class="t-busy">Stop</span></button>
          ${btn('sp', listenUrl.spotify(now.artist, now.title), 'sp', `Play ${now.title} by ${now.artist} on Spotify`, 'Spotify')}
          ${btn('yt', listenUrl.ytmusic(now.artist, now.title), 'yt', `Play ${now.title} by ${now.artist} on YouTube Music`, 'YouTube')}
          ${btn('am', listenUrl.apple(now.artist, now.title), 'am', `Open ${now.title} by ${now.artist} in Apple Music`, 'Apple Music')}
        </div>
      </section>
      <section class="air-next" aria-label="Next up">
        ${next ? html`${cover(next.artist, { song: fake(next) })}
          <div class="tt"><div class="micro">Next up · ${pad2(pos + 2)}</div><div class="s">${next.title}</div><div class="a">${next.artist}</div></div>
          <a class="lb sp" href="${listenUrl.spotify(next.artist, next.title)}" target="_blank" rel="noopener" aria-label="Cue ${next.title} on Spotify (opens new tab)">${icon('sp')}</a>`
        : html`<div class="tt"><div class="micro">Next up</div><div class="s">Last song of the night</div><div class="a">Say goodnight, Radu.</div></div>`}
      </section>`
      : html`<section class="air-now air-end">
        <div class="micro">That's a wrap</div>
        <h2 class="air-title">Mulțumesc, Piticu Dejun!</h2>
        <p class="air-artist">${rows.length} songs on air in <b id="air-done">${clock((air.end || Date.now()) - air.start)}</b>.</p>
        <div class="air-acts end">
          <button type="button" class="air-btn" data-air="copy">${si('copy')}<span>Copy as text</span></button>
          <button type="button" class="air-btn" data-air="restart">${si('restart')}<span>Start over</span></button>
        </div>
      </section>`}
      <footer class="air-nav">
        <button type="button" class="air-back" data-air="back" ${pos === 0 ? 'disabled' : ''} aria-label="Back to the previous song">${si('prev')}</button>
        ${now ? html`<button type="button" class="air-go" data-air="next" id="air-go">${pos + 1 === rows.length ? 'Last one · Done' : 'Next'} ${si('next')}<small>marks ${pad2(pos + 1)} as played</small></button>`
          : html`<button type="button" class="air-go" data-air="exit" id="air-go">Done ${si('check')}<small>back to the planner</small></button>`}
      </footer>
      <p class="air-wake" aria-live="polite"></p>
    </div>`);
    paintClock();
    paintWake();
    syncPreviewButtons();
  }

  function go(d) {
    const s = set(), air = s.air, n = s.items.length;
    if (d > 0 && air.pos < n) {
      const id = s.items[air.pos].id;
      if (!air.played.includes(id)) air.played.push(id);
      air.pos++;
      if (air.pos >= n) air.end = Date.now();
    } else if (d < 0 && air.pos > 0) {
      air.pos--;
      const id = s.items[air.pos].id;
      air.played = air.played.filter((x) => x !== id);
      delete air.end;
    } else return;
    stopPreview();
    api.persist();
    render();
    el.querySelector('#air-go')?.focus({ preventScroll: true });
  }

  function onClick(e) {
    const b = e.target.closest('[data-air]');
    if (!b) return;
    const a = b.dataset.air;
    if (a === 'next') go(1);
    else if (a === 'back') go(-1);
    else if (a === 'exit') close();
    else if (a === 'copy') api.onCopyText();
    else if (a === 'restart') { set().air = { start: Date.now(), pos: 0, played: [] }; api.persist(); render(); }
  }
  function onKey(e) {
    if (!open || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { if (!document.getElementById('sheet')?.open) { e.preventDefault(); close(); } }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    else if (e.key === 'Tab') { // keep focus inside the cue sheet
      const f = [...el.querySelectorAll('a[href], button:not([disabled])')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }
  el.addEventListener('click', onClick);

  return {
    get isOpen() { return open; },
    open() {
      const s = set();
      if (!s.items.length) return false;
      if (!s.air || s.air.pos >= s.items.length && s.air.end && Date.now() - s.air.end > 3 * 3600e3) s.air = { start: Date.now(), pos: 0, played: [] };
      s.air.played ||= [];
      api.persist();
      returnFocus = document.activeElement;
      open = true;
      el.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      render();
      requestAnimationFrame(() => el.classList.add('on'));
      clearInterval(tickTimer);
      tickTimer = setInterval(paintClock, 1000);
      document.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', onVis);
      lockOn();
      el.querySelector('#air-go')?.focus({ preventScroll: true });
      return true;
    },
    close(silent = false) {
      if (!open) return;
      open = false;
      clearInterval(tickTimer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      lockOff();
      stopPreview();
      el.classList.remove('on');
      el.hidden = true;
      el.innerHTML = '';
      document.documentElement.style.overflow = '';
      if (!silent) { api.onExit(); returnFocus?.focus?.({ preventScroll: true }); }
    },
    render,
  };
  function close() { api.requestClose(); }
}
