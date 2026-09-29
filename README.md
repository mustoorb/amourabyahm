# amoura®

Cinematic wedding films & photographs — the studio site.
Astro (static) · Three.js · Sanity CMS · deployed on Netlify.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
```

With no Sanity project configured the site runs on bundled demo stories (`src/data.js`), so it always builds.

## Routes

| Route | Page |
|---|---|
| `/` | **Home**: spiral opening → scroll-driven Memory Corridor (featured stories) → kind words, stats & venues, collections, how we work, enquiry form. |
| `/story/<slug>` | **Story** — full-bleed hero, meta, masonry of photos + inline films, lightbox, “Next story →”. One static page per wedding. |
| `/archive` | **Archive**: every story. On desktop it's an infinite canvas (drag/scroll, pinch or +/− to zoom). Phones get a two-up grid. Filter by tag (`?tag=Paris` is shareable). |
| `/about` | **About** — studio, people, process, contact. |
| `/admin` | **Sanity Studio** — live once `SANITY_PROJECT_ID` is set; a setup note until then. |
| `/lab` | Hero-gallery concepts (not indexed): corridor tuning panel, scroll-story, memory wall. |

Navigation uses Astro’s `<ClientRouter />` (View Transitions). Clicking a corridor frame or an archive card morphs that image into the story hero (`view-transition-name: hero-<slug>`).

## Hero gallery: Memory Corridor

Chosen from the §6 options: **Corridor on the home page, with the Scroll-Story language used on the story pages.**

You glide forward through frames in warm dark space. Each featured story contributes its cover plus a couple of moments (a photo and its first film). The frame you arrive at snaps sharp and bright; everything else is softly defocused, dimmer and desaturated. Films start playing (muted) when you stop at them.

- **Input:** wheel/trackpad, drag/swipe (with inertia), arrow keys / PageUp/PageDown / Home/End, Enter to open, click/tap any frame. The right-hand ticks jump between stories.
- **Magnetic snap:** a frame is always framed when you let go. One wheel notch or a short swipe commits to the next frame.
- **Newest story:** first featured story, framed front-and-centre on load, with a rose `NEW` badge and a soft pulsing glow.
- **End of the corridor:** a prompt into the Archive.
- **Performance:** textures load in a window around the camera and are freed behind it, so any catalogue size stays light. Three.js is lazy-loaded (~140 KB gzipped) on the home page only.
- **Fallbacks:** without WebGL the page shows a swipeable strip of cover cards. Screen readers and crawlers always get a plain list of links.
- **Feel knobs:** `KNOBS` at the top of `src/scripts/corridor.js` (spacing, sizes, damping, inertia, drag/wheel speed, blur, fog, mobile counts…). Tune them live at `/lab/corridor`.

### Premium pass (§10) — where each item lives

1. Depth focus — frame shader in `corridor.js` (`uFocus`: dim + desaturate by distance from focus).
2. Shared-element open — `Corridor.astro` `openStory()` + `heroName()` in `src/lib/vt.js`.
3. Staggered entrance — `reveal()` in `corridor.js`, fired as the loader lifts.
4. Film grain + vignette — global overlay (`.grain`, `.vignette`); grain tile generated at runtime.
5. Hover craft + custom cursor — frame lift/zoom/glow in the shader; `src/scripts/cursor.js`.
6. Sharper textures — full-size images on desktop, trilinear mipmaps and max anisotropy.
7. Warm grade — the same shader, applied to every frame.
8. Ambient sound — `src/scripts/sound.js`, synthesised with WebAudio (no audio files). Off by default; the `SOUND` toggle turns it on and the choice is remembered.
9. Editorial story pages — `src/pages/story/[slug].astro` (parallax hero, big type, optional muted hero film loop, reveal on scroll, Next story).
10. Magnetic snap — see above.

Motion respects `prefers-reduced-motion` everywhere: there's no inertia, float or parallax, transitions are instant, and film previews don't autoplay.

## Content

`src/lib/content.js` is the one place pages get stories from. It returns:

```js
{
  slug, brand: 'AMOURA', title, tags[], year, featured, created, desc, heroLoop,
  cover, coverSm, coverLqip, coverAspect,
  media: [
    { type: 'image', full, thumb, lqip, aspect, alt },
    { type: 'video', provider: 'vimeo' | 'youtube', id, poster, aspect },
  ],
}
```

Order is newest-first: featured → year → created date. `SPHERE_CAP` (in the same file) caps how many featured stories the hero shows.

### Sanity schema (`src/schemaTypes/`)

- **story**: title, slug, year, `featured` (“Show on hero”), tags, description, **cover** (required), **gallery** (drag-orderable `photo` + `videoEmbed`), `heroLoop`.
- **photo**: image (hotspot) + optional alt text.
- **videoEmbed**: provider (vimeo/youtube), video id (a pasted URL works too), optional poster.

**No media lives in the repo.** Photos are served from the Sanity CDN, and films are Vimeo/YouTube embeds.

## Config knobs

| Where | What |
|---|---|
| `src/lib/config.js` | `SANITY_PROJECT_ID`, `SANITY_DATASET`, `AMOURA_CHAT_URL` (every “Let’s Talk”), brand line, clocks. Each can also come from a `PUBLIC_*` env var (see `.env.example`; on Netlify, set them under Site configuration → Environment variables). |
| `src/lib/content.js` | `SPHERE_CAP` — hero story count. |
| `src/scripts/corridor.js` | `KNOBS` — gallery feel. |
| `astro.config.mjs` | `site` (via `SITE_URL`) — canonical/OG/sitemap domain. |

## Going live — checklist

1. **Sanity**
   - Create a free project at sanity.io/manage.
   - Set `SANITY_PROJECT_ID` (or `PUBLIC_SANITY_PROJECT_ID`).
   - Under **API → CORS origins**, add `http://localhost:4321` and the production URL (your `*.netlify.app` address and/or custom domain), with credentials allowed.
   - Add stories at `/admin`.
