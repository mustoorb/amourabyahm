// Inertial smooth scrolling (Lenis) for mouse/trackpad devices.
// Touch devices keep native scrolling — it already feels right there, and it's
// what phones expect. Disabled for reduced motion.

import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { isFinePointer, prefersReducedMotion } from './lifecycle.js';

/** Starts smooth scrolling; returns { lenis, scrollTo, destroy }. `lenis` is null when native. */
export function startSmoothScroll() {
  const native = !isFinePointer() || prefersReducedMotion();
  const lenis = native ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  let raf = 0;
  if (lenis) {
    const loop = (t) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  const scrollTo = (target, opts = {}) => {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (lenis) lenis.scrollTo(el ?? target, { duration: 1.6, ...opts });
    else if (el?.scrollIntoView) el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    else window.scrollTo({ top: target, behavior: 'smooth' });
  };

  // In-page links (#enquire etc.) glide instead of jumping.
  const onClick = (e) => {
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const id = a.getAttribute('href');
    if (id.length < 2 || !document.querySelector(id)) return;
    e.preventDefault();
    scrollTo(id);
    history.replaceState(history.state, '', id);
  };
  // Capture phase, so this runs before Astro's router (which would otherwise take the link).
  document.addEventListener('click', onClick, true);

  return {
    lenis,
    scrollTo,
    destroy() {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      document.removeEventListener('click', onClick, true);
    },
  };
}
