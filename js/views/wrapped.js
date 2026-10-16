// Piticu Wrapped: a full-screen, tap-through story about the whole archive (or one year).
// #/wrapped?year=2025&s=3 (s is 1-based). Stats live in wrapped/stats.js, slides in wrapped/slides.js,
// styles in css/wrapped.css (loaded on demand). Only transform/opacity animate.
import { html, icon, fmt, countUp, setQuery, RM as prefersRM } from '../ui.js';
import { wrappedStats } from './wrapped/stats.js';
import { buildSlides } from './wrapped/slides.js';

const CSS_HREF = 'css/wrapped.css';
const BODY = 'wrapped-on';

function ensureCss() {
  if (document.querySelector(`link[href^="${CSS_HREF}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = CSS_HREF;
  document.head.append(l);
}

/** Count from `from` to `to` (down or up), formatting with fmt. */
function tween(el, from, to, dur = 1400) {
  const t0 = performance.now(), ease = (t) => 1 - Math.pow(2, -10 * t);
  const f = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = fmt(Math.round(from + (to - from) * (p === 1 ? 1 : ease(p))));
    if (p < 1 && el.isConnected) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

export default {
  title: (ctx) => (ctx.query.get('year') ? `Piticu Wrapped ${ctx.query.get('year')}` : 'Piticu Wrapped'),
  render(root, { db, query, navigate }) {
    ensureCss();
    const qy = +query.get('year');
    const year = db.years.includes(qy) ? qy : null;
    const st = wrappedStats(db, year);
    const slides = buildSlides(st);
    const RM = prefersRM();
    let idx = Math.min(slides.length - 1, Math.max(0, (parseInt(query.get('s'), 10) || 1) - 1));

    root.innerHTML = String(html`<div class="v-wrapped ${RM ? 'rm' : ''}" data-theme-now="${slides[idx].theme}">
      <div class="wr-amb" aria-hidden="true">${slides.map((s, i) => html`<i class="t-${s.theme}" data-i="${i}"></i>`)}</div>
      <div class="wr-frame" tabindex="-1" autofocus role="region" aria-roledescription="story" aria-label="Piticu Wrapped${year ? ` ${year}` : ''}">
        <div class="wr-stage">
          ${slides.map((s, i) => html`<section class="wr-slide t-${s.theme}" data-i="${i}" data-id="${s.id}" role="group"
              aria-roledescription="slide" aria-label="${i + 1} of ${slides.length}: ${s.label}" style="--dur:${s.dur || 7000}ms">
            <div class="wr-bg" aria-hidden="true"><span class="o1"></span><span class="o2"></span></div>
            ${s.html}
          </section>`)}
        </div>
        <div class="wr-chrome">
          <div class="wr-bars" aria-hidden="true">${slides.map((s, i) => html`<span class="wr-seg" data-i="${i}" style="--dur:${s.dur || 7000}ms"><i></i></span>`)}</div>
          <div class="wr-top">
            <span class="wr-brand"><span class="wr-brand-mark" aria-hidden="true">400</span>Piticu Wrapped${year ? html` <em>${year}</em>` : ''}</span>
            <span class="wr-paused" aria-hidden="true">${icon('stop')} Paused</span>
            <button type="button" class="wr-x" data-close aria-label="Close the story">${icon('close')}</button>
          </div>
        </div>
        <p class="sr-only" aria-live="polite" data-live></p>
      </div>
      <button type="button" class="wr-arrow prev" data-prev aria-label="Previous slide">${icon('left')}</button>
      <button type="button" class="wr-arrow next" data-next aria-label="Next slide">${icon('right')}</button>
      <p class="wr-hint" aria-hidden="true"><kbd>←</kbd><kbd>→</kbd> or <kbd>Space</kbd> to move · hold to pause · <kbd>Esc</kbd> to close</p>
    </div>`);

    const wrap = root.querySelector('.v-wrapped');
    const frame = wrap.querySelector('.wr-frame');
    const els = [...wrap.querySelectorAll('.wr-slide')];
    const segs = [...wrap.querySelectorAll('.wr-seg')];
    const ambs = [...wrap.querySelectorAll('.wr-amb i')];
    const live = wrap.querySelector('[data-live]');
    document.body.classList.add(BODY);

    // ------------------------------------------------ timers scoped to the current slide
    let slideTimers = [];
    const later = (fn, ms) => { slideTimers.push(setTimeout(fn, ms)); };
    const clearSlideTimers = () => { slideTimers.forEach(clearTimeout); slideTimers = []; };
    const leaveTimers = new Map();

    // ------------------------------------------------ pause reasons: hold, hidden, audio
    const reasons = new Set();
    const setPause = (why, on) => {
      if (on) reasons.add(why); else reasons.delete(why);
      wrap.classList.toggle('paused', reasons.size > 0);
      wrap.classList.toggle('holding', reasons.has('hold'));
    };

    function enter(el, s) {
      el.querySelectorAll('[data-to]').forEach((n, k) => {
        const to = +n.dataset.to, from = n.dataset.from != null ? +n.dataset.from : null;
        if (RM) { n.textContent = fmt(to); return; }
        n.textContent = fmt(from ?? 0);
        const delay = 250 + k * 140;
        later(() => (from != null ? tween(n, from, to, 1600) : countUp(n, to, 1400)), delay);
      });
      s.enter?.(el, { RM, later });
    }

    function go(i, { initial = false } = {}) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      if (i === idx && !initial) return;
      const prev = idx;
      clearSlideTimers();
      if (!initial && els[prev]) {
        const old = els[prev];
        old.classList.remove('on'); old.classList.add('was');
        old.dataset.dir = i > prev ? 'fwd' : 'back';
        clearTimeout(leaveTimers.get(old));
        leaveTimers.set(old, setTimeout(() => old.classList.remove('was'), 650));
      }
      idx = i;
      const el = els[i];
      els.forEach((x, k) => { x.inert = k !== i; x.setAttribute('aria-hidden', String(k !== i)); });
      el.classList.remove('was', 'on');
      el.dataset.dir = i >= prev ? 'fwd' : 'back';
      void el.offsetWidth; // restart CSS transitions
      el.classList.add('on');
      ambs.forEach((a, k) => a.classList.toggle('on', k === i));
      wrap.dataset.themeNow = slides[i].theme;
      segs.forEach((g, k) => {
        g.classList.toggle('done', k < i);
        g.classList.remove('on');
      });
      void segs[i].offsetWidth;
      segs[i].classList.add('on');
      segs[i].classList.toggle('still', !slides[i].dur || RM);
      enter(el, slides[i]);
      live.textContent = slides[i].label;
      setQuery('/wrapped', { year, s: i ? i + 1 : null });
    }
    const next = () => go(idx + 1);
    const prev = () => go(idx - 1);
    const close = () => navigate('#/');

    // Auto-advance: the active segment's CSS animation is the timer (pauses with the class).
    const onAnimEnd = (e) => {
      if (e.animationName !== 'wr-fill') return;
      const seg = e.target.closest('.wr-seg');
      if (+seg?.dataset.i === idx && idx < slides.length - 1) next();
    };
    wrap.addEventListener('animationend', onAnimEnd);

    // ------------------------------------------------ pointer: tap zones, swipe, hold
    let down = null, holdT = 0;
    const interactive = (t) => t.closest('a, button, input, select, [data-noflip]');
    const onDown = (e) => {
      if (e.button > 0 || interactive(e.target)) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), held: false };
      clearTimeout(holdT);
      holdT = setTimeout(() => { if (down) { down.held = true; setPause('hold', true); } }, 220);
    };
    const onUp = (e) => {
      if (!down) return;
      clearTimeout(holdT);
      const d = down; down = null;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (d.held) { setPause('hold', false); if (Math.abs(dx) < 40 && Math.abs(dy) < 40) return; }
      if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); return; }
      if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) { close(); return; }
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && !d.held) {
        const r = frame.getBoundingClientRect();
        if (e.clientX - r.left < r.width * 0.3) prev(); else next();
      }
    };
    const onCancel = () => { clearTimeout(holdT); if (down?.held) setPause('hold', false); down = null; };
    frame.addEventListener('pointerdown', onDown);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onCancel);
    frame.addEventListener('contextmenu', (e) => { if (!interactive(e.target)) e.preventDefault(); });

    // ------------------------------------------------ clicks: close, arrows, replay
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) close();
      else if (e.target.closest('[data-prev]')) prev();
      else if (e.target.closest('[data-next]')) next();
      else if (e.target.closest('[data-replay]')) go(0);
    });

    // ------------------------------------------------ keyboard
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || document.getElementById('sheet')?.open) return;
      const onControl = e.target.closest?.('button, a, input, select, textarea');
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !onControl)) { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
      else if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);

    // ------------------------------------------------ pause while hidden, or while a preview plays
    const onVis = () => setPause('hidden', document.hidden);
    document.addEventListener('visibilitychange', onVis);
    const audio = document.getElementById('pd-audio');
    const onPlay = () => setPause('audio', true);
    const onStop = () => setPause('audio', false);
    audio?.addEventListener('playing', onPlay);
    audio?.addEventListener('pause', onStop);
    audio?.addEventListener('ended', onStop);
    if (audio && !audio.paused) onPlay();
    onVis();

    go(idx, { initial: true });

    return () => {
      clearSlideTimers();
      leaveTimers.forEach((t) => clearTimeout(t));
      clearTimeout(holdT);
      document.body.classList.remove(BODY);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onCancel);
      audio?.removeEventListener('playing', onPlay);
      audio?.removeEventListener('pause', onStop);
      audio?.removeEventListener('ended', onStop);
    };
  },
};

