// Astro's ClientRouter swaps pages without a reload, and bundled scripts only run once.
// `onPage(init)` runs `init` on every page load (first load included); whatever it
// returns is called just before the next swap, so listeners/renderers never leak.

export function onPage(init) {
  let cleanup = null;
  document.addEventListener('astro:page-load', () => {
    try {
      cleanup = init() || null;
    } catch (err) {
      console.error(err);
    }
  });
  document.addEventListener('astro:before-swap', () => {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
  });
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isFinePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
export const saveData = () => !!navigator.connection?.saveData;
