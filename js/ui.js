// Shared UI helpers: HTML templating, formatting, links and reusable components.
// Every component returns an HTML string built with the `html` tag (values are escaped);
// call hydrate(root) after inserting it to start reveal / count-up / bar animations.
import { norm, songStats } from './data.js';

export const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- templating
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
/** Mark a string as trusted HTML (skip escaping). */
export const raw = (s) => new Raw(String(s));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (v) => (v == null || v === false ? '' : v instanceof Raw ? v.s : Array.isArray(v) ? v.map(val).join('') : esc(v));
/** Tagged template: html`<b>${userText}</b>` escapes values; nested html`` results and arrays pass through. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += val(values[i]) + strings[i + 1];
  return new Raw(out);
}

// ---------------------------------------------------------------- formatting
export const fmt = (n) => Number(n).toLocaleString('en-US');
export const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export const plural = (n, one, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;
const D = (iso) => new Date(iso + 'T12:00:00Z');
export function fmtDate(iso, style = 'short') {
  const o = { timeZone: 'UTC' };
  if (style === 'long') Object.assign(o, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  else if (style === 'month') Object.assign(o, { month: 'short', year: 'numeric' });
  else if (style === 'day') Object.assign(o, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  else Object.assign(o, { day: 'numeric', month: 'short', year: 'numeric' });
  return D(iso).toLocaleDateString('en-GB', o);
}
export function ago(days) {
  if (days < 14) return plural(days, 'day');
  if (days < 70) return plural(Math.round(days / 7), 'week');
  if (days < 730) return plural(Math.round(days / 30.44), 'month');
  return `${(days / 365.25).toFixed(1)} years`;
}

// ---------------------------------------------------------------- links
export const href = {
  home: () => '#/',
  songs: (q = '') => '#/songs' + q,
  artists: () => '#/artists',
  artist: (a) => `#/artist/${a.slug}`,
  song: (s) => `#/song/${s.artist.slug}/${s.slug}`,
  episodes: () => '#/episodes',
  episode: (e) => `#/episode/${e.n ?? e}`,
  year: (y) => `#/year/${y}`,
  search: (q) => `#/search?q=${encodeURIComponent(q)}`,
  dm: () => '#/dm',
};
const enc = (s) => encodeURIComponent(s);
export const listenUrl = {
  spotify: (artist, song) => `https://open.spotify.com/search/${enc(`${artist} ${song}`)}`,
  ytmusic: (artist, song) => `https://music.youtube.com/search?q=${enc(`${artist} ${song}`)}`,
  apple: (artist, song) => `https://music.apple.com/search?term=${enc(`${artist} ${song}`)}`,
};

// ---------------------------------------------------------------- primitives
export const icon = (name, cls = 'ic') => html`<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
export function hue(s) { let h = 0; for (const c of norm(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; }
export const initials = (name) => name.replace(/^the /i, '').split(/[\s&,/-]+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]).join('').toUpperCase();

/** Generated gradient "cover" for an artist. As a preview button when `song` is given. */
export function cover(artistName, { song = null, size = '' } = {}) {
  const style = `--h:${hue(artistName)}`;
  const ini = initials(artistName);
  if (!song) return html`<span class="cover ${size}" style="${style}" aria-hidden="true">${ini}</span>`;
  return html`<button type="button" class="cover pv ${size}" style="${style}" data-preview
    data-artist="${song.artist.name}" data-song="${song.title}"
    aria-label="Play a 30-second preview of ${song.title} by ${song.artist.name}">
    <span aria-hidden="true">${ini}</span>
    <span class="pv-glyph" aria-hidden="true">${icon('play', 'ic i-play')}${icon('stop', 'ic i-stop')}</span>
    <svg class="pv-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg>
  </button>`;
}

