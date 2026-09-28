/** Shared view-transition name for a story's hero image (card → story hero morph). */
export const heroName = (slug) => `hero-${String(slug).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
