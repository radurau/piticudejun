// Bootstrap: theme, presenter mode, data load, router, service worker.
import { buildDB } from './data.js';
import { startRouter } from './router.js';
import { initPreview } from './preview.js';
import { html } from './ui.js';

const root = document.getElementById('main');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; // the router scrolls to top per page
const doc = document.documentElement;

// ---------------------------------------------------------------- theme
function setTheme(t) {
  doc.dataset.theme = t;
  doc.dataset.themeResolved = t;
  try { localStorage.setItem('pd:theme', t); } catch { /* ignore */ }
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-theme-toggle]')) setTheme(doc.dataset.themeResolved === 'light' ? 'dark' : 'light');
});
matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
  if (!doc.dataset.theme) doc.dataset.themeResolved = e.matches ? 'light' : 'dark';
});

// ---------------------------------------------------------------- keys: P = presenter, / = search
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'p' || e.key === 'P') { if ('present' in doc.dataset) delete doc.dataset.present; else doc.dataset.present = ''; }
  else if (e.key === '/') { e.preventDefault(); location.hash = '#/search'; }
});

// ---------------------------------------------------------------- app bar shadow on scroll
const bar = document.getElementById('appbar');
addEventListener('scroll', () => bar.classList.toggle('scrolled', scrollY > 8), { passive: true });

// ---------------------------------------------------------------- data + router
async function load() {
  const meta = (n, d) => document.querySelector(`meta[name="${n}"]`)?.content || d;
  const [shows, aliases] = await Promise.all([
    fetch(meta('pd-data', 'data/shows.json')).then((r) => { if (!r.ok) throw new Error(`shows.json ${r.status}`); return r.json(); }),
    fetch(meta('pd-aliases', 'data/aliases.json')).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  return buildDB(shows, aliases);
}

initPreview();
load()
  .then((db) => { window.pd = { db }; return startRouter({ db, root }); })
  .catch((err) => {
    console.error(err);
    root.innerHTML = String(html`<div class="loading"><p><b>Could not load the archive.</b></p>
      <p class="muted">Check your connection, or serve the folder over http (python3 -m http.server).</p>
      <button class="btn" type="button" onclick="location.reload()">Try again</button></div>`);
  });

// On https (GitHub Pages) always; locally only with ?sw, so edits are not served stale while developing.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || /[?&]sw\b/.test(location.search))) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e)));
}