/** Spotify / YouTube Music / Apple Music buttons. On phones, YT Music + Apple fold into a "more" sheet. */
export function listenButtons(song) {
  const a = song.artist.name, t = song.title;
  const l = (cls, url, ic, label, extra = '') =>
    html`<a class="lb ${cls}${extra}" href="${url}" target="_blank" rel="noopener" aria-label="${label} (opens new tab)">${icon(ic)}</a>`;
  return html`<div class="acts">
    ${l('sp', listenUrl.spotify(a, t), 'sp', `Play ${t} by ${a} on Spotify`)}
    ${l('yt', listenUrl.ytmusic(a, t), 'yt', `Play ${t} by ${a} on YouTube Music`, ' wide-only')}
    ${l('am', listenUrl.apple(a, t), 'am', `Open ${t} by ${a} in Apple Music`, ' wide-only')}
    <button type="button" class="lb more" data-listen data-artist="${a}" data-song="${t}" data-href="${href.song(song)}"
      aria-label="More ways to listen to ${t}">${icon('more')}</button>
  </div>`;
}

/** Fill-from-zero meter bar with a printed count. */
export const meter = (n, max, { dl = 0, unit = 'plays' } = {}) => html`<div class="meter">
  <span class="bar" aria-hidden="true"><i style="--w:${(max ? n / max : 0).toFixed(3)};--dl:${dl}ms"></i></span>
  <span class="plays">${fmt(n)}<small>${n === 1 ? unit.replace(/s$/, '') : unit}</small></span></div>`;

const rankCell = (rank) => (rank == null ? '' : html`<span class="rk ${rank === 1 ? 'top' : ''}">${rank}</span>`);

/**
 * A song row: [rank] [cover = preview] [title / artist / meter or meta] [listen buttons].
 * opts: { rank, n, max, meta (string|html), showArtist = true, badge (html), slot }
 */
export function songRow(song, opts = {}, i = 0) {
  const { rank = null, n = null, max = null, meta = null, showArtist = true, badge = null, slot = null } = opts;
  const first = rank ?? slot;
  return html`<li class="row rv ${first == null ? 'no-rank' : ''}" style="--dl:${Math.min(i, 12) * 60}ms">
    ${slot != null ? html`<span class="rk slot">${slot}</span>` : rankCell(rank)}
    ${cover(song.artist.name, { song })}
    <div class="tt">
      <div class="s"><a href="${href.song(song)}">${song.title}</a>${badge}</div>
      ${showArtist ? html`<div class="a"><a href="${href.artist(song.artist)}"><b>${song.artist.name}</b></a></div>` : ''}
      ${meta ? html`<div class="${showArtist ? 'm' : 'a'}">${meta}</div>` : ''}
      ${n != null && max ? meter(n, max, { dl: 200 + Math.min(i, 12) * 60 }) : ''}
    </div>
    ${listenButtons(song)}
  </li>`;
}

/** An artist row with rank, cover, plays meter and song count. */
export function artistRow(artist, { rank = null, n, max, meta = null } = {}, i = 0) {
  return html`<li class="row rv ${rank == null ? 'no-rank' : ''}" style="--dl:${Math.min(i, 12) * 60}ms">
    ${rankCell(rank)}
    ${cover(artist.name)}
    <div class="tt">
      <div class="s"><a href="${href.artist(artist)}">${artist.name}</a></div>
      ${meta ? html`<div class="a">${meta}</div>` : ''}
      ${max ? meter(n, max, { dl: 200 + Math.min(i, 12) * 60 }) : ''}
    </div>
    <a class="lb" href="${href.artist(artist)}" aria-label="Open ${artist.name}">${icon('right')}</a>
  </li>`;
}

/** Wrap rows in a card + ordered list. */
export const rankList = (rows, { label = null, cls = '' } = {}) =>
  html`<div class="card ${cls}"><ol class="rank" ${label ? html`aria-label="${label}"` : ''}>${rows}</ol></div>`;

