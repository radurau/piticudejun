// 30-second previews via the iTunes Search API (CORS *), one shared <audio>, plus the
// "more ways to listen" sheet. Everything is delegated on document, so any view can render
// ui.cover(name, { song }) or [data-preview] / [data-listen] buttons and they just work.
import { norm } from './data.js';
import { html, icon, cover, listenUrl, RM } from './ui.js';

const CACHE_DAYS = 30, MISS_DAYS = 7, PER_MINUTE = 18;
const audio = () => document.getElementById('pd-audio');
let current = null; // { key, artist, song, hit }
let raf = 0;
const recent = []; // fetch timestamps, for the ~20/min rate limit

const keyOf = (artist, song) => norm(artist) + '|' + norm(song);
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode / full */ } };

// ---------------------------------------------------------------- iTunes lookup
const clean = (s) => norm(s).replace(/\((feat|ft|with)[^)]*\)|\b(feat|ft)\.? .*$/g, '').replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
const mainArtist = (a) => clean(a).split(/\s*(?:,|&| and | x | feat\.? | ft\.? | with )\s*/)[0].replace(/^the /, '');
const bare = (s) => clean(s).replace(/^the /, '').replace(/[^a-z0-9]+/g, '');

function score(r, artist, song) {
  const ra = bare(r.artistName || ''), na = bare(mainArtist(artist));
  const rt = bare((r.trackName || '').replace(/\(.*?\)|-.*remaster.*$/i, '')), nt = bare(song.replace(/\(.*?\)/g, ''));
  let a = 0;
  if (ra === na) a = 3; else if (ra.includes(na) || na.includes(ra)) a = 2;
  if (!a || !r.previewUrl) return 0;
  const t = rt === nt ? 3 : rt.includes(nt) || nt.includes(rt) ? 1.5 : 0;
  return t ? a + t : 0;
}

/**
 * The cached iTunes answer for a song: { u, v, art, n, ar, ms, t } (u = null for a miss), or undefined
 * when nothing fresh is cached. With needMs, entries saved before track lengths were kept count as stale.
 */
export function cachedLookup(artist, song, { needMs = false } = {}) {
  const c = lsGet('pd:it:' + keyOf(artist, song));
  if (!c || Date.now() - c.t >= (c.u ? CACHE_DAYS : MISS_DAYS) * 864e5) return undefined;
  if (needMs && c.u && !('ms' in c)) return undefined;
  return c;
}

/**
 * Resolve { u: previewUrl, v: trackViewUrl, art, ms: trackTimeMillis } for a song, or null. Cached in
 * localStorage. This is the only place that calls the iTunes Search API, so previews and the set
 * builder's track lengths share one rate limit. Throws Error('rate') when the minute's budget is spent.
 */
