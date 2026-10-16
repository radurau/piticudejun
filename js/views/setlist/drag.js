// Drag to reorder a list of rows with pointer events.
// Mouse / pen: grab the grip handle. Touch: long-press anywhere on the row (not on a button),
// so a normal swipe still scrolls the page. Rows slide out of the way with transforms only.
const LONG_MS = 360, SLOP = 8, EDGE = 90;

/**
 * list: the <ol>; rows are its direct children with [data-i].
 * onDrop(from, to) is called when the order changes.
 */
export function sortable(list, { onDrop, onStart = () => {} }) {
  let st = null; // { row, from, to, y0, rects, h, timer, active, id, scrollY0 }
  let raf = 0, lastY = 0;

  const rowsOf = () => [...list.children].filter((r) => r.dataset.i != null);

  function begin() {
    const rows = rowsOf();
    st.active = true;
    st.rects = rows.map((r) => { const b = r.getBoundingClientRect(); return { top: b.top + scrollY, h: b.height }; });
    const gap = rows.length > 1 ? st.rects[1].top - (st.rects[0].top + st.rects[0].h) : 0;
    st.h = st.rects[st.from].h + gap;
    st.rows = rows;
    list.classList.add('sl-dragging');
    st.row.classList.add('lift');
    try { st.row.setPointerCapture(st.id); } catch { /* already released */ }
    navigator.vibrate?.(8);
    onStart();
    loop();
  }

  function layout(y) {
    const dy = y + scrollY - st.y0;
    st.row.style.transform = `translate3d(0, ${dy}px, 0) scale(1.02)`;
    const mid = st.rects[st.from].top + st.rects[st.from].h / 2 + dy;
    let to = 0;
    for (let i = 0; i < st.rects.length; i++) {
      const c = st.rects[i].top + st.rects[i].h / 2;
      if (i !== st.from && mid > c) to++;
    }
    to = Math.min(to, st.rects.length - 1);
    st.to = to;
    st.rows.forEach((r, i) => {
      if (i === st.from) return;
      let shift = 0;
      if (st.from < to && i > st.from && i <= to) shift = -st.h;
      if (st.from > to && i >= to && i < st.from) shift = st.h;
      r.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : '';
    });
  }

  function loop() {
    cancelAnimationFrame(raf);
    const step = () => {
      if (!st?.active) return;
      const v = lastY < EDGE ? -(EDGE - lastY) / 6 : lastY > innerHeight - EDGE ? (lastY - (innerHeight - EDGE)) / 6 : 0;
      if (v) { scrollBy(0, v); layout(lastY); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function end(commit) {
    if (!st) return;
    clearTimeout(st.timer);
    cancelAnimationFrame(raf);
    const { active, from, to, rows, row } = st;
    st = null;
    if (!active) return;
    list.classList.remove('sl-dragging');
    row.classList.remove('lift');
    list.dataset.justDragged = '1';
    setTimeout(() => { delete list.dataset.justDragged; }, 60);
    (rows || []).forEach((r) => { r.style.transform = ''; });
    if (commit && from !== to) onDrop(from, to);
  }

  list.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const row = e.target.closest('[data-i]');
    if (!row || row.parentElement !== list) return;
    const onGrip = !!e.target.closest('.sl-grip');
    const onControl = !!e.target.closest('button:not(.sl-grip), a, input');
    if (e.pointerType === 'mouse' ? !onGrip : onControl && !onGrip) return;
    st = { row, from: +row.dataset.i, to: +row.dataset.i, y0: e.clientY + scrollY, x0: e.clientX, id: e.pointerId, active: false };
    lastY = e.clientY;
    if (e.pointerType === 'mouse' || (onGrip && e.pointerType === 'pen')) { e.preventDefault(); begin(); }
    else st.timer = setTimeout(() => st && begin(), LONG_MS);
  });
  list.addEventListener('pointermove', (e) => {
    if (!st || e.pointerId !== st.id) return;
    lastY = e.clientY;
    if (!st.active) {
      if (Math.hypot(e.clientX - st.x0, e.clientY + scrollY - st.y0) > SLOP) end(false); // it's a scroll
      return;
    }
    e.preventDefault();
    layout(e.clientY);
  });
  list.addEventListener('pointerup', (e) => { if (st && e.pointerId === st.id) end(true); });
  list.addEventListener('pointercancel', () => end(false));
  list.addEventListener('lostpointercapture', () => { if (st?.active) end(true); });
  // While a touch drag is active, stop the page from scrolling under the finger.
  const block = (e) => { if (st?.active) e.preventDefault(); };
  list.addEventListener('touchmove', block, { passive: false });
  list.addEventListener('contextmenu', (e) => { if (st) e.preventDefault(); });
  // A click right after a drag should not trigger the row's buttons.
  list.addEventListener('click', (e) => { if (list.dataset.justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);

  return () => end(false);
}