/** Stat card with count-up number. { label, value, caption, icon, tone: 'hot'|'violet', share (0..1), href, suffix } */
export function statCard({ label, value, caption = '', icon: ic = null, tone = '', share = null, link = null, suffix = '' }, i = 0) {
  const tag = link ? 'a' : 'article';
  const isNum = typeof value === 'number';
  return html`${raw(`<${tag} class="stat rv ${tone}" style="--dl:${i * 80}ms"${link ? ` href="${esc(link)}"` : ''}>`)}
    ${ic ? icon(ic, 'glyph') : ''}
    <div class="micro">${label}</div>
    <div class="n">${isNum ? html`<span data-count="${value}" aria-label="${fmt(value)}${suffix}">${fmt(value)}</span>` : value}${suffix && isNum ? html`<small aria-hidden="true">${suffix}</small>` : ''}</div>
    ${caption ? html`<div class="cap">${caption}</div>` : ''}
    ${share != null ? html`<div class="share" aria-hidden="true"><i style="--w:${share.toFixed(3)}"></i></div>` : ''}
  ${raw(`</${tag}>`)}`;
}

/** Section heading: kicker, h2 title, optional "see all" link. */
export const secHead = ({ kicker = '', title, id = '', link = null, linkText = 'See all' }) => html`<div class="sec-h">
  <div>${kicker ? html`<div class="micro">${kicker}</div>` : ''}<h2 ${id ? html`id="${id}"` : ''}>${title}</h2></div>
  ${link ? html`<a class="link" href="${link}">${linkText} ${icon('right', 'ic')}</a>` : ''}</div>`;

/** Page heading with the route's h1 (focused on navigation). */
export const pageHead = ({ kicker = '', title, sub = '', back = null, aside = '' }) => html`<header class="page-h">
  ${back ? html`<div class="crumbs"><a class="back" href="${back.href}">${icon('left')} ${back.label}</a></div>` : ''}
  ${kicker ? html`<div class="micro kicker">${kicker}</div>` : ''}
  <h1 tabindex="-1">${title}</h1>
  ${sub ? html`<p class="sub">${sub}</p>` : ''}${aside}</header>`;

/** Chip group (single choice). options: [{ value, label }]. Emits via data-chip="<group>" data-value. */
export const chips = (group, options, value, label) => html`<div class="chips" role="group" aria-label="${label}">
  ${options.map((o) => html`<button type="button" class="chip" data-chip="${group}" data-value="${o.value}" aria-pressed="${String(o.value) === String(value)}">${o.label}</button>`)}</div>`;

/** Switch-style checkbox. Emits change on input[name]. */
export const toggle = (name, label, checked) => html`<label class="toggle"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span class="sw" aria-hidden="true"></span>${label}</label>`;

/** Vertical bars. data: [{ label, n, tone?, href? }]. */
export function vbars(data, { aria, showValues = true, labelEvery = 1 } = {}) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return html`<div class="vbars chart" role="img" aria-label="${aria}">
    ${data.map((d, i) => html`<div class="vb" title="${d.label}: ${fmt(d.n)}">
      ${showValues ? html`<span class="v" aria-hidden="true">${d.n ? fmt(d.n) : ''}</span>` : ''}
      <i class="${d.tone || ''}" style="--h:${(d.n / max).toFixed(3)};--dl:${Math.min(i, 20) * 40}ms"></i>
      <span class="l" aria-hidden="true">${i % labelEvery === 0 ? d.label : ''}</span></div>`)}
  </div>`;
}

/** Mini bar sparkline. values: [{ label, n }]. */
export function sparkline(values, { aria }) {
  const max = Math.max(1, ...values.map((v) => v.n));
  return html`<div class="spark" role="img" aria-label="${aria}">
    ${values.map((v, i) => html`<i class="${v.n ? '' : 'zero'}" style="--h:${(v.n / max).toFixed(3)};--dl:${i * 50}ms" title="${v.label}: ${v.n}"></i>`)}</div>
  <div class="spark-l" aria-hidden="true"><span>${values[0]?.label}</span><span>${values.at(-1)?.label}</span></div>`;
}

