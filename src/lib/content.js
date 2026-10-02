// The one place pages get stories from. Returns the normalised shape:
//
// {
//   slug, brand:'AMOURA', title, tags[], date, year, featured, pinned, created, desc, heroLoop,
//   cover, coverSm, coverLqip, coverAspect,
//   media: [
//     { type:'image', full, thumb, lqip, aspect, alt? },
//     { type:'video', provider:'vimeo'|'youtube', id, poster, aspect }
//   ]
// }
//
// Source: Sanity when SANITY_PROJECT_ID is set, otherwise the demo data in src/data.js.

import { createClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url';
import { demoStories } from '../data.js';
import { SANITY_API_VERSION, SANITY_DATASET, SANITY_PROJECT_ID } from './config.js';

// Where stories appear:
//   Spiral   — stories ticked "Show in spiral" (`featured`), newest first, up to SPIRAL_CAP.
//   Corridor — the CORRIDOR_COUNT latest weddings, plus any ticked "Pin to corridor".
//   Archive  — every story.
// Newest = latest wedding date. The newest story gets the NEW badge everywhere.

/** Max stories feeding the spiral (it shows a mix of their covers and photos). */
export const SPIRAL_CAP = 12;
/** How many weddings the memory corridor shows. */
export const CORRIDOR_COUNT = 8;
/** @deprecated old name for SPIRAL_CAP */
export const SPHERE_CAP = SPIRAL_CAP;

const QUERY = /* groq */ `
*[_type == "story" && defined(slug.current) && defined(cover.asset)]
  | order(date desc, _createdAt desc) {
    "slug": slug.current,
    title, date, featured, pinned, tags, description, heroLoop, _createdAt,
    cover { ..., asset->{ _id, metadata { lqip, dimensions } } },
    gallery[] {
      _type, _key, alt, provider, videoId,
      image { ..., asset->{ _id, metadata { lqip, dimensions } } },
      poster { ..., asset->{ _id } }
    }
  }
`;

let cache;

/** All stories, newest first. */
export async function getStories() {
  cache ??= (SANITY_PROJECT_ID ? fetchSanity() : Promise.resolve(demoStories())).then(sortNewest);
  return cache;
}

/** Spiral: stories ticked "Show in spiral", newest first (falls back to the latest if none are ticked). */
export async function getSpiral() {
  const all = await getStories();
  const featured = all.filter((s) => s.featured);
  return (featured.length ? featured : all).slice(0, SPIRAL_CAP);
}

/** Older name, still used by the /lab prototypes. */
export const getFeatured = getSpiral;

/**
 * Corridor: the newest wedding always, then anything pinned, then the latest ones,
 * up to CORRIDOR_COUNT — shown newest first.
 */
export async function getCorridor() {
  const all = await getStories();
  const pick = new Set(all.slice(0, 1).map((s) => s.slug));
  for (const s of all) if (pick.size < CORRIDOR_COUNT && s.pinned) pick.add(s.slug);
  for (const s of all) if (pick.size < CORRIDOR_COUNT) pick.add(s.slug);
  return all.filter((s) => pick.has(s.slug));
}

/** Slug of the newest wedding (gets the NEW badge). */
export async function getNewestSlug() {
  return (await getStories())[0]?.slug;
}

export async function getStory(slug) {
  return (await getStories()).find((s) => s.slug === slug);
}

/** Tags with counts, most used first. */
export function tagCounts(stories) {
  const map = new Map();
  for (const s of stories) for (const t of s.tags) map.set(t, (map.get(t) || 0) + 1);
  return [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** `tags · year · N PHOTOS · N FILMS` */
export function metaLine(s) {
  const photos = s.media.filter((m) => m.type === 'image').length;
  const films = s.media.filter((m) => m.type === 'video').length;
  return [
    ...s.tags,
    s.year,
    `${photos} ${photos === 1 ? 'photo' : 'photos'}`,
    films ? `${films} ${films === 1 ? 'film' : 'films'}` : null,
  ].filter(Boolean);
}

/** Embed URL for a film. `ambient` = muted, looping, chrome-less (for previews). */
export function embedUrl(v, { autoplay = false, ambient = false } = {}) {
  if (v.provider === 'youtube') {
    const p = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
    if (autoplay || ambient) p.set('autoplay', '1');
    if (ambient) {
      p.set('mute', '1');
      p.set('controls', '0');
      p.set('loop', '1');
      p.set('playlist', v.id);
    }
    return `https://www.youtube-nocookie.com/embed/${v.id}?${p}`;
  }
  const p = new URLSearchParams({ dnt: '1', title: '0', byline: '0', portrait: '0' });
  if (autoplay) p.set('autoplay', '1');
  if (ambient) p.set('background', '1');
  return `https://player.vimeo.com/video/${v.id}?${p}`;
}

// ---------------------------------------------------------------------------

/** Newest wedding first: by wedding date, then by when it was added. */
function sortNewest(stories) {
  const key = (s) => s.date || `${s.year || 0}-00-00`;
  return [...stories].sort((a, b) => key(b).localeCompare(key(a)) || String(b.created).localeCompare(String(a.created)));
}

async function fetchSanity() {
  const client = createClient({
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: SANITY_API_VERSION,
    useCdn: true,
  });
  const builder = createImageUrlBuilder({ projectId: SANITY_PROJECT_ID, dataset: SANITY_DATASET });

  let docs;
  try {
    docs = await client.fetch(QUERY);
  } catch (err) {
    throw new Error(`[amoura] Could not load stories from Sanity project "${SANITY_PROJECT_ID}" (${SANITY_DATASET}): ${err.message}`);
  }
  return normalizeSanity(docs, builder);
}

/** Maps raw GROQ results onto the normalised story shape. Exported for tests. */
export async function normalizeSanity(docs, builder) {
  const img = (source, w) => builder.image(source).width(w).fit('max').auto('format').quality(82).url();
  return Promise.all(
    docs.map(async (d) => {
      const coverDims = d.cover.asset?.metadata?.dimensions;
      const media = await Promise.all(
        (d.gallery || []).map(async (g) => {
          if (g._type === 'photo' && g.image?.asset) {
            const dims = g.image.asset.metadata?.dimensions;
            return {
              type: 'image',
              full: img(g.image, 2200),
              thumb: img(g.image, 900),
              lqip: g.image.asset.metadata?.lqip || null,
              aspect: dims?.aspectRatio || 2 / 3,
              alt: g.alt || '',
            };
          }
          if (g._type === 'videoEmbed' && g.videoId) {
            const provider = g.provider === 'youtube' ? 'youtube' : 'vimeo';
            const id = parseVideoId(provider, g.videoId);
            const poster = g.poster?.asset ? img(g.poster, 1600) : await providerPoster(provider, id);
            return { type: 'video', provider, id, poster, aspect: 16 / 9 };
          }
          return null;
        }),
      );
      return {
        slug: d.slug,
        brand: 'AMOURA',
        title: d.title,
        tags: d.tags || [],
        date: d.date || null,
        year: d.date ? Number(String(d.date).slice(0, 4)) : new Date(d._createdAt).getFullYear(),
        featured: !!d.featured,
        pinned: !!d.pinned,
        created: d._createdAt,
        desc: d.description || '',
        heroLoop: !!d.heroLoop,
        cover: img(d.cover, 1800),
        coverSm: img(d.cover, 900),
        coverLqip: d.cover.asset?.metadata?.lqip || null,
        coverAspect: coverDims?.aspectRatio || 2 / 3,
        media: media.filter(Boolean),
      };
    }),
  );
}

/** Accepts a bare id or any vimeo/youtube URL. */
export function parseVideoId(provider, raw) {
  const s = String(raw).trim();
  if (provider === 'youtube') {
    const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    return m ? m[1] : s;
  }
  const m = s.match(/(\d{5,})/);
  return m ? m[1] : s;
}

/** Provider thumbnail, resolved at build time. Returns null if unavailable. */
async function providerPoster(provider, id) {
  if (provider === 'youtube') return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  try {
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}&width=1600`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.thumbnail_url || null;
  } catch {
    return null;
  }
}
