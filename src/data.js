// Demo content — used only while SANITY_PROJECT_ID is empty (see src/lib/config.js).
//
// Photos are remote placeholders (picsum.photos) so no media ever lives in the repo.
// Once Sanity is connected this file is ignored; delete `makeArchive()` when real
// stories exist.

const pic = (seed, w, h) => `https://picsum.photos/seed/amoura-${seed}/${w}/${h}`;

/** Build a normalised demo photo at a given aspect (w/h). */
function photo(seed, aspect = 2 / 3) {
  const w = aspect >= 1 ? 1800 : Math.round(1800 * aspect);
  const h = aspect >= 1 ? Math.round(1800 / aspect) : 1800;
  const tw = aspect >= 1 ? 900 : Math.round(900 * aspect);
  const th = aspect >= 1 ? Math.round(900 / aspect) : 900;
  return {
    type: 'image',
    full: pic(seed, w, h),
    thumb: pic(seed, tw, th),
    lqip: `${pic(seed, 16, Math.max(1, Math.round(16 / aspect)))}?blur=2`,
    aspect,
  };
}

/** Demo film. Posters are placeholders; real films resolve provider thumbnails. */
function film(provider, id, seed) {
  return { type: 'video', provider, id, poster: pic(seed, 1600, 900), aspect: 16 / 9 };
}

const P = 2 / 3; // portrait
const L = 3 / 2; // landscape
const S = 4 / 5; // near-square portrait

function story({ slug, title, tags, year, created, featured = true, desc, cover, media, heroLoop = false }) {
  const c = photo(cover[0], cover[1]);
  return {
    slug,
    brand: 'AMOURA',
    title,
    tags,
    year,
    featured,
    created,
    desc,
    heroLoop,
    cover: c.full,
    coverSm: c.thumb,
    coverLqip: c.lqip,
    coverAspect: c.aspect,
    media: media.map((m) => (m[0] === 'film' ? film(m[1], m[2], m[3]) : photo(m[0], m[1]))),
  };
}

const featured = [
  story({
    slug: 'lea-karim-chantilly',
    title: 'Léa & Karim',
    tags: ['Château', 'Paris'],
    year: 2026,
    created: '2026-06-14',
    desc: 'A summer evening at Chantilly — linen, late light, and a first dance under the orangery glass while the whole garden held its breath.',
    cover: ['lk-cover', P],
    media: [['lk1', L], ['film', 'vimeo', '22439234', 'lk-film'], ['lk2', P], ['lk3', P], ['lk4', L], ['lk5', S], ['lk6', P], ['lk7', L], ['lk8', P]],
  }),
  story({
    slug: 'noor-adam-al-maha',
    title: 'Noor & Adam',
    tags: ['Desert', 'Dubai'],
    year: 2026,
    created: '2026-03-02',
    desc: 'Vows at golden hour in the dunes outside Dubai, then a lantern-lit dinner that ran until the stars came out properly.',
    cover: ['na-cover', L],
    media: [['na1', P], ['na2', L], ['na3', P], ['film', 'vimeo', '76979871', 'na-film'], ['na4', S], ['na5', P], ['na6', L]],
  }),
  story({
    slug: 'camille-theo-riviera',
    title: 'Camille & Théo',
    tags: ['Riviera', 'Destination'],
    year: 2025,
    created: '2025-09-20',
    desc: 'Cap Ferrat in September: salt air, a cliffside ceremony, and a speech that made the fathers cry first.',
    cover: ['ct-cover', P],
    media: [['ct1', P], ['ct2', L], ['ct3', P], ['ct4', P], ['ct5', L], ['ct6', S]],
  }),
  story({
    slug: 'sara-yusuf-marrakech',
    title: 'Sara & Yusuf',
    tags: ['Destination', 'Garden'],
    year: 2025,
    created: '2025-05-11',
    desc: 'Three days in a Marrakech riad — rose petals on the tiles, oud in the courtyard, and a henna night lit entirely by candles.',
    cover: ['sy-cover', S],
    media: [['sy1', L], ['sy2', P], ['film', 'vimeo', '22439234', 'sy-film'], ['sy3', P], ['sy4', L], ['sy5', P]],
  }),
  story({
    slug: 'ines-marc-montmartre',
    title: 'Inès & Marc',
    tags: ['Intimate', 'Paris'],
    year: 2025,
    created: '2025-02-14',
    desc: 'Twelve guests, one tiny mairie in Montmartre, and a long, rain-soft walk down the steps of Sacré-Cœur.',
    cover: ['im-cover', P],
    media: [['im1', P], ['im2', P], ['im3', L], ['im4', S], ['im5', P]],
  }),
  story({
    slug: 'maya-omar-palm',
    title: 'Maya & Omar',
    tags: ['Night', 'Dubai'],
    year: 2024,
    created: '2024-11-30',
    desc: 'A black-tie night on the Palm: a wall of white orchids, fireworks over the water, and a dance floor that never emptied.',
    cover: ['mo-cover', L],
    media: [['mo1', P], ['film', 'vimeo', '76979871', 'mo-film'], ['mo2', L], ['mo3', P], ['mo4', P], ['mo5', L]],
  }),
  story({
    slug: 'elise-jonas-provence',
    title: 'Élise & Jonas',
    tags: ['Garden', 'Château'],
    year: 2024,
    created: '2024-07-06',
    desc: 'Lavender rows, long tables under the plane trees, and a grandmother who stole every single frame she walked into.',
    cover: ['ej-cover', P],
    media: [['ej1', L], ['ej2', P], ['ej3', P], ['ej4', S], ['ej5', L]],
  }),
  story({
    slug: 'lina-rami-lake-como',
    title: 'Lina & Rami',
    tags: ['Destination', 'Intimate'],
    year: 2024,
    created: '2024-05-18',
    desc: 'A boat across Lake Como at dawn, a villa garden ceremony, and quiet portraits in the mist before the guests woke.',
    cover: ['lr-cover', S],
    media: [['lr1', P], ['lr2', L], ['film', 'vimeo', '22439234', 'lr-film'], ['lr3', P], ['lr4', P]],
  }),
];