/** Episode card for grids. */
export function episodeCard(ep, i = 0) {
  const cls = ep.special ? 'special' : ep.tracks.length ? '' : 'empty';
  return html`<a class="ep-card rv ${cls}" href="${href.episode(ep)}" style="--dl:${Math.min(i, 12) * 50}ms"
    aria-label="Episode ${ep.n}, ${fmtDate(ep.date, 'long')}${ep.special ? `, special: ${ep.special}` : ''}, ${ep.tracks.length} tracks">
    <div class="ep-card-h"><span class="ep-n">#${ep.n}</span><span class="ep-d">${fmtDate(ep.date, 'day')}<br>${ep.tracks.length ? plural(ep.tracks.length, 'track') : 'playlist unknown'}</span></div>
    ${ep.special ? html`<div><span class="badge violet" style="margin:0">${icon('spark', 'ic')} ${ep.special}</span></div>` : ''}
    ${ep.tracks.length ? html`<ol>${ep.tracks.slice(0, 3).map((p) => html`<li><b>${p.artist.name}</b> · ${p.song.title}</li>`)}</ol>` : ''}
  </a>`;
}

/** A small "N plays · last DATE" caption for a song. */
export function songMeta(song) {
  const st = songStats(song);
  return `${plural(st.n, 'play')} · last ${fmtDate(st.last.date)}`;
}

/** Placeholder card for routes that are still being built. */
export const comingSoon = ({ title, blurb, ic = 'spark' }) => html`<div class="soon rv">
  ${icon(ic)}<h2>${title}</h2><p>${blurb}</p><a class="btn" href="#/">Back to the studio</a></div>`;

export const emptyState = (text) => html`<div class="empty-state">${text}</div>`;

// ---------------------------------------------------------------- behaviour
let io = null;
/** Count a number up from 0 (final value already in aria-label). */
export function countUp(el, to, dur = 1400) {
  if (RM()) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), ease = (t) => 1 - Math.pow(2, -10 * t);
  el.textContent = '0';
  const f = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(Math.round(to * (p === 1 ? 1 : ease(p))));
    if (p < 1) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}
/** Start reveal (.rv), bar fills and count-ups inside root, once each, when visible. */
export function hydrate(root) {
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      el.classList.add('in');
      if (el.dataset.count != null) countUp(el, +el.dataset.count);
      el.querySelectorAll('[data-count]').forEach((n) => { if (!n.dataset.counted) { n.dataset.counted = 1; countUp(n, +n.dataset.count); } });
      io.unobserve(el);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
  root.querySelectorAll('.rv, .vbars, .spark, .bar, .share').forEach((el) => io.observe(el));
}

/** Delegate chip clicks within root: onChange(group, value). Updates aria-pressed. */
export function onChips(root, onChange) {
  root.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-chip]');
    if (!b || !root.contains(b)) return;
    const g = b.dataset.chip;
    root.querySelectorAll(`[data-chip="${g}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onChange(g, b.dataset.value);
  });
}

/** Replace the current hash query without triggering a re-route. */
export function setQuery(path, params) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '' && v !== false)).toString();
  history.replaceState(null, '', `#${path}${q ? '?' + q : ''}`);
}

/** Floating tooltip for charts: attach to root, reads data-tip from hovered/focused elements. */
export function tooltips(root) {
  let tip = document.querySelector('.tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('aria-hidden', 'true'); document.body.append(tip); }
  const show = (el) => {
    const r = el.getBoundingClientRect();
    tip.textContent = el.dataset.tip;
    const x = Math.min(innerWidth - 12 - tip.offsetWidth / 2, Math.max(12 + tip.offsetWidth / 2, r.left + r.width / 2));
    tip.style.left = `${x}px`; tip.style.top = `${r.top}px`; tip.classList.add('on');
  };
  const hide = () => tip.classList.remove('on');
  root.addEventListener('pointerover', (e) => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  root.addEventListener('pointerout', (e) => { if (e.target.closest('[data-tip]')) hide(); });
  root.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  root.addEventListener('focusout', hide);
  if (!tip.dataset.bound) { tip.dataset.bound = 1; addEventListener('scroll', hide, { passive: true }); }
}
