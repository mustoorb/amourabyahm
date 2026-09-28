// @ts-check
import { fileURLToPath } from 'node:url';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import sanity from '@sanity/astro';
import { defineConfig } from 'astro/config';
import { SANITY_API_VERSION, SANITY_DATASET, SANITY_PROJECT_ID } from './src/lib/config.js';

// TODO: set the real domain — used for canonical URLs, OG tags and the sitemap.
const SITE = process.env.SITE_URL || 'https://example.com';

/** /admin: embedded Sanity Studio once a project id is set; a setup note until then. */
const studio = SANITY_PROJECT_ID
  ? [
      sanity({
        projectId: SANITY_PROJECT_ID,
        dataset: SANITY_DATASET,
        apiVersion: SANITY_API_VERSION,
        useCdn: false,
        studioBasePath: '/admin',
        // Hash routing lets the Studio ship as a static page — no server adapter needed.
        studioRouterHistory: 'hash',
      }),
      react(),
    ]
  : [
      {
        name: 'amoura:admin-placeholder',
        hooks: {
          'astro:config:setup': ({ injectRoute }) =>
            injectRoute({
              pattern: '/admin',
              entrypoint: fileURLToPath(new URL('./src/admin-placeholder.astro', import.meta.url)),
            }),
        },
      },
    ];

export default defineConfig({
  site: SITE,
  integrations: [
    ...studio,
    sitemap({ filter: (page) => !/\/(admin|lab)(\/|$)/.test(new URL(page).pathname) }),
  ],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  vite: { build: { chunkSizeWarningLimit: 900 } },
});
