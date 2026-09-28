// Sanity Studio config — served at /admin once SANITY_PROJECT_ID is set (src/lib/config.js).
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { SANITY_DATASET, SANITY_PROJECT_ID } from './src/lib/config.js';
import { schemaTypes } from './src/schemaTypes/index.js';

export default defineConfig({
  name: 'amoura',
  title: 'amoura',
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  plugins: [structureTool()],
  schema: { types: schemaTypes },
});
