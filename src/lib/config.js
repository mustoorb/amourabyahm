// Site-wide config knobs. Safe to import from astro.config.mjs, server code and the browser.
//
// Each value can be set here directly, or overridden with the matching PUBLIC_* env var
// (e.g. in Netlify → Site configuration → Environment variables).

const env = import.meta.env ?? {};
const penv = typeof process !== 'undefined' && process.env ? process.env : {};
const read = (key, fallback) => env[key] || penv[key] || fallback;

/** Sanity project id (public). Leave empty to run on the bundled demo data in src/data.js. */
export const SANITY_PROJECT_ID = read('PUBLIC_SANITY_PROJECT_ID', 'jtcvm9zo');

/** Sanity dataset name. */
export const SANITY_DATASET = read('PUBLIC_SANITY_DATASET', 'production');

/** Sanity API version (a date string; pin it so query behaviour never shifts under you). */
export const SANITY_API_VERSION = '2025-01-01';

/**
 * Where every "Let's Talk" button goes — the Amoura chat.
 * TODO: set the real chat URL. Until then it points at the contact block on /about.
 */
export const AMOURA_CHAT_URL = read('PUBLIC_AMOURA_CHAT_URL', '/about#contact');

/**
 * WhatsApp number for the "WhatsApp" buttons, international format, digits only (e.g. '971501234567').
 * TODO: set it. While empty, WhatsApp buttons fall back to the enquiry form.
 */
export const WHATSAPP_NUMBER = read('PUBLIC_WHATSAPP_NUMBER', '').replace(/\D/g, '');

/** Pre-filled first message for WhatsApp. */
export const WHATSAPP_MESSAGE = 'Hello amoura — we’re getting married and would love to talk.';

/** Brand strings used across the chrome. */
export const BRAND = {
  name: 'amoura',
  positioning: 'Wedding films & photographs — Paris · Dubai · anywhere love takes us',
  clocks: [
    { label: 'Paris', tz: 'Europe/Paris' },
    { label: 'Dubai', tz: 'Asia/Dubai' },
  ],
};