export async function lookup(artist, song, { needMs = false } = {}) {
  const k = 'pd:it:' + keyOf(artist, song);
  const c = cachedLookup(artist, song, { needMs });
  if (c) return c.u ? c : null;
  const now = Date.now();
  while (recent.length && now - recent[0] > 60000) recent.shift();
  if (recent.length >= PER_MINUTE) throw new Error('rate');
  recent.push(now);
  const term = `${mainArtist(artist)} ${clean(song)}`;
  const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=5&country=RO`);
  if (!res.ok) throw new Error('http ' + res.status);
  const { results = [] } = await res.json();
  let best = null, bestScore = 0;
  for (const r of results) { const s = score(r, artist, song); if (s > bestScore) { best = r; bestScore = s; } }
  const hit = best && bestScore >= 3.5
    ? { u: best.previewUrl, v: best.trackViewUrl, art: (best.artworkUrl100 || '').replace('100x100bb', '200x200bb'), n: best.trackName, ar: best.artistName, ms: best.trackTimeMillis || null, t: now }
    : { u: null, t: now };
  lsSet(k, hit);
  return hit.u ? hit : null;
}

// ---------------------------------------------------------------- buttons & player
function buttonsFor(key) {
  return [...document.querySelectorAll('[data-preview]')].filter((b) => keyOf(b.dataset.artist, b.dataset.song) === key);
}
function setState(key, state, label) {
  for (const b of buttonsFor(key)) {
    if (state) b.dataset.state = state; else delete b.dataset.state;
    const base = b.dataset.baseLabel || (b.dataset.baseLabel = b.getAttribute('aria-label'));
    b.setAttribute('aria-label', label ? `${label}: ${b.dataset.song}` : base);
    b.setAttribute('aria-pressed', String(state === 'playing'));
  }
}
function ring(key, p) {
  for (const b of buttonsFor(key)) b.querySelector('.pv-ring circle')?.setAttribute('stroke-dashoffset', String(100 - p * 100));
  const mini = document.getElementById('mini');
  mini?.querySelector('.prog')?.style.setProperty('--p', p.toFixed(4));
}
function tick() {
  const a = audio();
  if (!current || a.paused) return;
  ring(current.key, a.duration ? a.currentTime / a.duration : 0);
  raf = requestAnimationFrame(tick);
}

export function stop() {
  const a = audio();
  cancelAnimationFrame(raf);
  if (!current) return;
  a.pause(); a.removeAttribute('src'); a.load();
  const k = current.key;
  current = null;
  ring(k, 0);
  setState(k, null);
  showMini(null);
}

async function play(artist, song) {
  const key = keyOf(artist, song);
  if (current?.key === key) { stop(); return; }
  stop();
  current = { key, artist, song };
  setState(key, 'loading', 'Loading preview');
  let hit;
  try { hit = await lookup(artist, song); }
  catch (e) {
    if (current?.key === key) { current = null; setState(key, null); }
    toast(e.message === 'rate' ? 'Too many previews in a minute. Try again shortly.' : 'Preview service unreachable right now.');
    return;
  }
  if (current?.key !== key) return; // user moved on
  if (!hit) { current = null; setState(key, 'none', 'No preview available'); toast(`No preview found for “${song}”.`); return; }
  current.hit = hit;
  const a = audio();
  a.src = hit.u;
  try { await a.play(); }
  catch { if (current?.key === key) { current = null; setState(key, null); } return; }
  setState(key, 'playing', 'Stop preview');
  showMini(current);
  tick();
}

function showMini(cur) {
  const mini = document.getElementById('mini');
  if (!mini) return;
  if (!cur) { mini.classList.remove('on'); setTimeout(() => { if (!current) mini.hidden = true; }, 320); return; }
  const h = cur.hit;
  mini.innerHTML = String(html`
    <div class="art">${h.art ? html`<img src="${h.art}" alt="" width="44" height="44">` : ''}</div>
    <div class="tt"><div class="s">${cur.song} <span class="muted" style="font-weight:500">· ${cur.artist}</span></div><div class="a credit">Preview via Apple Music</div></div>
    ${h.v ? html`<a class="am-link" href="${h.v}" target="_blank" rel="noopener" aria-label="Open ${cur.song} in Apple Music (opens new tab)">${icon('am')}<span>Apple Music</span></a>` : ''}
    <button type="button" class="icon-btn" data-stop aria-label="Stop preview">${icon('stop')}</button>
    <div class="prog" aria-hidden="true"><i></i></div>`);
  mini.hidden = false;
  requestAnimationFrame(() => mini.classList.add('on'));
}

let toastTimer = 0;
function toast(msg) {
  let t = document.getElementById('pd-toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'pd-toast'; t.className = 'mini'; t.setAttribute('role', 'status');
    t.style.gridTemplateColumns = '1fr'; t.style.padding = '14px 16px';
    document.body.append(t);
  }
  t.textContent = msg; t.hidden = false;
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

/** Re-apply the playing state to freshly rendered buttons (call after each render). */
export function syncPreviewButtons() {
  if (current && !audio().paused) setState(current.key, 'playing', 'Stop preview');
}

// ---------------------------------------------------------------- listen sheet
function openSheet(artist, song, songHref) {
  const d = document.getElementById('sheet');
  const fake = { title: song, artist: { name: artist } };
  d.innerHTML = String(html`<div class="sheet-in">
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="sheet-h">${cover(artist, { song: fake })}
      <div class="tt"><div class="s" id="sheet-title">${song}</div><div class="a">${artist}</div></div>
      <button type="button" class="icon-btn" data-close aria-label="Close">${icon('close')}</button></div>
    <div class="listen-grid">
      <a class="listen sp" href="${listenUrl.spotify(artist, song)}" target="_blank" rel="noopener">${icon('sp')}<span>Spotify<small>Search and play</small></span>${icon('ext', 'ic go')}</a>
      <a class="listen yt" href="${listenUrl.ytmusic(artist, song)}" target="_blank" rel="noopener">${icon('yt')}<span>YouTube Music<small>Full song, free</small></span>${icon('ext', 'ic go')}</a>
      <a class="listen am" href="${listenUrl.apple(artist, song)}" target="_blank" rel="noopener">${icon('am')}<span>Apple Music<small>Search the store</small></span>${icon('ext', 'ic go')}</a>
    </div>
    <p class="credit">Tap the cover for a 30-second preview. Preview via Apple Music.</p>
    ${songHref ? html`<a class="btn" href="${songHref}" data-close>Song history and stats ${icon('right')}</a>` : ''}
  </div>`);
  syncPreviewButtons();
  d.showModal();
}

/** Wire global listeners once. */
export function initPreview() {
  const a = audio();
  a.addEventListener('ended', stop);
  a.addEventListener('pause', () => { if (current && a.ended) stop(); });
  document.addEventListener('click', (ev) => {
    const pv = ev.target.closest('[data-preview]');
    if (pv) { ev.preventDefault(); play(pv.dataset.artist, pv.dataset.song); return; }
    if (ev.target.closest('[data-stop]')) { stop(); return; }
    const ls = ev.target.closest('[data-listen]');
    if (ls) { openSheet(ls.dataset.artist, ls.dataset.song, ls.dataset.href); return; }
    const d = document.getElementById('sheet');
    if (d.open && (ev.target === d || ev.target.closest('[data-close]'))) d.close();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current && !document.getElementById('sheet').open) stop(); });
  if (RM()) a.dataset.rm = '1';
}

export const _test = { score, mainArtist, clean };
