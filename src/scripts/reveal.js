// Adds .is-in to [data-reveal] elements as they scroll into view.
export function initReveal(root = document) {
  const els = root.querySelectorAll('[data-reveal]:not(.is-in)');
  if (!els.length) return null;
  if (!('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('is-in'));
    return null;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  els.forEach((e) => io.observe(e));
  return () => io.disconnect();
}