const firstNames = ['Anaïs', 'Hugo', 'Yasmin', 'Louis', 'Rania', 'Victor', 'Jade', 'Samir', 'Chloé', 'Nadim', 'Zoé', 'Tarek', 'Manon', 'Idris', 'Salomé', 'Karim', 'Laila', 'Paul'];
const places = [
  ['Versailles', ['Château', 'Paris']],
  ['Abu Dhabi', ['Desert', 'Dubai']],
  ['Saint-Tropez', ['Riviera']],
  ['Santorini', ['Destination']],
  ['Le Marais', ['Intimate', 'Paris']],
  ['Hatta', ['Desert']],
  ['Bordeaux', ['Garden', 'Château']],
  ['Jumeirah', ['Night', 'Dubai']],
  ['Amalfi', ['Destination', 'Riviera']],
];

/** Non-featured filler so the Archive has depth. Delete once real stories exist in Sanity. */
function makeArchive(count = 14) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = firstNames[(i * 2) % firstNames.length];
    const b = firstNames[(i * 2 + 1) % firstNames.length];
    const [place, tags] = places[i % places.length];
    const year = 2024 - Math.floor(i / 5);
    const month = String(12 - (i % 12)).padStart(2, '0');
    const id = `ar${i}`;
    const aspects = [P, L, S, P, P, L];
    out.push(
      story({
        slug: `${a}-${b}-${place}-${year}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'),
        title: `${a} & ${b}`,
        tags,
        year,
        created: `${year}-${month}-0${(i % 9) + 1}`,
        featured: false,
        desc: `${place}, ${year}. A day told in light and small gestures — the moments in between that end up mattering most.`,
        cover: [`${id}-cover`, aspects[i % aspects.length]],
        media: Array.from({ length: 5 + (i % 4) }, (_, k) => [`${id}-${k}`, aspects[(i + k) % aspects.length]]),
      }),
    );
  }
  return out;
}

export function demoStories() {
  return [...featured, ...makeArchive()];
}

/** About-page content. TODO: replace with the real studio copy and people. */
export const studio = {
  statement: 'We film love the way it feels — not the way it poses.',
  intro: [
    'amoura is a small wedding film and photography studio working between Paris and Dubai, and anywhere a couple wants us to follow them.',
    'We work quietly, mostly in available light, and we edit slowly. Every story is shot by the same two people from first look to last dance, so the film and the photographs read as one memory rather than two deliverables.',
  ],
  people: [
    { name: 'Director', role: 'Film · Direction · Edit', city: 'Paris' },
    { name: 'Photographer', role: 'Photography · Colour', city: 'Dubai' },
  ],
  process: [
    ['Talk', 'A first conversation about you — the day, the people, the feeling you want to keep.'],
    ['Plan', 'Timeline, light, locations. We scout where we can and plan around the golden hour.'],
    ['Shoot', 'Two of us, unobtrusive, from getting ready to the last song.'],
    ['Deliver', 'A graded film, a short teaser within a week, and a full, hand-edited photo story.'],
  ],
};

/**
 * Sales content for the home page (quotes, proof, offer).
 * TODO: every value here is a SAMPLE. Replace with real words, venues and prices,
 * then set `sample: false` — while it's true, the page marks these blocks as samples.
 */
export const sales = {
  sample: true,
  headline: 'Your day, kept the way it felt.',
  subline: 'Wedding films & photographs between Paris and Dubai — and anywhere love takes you.',
  quotes: [
    {
      text: 'We have watched our film more times than we can count. It doesn’t look like a wedding video — it feels like being back there.',
      who: 'Léa & Karim',
      where: 'Château de Chantilly',
    },
    {
      text: 'They were invisible all day, and somehow caught every look between us. Our families still talk about the photographs.',
      who: 'Noor & Adam',
      where: 'Al Maha, Dubai',
    },
    {
      text: 'From the first call it felt like friends were filming our wedding. Calm, kind, and the edit made us cry.',
      who: 'Camille & Théo',
      where: 'Cap Ferrat',
    },
  ],
  venues: ['Château de Chantilly', 'Al Maha Desert Resort', 'Cap Ferrat', 'Lake Como', 'Marrakech', 'Montmartre', 'Palm Jumeirah', 'Provence', 'Santorini', 'Versailles'],
  stats: [
    ['120+', 'weddings filmed'],
    ['14', 'countries'],
    ['2', 'of us, every time'],
  ],
  /** Collections shown side by side. `featured` gets the "Most chosen" highlight. */
  packages: [
    {
      id: 'essential',
      name: 'Essential',
      tagline: 'An intimate day, beautifully kept.',
      priceFrom: '€6,500',
      facts: '8 hours · 1 filmmaker + 1 photographer',
      includes: ['A 6–8 minute graded film', 'Full, hand-edited photo story', 'Private online gallery', 'Delivery within 8 weeks'],
    },
    {
      id: 'signature',
      name: 'Signature',
      tagline: 'The whole day, from first look to last dance.',
      priceFrom: '€9,800',
      facts: '12 hours · 2 filmmakers + 1 photographer',
      includes: ['A 12–15 minute feature film', 'One-minute teaser within a week', 'Full photo story + 40-page album', 'Speeches & vows, edited in full', 'Delivery within 6 weeks'],
      featured: true,
    },
    {
      id: 'heirloom',
      name: 'Heirloom',
      tagline: 'Every moment of the celebration, across every day.',
      priceFrom: '€14,500',
      facts: 'Multi-day · full team · drone',
      includes: ['Welcome dinner to farewell brunch', 'Feature film + documentary edit', 'Teaser within 72 hours', 'Heirloom album + parents’ albums', 'Aerial & cinematic drone coverage'],
    },
  ],
  packagesNote: 'Every collection is tailored to your day. Travel within Europe & the UAE is included; destination weddings are quoted on request.',
  offer: {
    priceFrom: '€6,500',
    bookingYear: 2027,
    note: 'A limited number of dates each season.',
    included: [
      'Two of us, from getting ready to the last dance',
      'A graded feature film + a one-minute teaser within a week',
      'A full, hand-edited photo story',
      'Travel anywhere — Paris & Dubai based',
    ],
  },
};
