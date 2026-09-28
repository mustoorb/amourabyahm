// Growing-ring custom cursor. Fine pointers only; touch devices keep native behaviour.
// Anything can drive it: elements with [data-cursor="view|hover"] (+ data-cursor-label),
// or code calling setCursor('view', 'View story →').

import { isFinePointer, prefersReducedMotion } from './lifecycle.js';
import { tick } from './sound.js';

let el, dot, ring, label;
let x = -100, y = -100, rx = -100, ry = -100;
let forced = null;
let raf = 0;

export function setCursor(state, text = '') {
  forced = state ? { state, text } : null;
  apply();
}

let current = '';
function apply(target) {
  if (!el) return;
  let state = forced?.state || '';
  let text = forced?.text || '';
  if (!forced && target) {
    const t = target.closest?.('[data-cursor], a, button, [role="button"], label, input, select, textarea');
    if (t) {
      state = t.dataset.cursor || 'hover';
      text = t.dataset.cursorLabel || '';
    }
  }
  el.classList.toggle('is-hover', state === 'hover');
  el.classList.toggle('is-view', state === 'view');
  el.classList.toggle('is-drag', state === 'drag');
  if (text) label.textContent = text;
  if (state && state !== current && state !== 'drag') tick();
  current = state;
}

export function initCursor() {
  if (el || !isFinePointer()) return;
  el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="cursor__ring"><span class="cursor__label"></span></div><div class="cursor__dot"></div>';
  document.body.append(el);
  dot = el.querySelector('.cursor__dot');
  ring = el.querySelector('.cursor__ring');
  label = el.querySelector('.cursor__label');
  document.documentElement.classList.add('has-cursor');

  const lag = prefersReducedMotion() ? 1 : 0.18;
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX;
    y = e.clientY;
    el.classList.remove('is-hidden');
    apply(e.target);
  }, { passive: true });
  document.addEventListener('pointerleave', () => el.classList.add('is-hidden'));
  window.addEventListener('blur', () => el.classList.add('is-hidden'));

  const loop = () => {
    rx += (x - rx) * lag;
    ry += (y - ry) * lag;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  // Page swaps replace <body>; re-attach the cursor node to the new body.
  document.addEventListener('astro:after-swap', () => {
    document.body.append(el);
    document.documentElement.classList.add('has-cursor');
    forced = null;
    apply();
  });
}