2. Delete the demo `makeArchive()` filler from `src/data.js` (it's unused once Sanity is on).
3. Replace the About copy and people in `src/data.js` (`studio`). They're placeholders.
4. Set the real **`AMOURA_CHAT_URL`**. Until then, “Let’s Talk” points to `/about#contact`.
5. Set the real **domain** (`SITE_URL` env var in Netlify → Site configuration → Environment variables, or edit `astro.config.mjs`).
6. **Deploy on Netlify:** Add new site → Import from Git → pick `amourabyahm`, branch `main`. `netlify.toml` already sets the build command (`npm run build`), the publish directory (`dist`) and Node 22, so leave those fields as detected. The output is fully static (no adapter or functions). The Studio uses hash routing, so `/admin` is a static page too.
7. Optional: add a Sanity webhook that calls a Netlify build hook (Site configuration → Build & deploy → Build hooks), so CMS edits auto-publish.
8. Add analytics (e.g. Netlify Analytics), then do a final a11y/perf pass.

### Notes on films

- A film preview in the corridor and the optional hero loop use Vimeo `background=1`. The video owner needs a Vimeo Plus plan or higher for that player to render. YouTube embeds always work.
- Film posters: an uploaded poster in Sanity always works. Otherwise the build uses the provider thumbnail (Vimeo via oEmbed, YouTube via `i.ytimg.com`). If a thumbnail host blocks cross-origin use, the corridor draws a titled placeholder frame for that film.

## Home page, top to bottom

1. **Spiral** (`src/components/Spiral.astro`, `src/scripts/vortex.js`): wedding frames rush in along spiral arms and calm behind the headline, with Let's Talk and See the stories. Scrolling flies you in.
2. **Memory Corridor, scroll-driven** (`src/components/CorridorScroll.astro`): the stage is pinned while you scroll, and each scroll step moves the camera one frame. There's one cover plus one moment (its film if it has one) per featured story.
   - **Touch:** native scroll-snap with `scroll-snap-stop`, so one swipe moves one frame.
   - **Mouse/trackpad:** smooth-scrolled (Lenis) with a gentle, direction-aware snap.
   - "Skip to collections" jumps past it.
3. **Section menu** (Stories · Kind words · Collections · How we work · Enquire): pinned under the header once you're past the corridor, and it highlights where you are.
4. **Kind words** (`Quotes.astro`) → stats & venue marquee → **Collections** (`Packages.astro`) → **How we work** → **Enquiry form** (`Enquire.astro`).
   - Each "Enquire about …" button pre-selects that collection in the form.
   - WhatsApp floats one tap away.

To finish it:
1. **Sample content:** quotes, stats, venues and the three collections are placeholders in `src/data.js` → `sales`. Replace them, then set `sample: false` to remove the dashed "Sample" tags.
2. **WhatsApp:** set `PUBLIC_WHATSAPP_NUMBER` (digits, international format) in Netlify env vars, or in `src/lib/config.js`. Until then, WhatsApp buttons go to the form.
3. **Enquiries:** the form uses **Netlify Forms**. In Netlify → Forms, make sure form detection is enabled, then add an email notification so each enquiry reaches your inbox. Submissions only work on the deployed site, not in local dev.

`/lab/home-v2` keeps the earlier three-act preview for reference, and `/lab/corridor` keeps the full-screen corridor with its tuning panel.

## Not in this repo

- The Film-Reel Ribbon concept.
- The parked curved-card sphere from the previous build. It wasn't in the repository when this was built.
