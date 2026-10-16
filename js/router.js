// Hash router: #/path/segments?query. Views are lazy-loaded ES modules in js/views/.
import { hydrate, html, pageHead } from './ui.js';
import { syncPreviewButtons } from './preview.js';

/** Route table. `keys` name the regex groups, passed to the view as ctx.params. `tab` lights up the nav. */
export const routes = [
  { re: /^\/$/, view: 'home', tab: 'home' },
  { re: /^\/songs$/, view: 'songs', tab: 'songs' },
  { re: /^\/song\/([^/]+)\/([^/]+)$/, view: 'song', tab: 'songs', keys: ['artist', 'song'] },
  { re: /^\/artists$/, view: 'artists', tab: 'artists' },
  { re: /^\/artist\/([^/]+)$/, view: 'artist', tab: 'artists', keys: ['slug'] },
  { re: /^\/episodes$/, view: 'episodes', tab: 'episodes' },
  { re: /^\/episode\/(\d+)$/, view: 'episode', tab: 'episodes', keys: ['n'] },
  { re: /^\/year\/(\d{4})$/, view: 'year', tab: 'episodes', keys: ['year'] },
  { re: /^\/search$/, view: 'search', tab: 'search' },
  { re: /^\/dm$/, view: 'dm', tab: 'dm' },
  { re: /^\/wrapped$/, view: 'wrapped', tab: 'wrapped' },
  { re: /^\/setlist$/, view: 'setlist', tab: 'setlist' },
];

export function parseHash(hash = location.hash) {
  const h = hash.replace(/^#/, '') || '/';
  const [p, q = ''] = h.split('?');
  let path = '/' + p.replace(/^\/+|\/+$/g, '');
  try { path = decodeURIComponent(path); } catch { /* keep raw */ }
  return { path, query: new URLSearchParams(q) };
}

function match(path) {
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) return { route: r, params: Object.fromEntries((r.keys || []).map((k, i) => [k, m[i + 1]])) };
  }
  return null;
}

const notFound = {
  title: () => 'Not found',
  render(root) {
    root.innerHTML = String(html`${pageHead({ kicker: 'Dead air', title: 'Nothing on this frequency', sub: 'That page does not exist. Try search, or go back to the studio.' })}
      <p><a class="btn" href="#/">Back to the studio</a> <a class="btn" href="#/search">Search</a></p>`);
  },
};

export function startRouter({ db, root, appName = 'Piticu Dejun 400' }) {
  let cleanup = null, lastPath = null, seq = 0;

  async function render() {
    const my = ++seq;
    const { path, query } = parseHash();
    const m = match(path);
    let view = notFound;
    if (m) {
      try { view = (await import(`./views/${m.route.view}.js`)).default; }
      catch (e) { console.error(e); }
    }
    if (my !== seq) return; // a newer navigation won
    const ctx = {
      db, path, query, params: m?.params || {},
      navigate: (h) => { location.hash = h; },
    };
    const swap = () => {
      if (typeof cleanup === 'function') cleanup();
      cleanup = null;
      root.innerHTML = '';
      try { cleanup = view.render(root, ctx); }
      catch (e) { console.error(e); notFound.render(root); }
      document.title = [view.title?.(ctx), appName].filter(Boolean).join(' · ');
      document.querySelectorAll('[data-tab]').forEach((t) => {
        if (t.dataset.tab === m?.route.tab) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
      });
      hydrate(root);
      syncPreviewButtons();
      if (path !== lastPath) scrollTo({ top: 0, behavior: 'instant' });
    };
    const first = lastPath === null;
    const animate = !first && path !== lastPath && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate) await document.startViewTransition(swap).updateCallbackDone;
    else swap();
    // Move focus to the new page: an [autofocus] control if the view has one, else its h1.
    const target = root.querySelector('[autofocus]') || (!first && (root.querySelector('h1') || root));
    if (target) target.focus({ preventScroll: true });
    lastPath = path;
  }

  addEventListener('hashchange', render);
  return render();
}
