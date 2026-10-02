import { defineField, defineType } from 'sanity';
import { parseCoordinates } from '../lib/coords.js';

export const location = defineType({
  name: 'location',
  title: 'Location',
  type: 'object',
  options: { columns: 2 },
  fields: [
    defineField({ name: 'place', title: 'Place', type: 'string', description: 'Venue or town, e.g. “Château de Chantilly” or “Lake Como”.', validation: (r) => r.required() }),
    defineField({ name: 'country', title: 'Country', type: 'string', description: 'e.g. France, United Arab Emirates, Italy.', validation: (r) => r.required() }),
    defineField({
      name: 'coordinates',
      title: 'Map coordinates',
      type: 'string',
      description: 'In Google Maps, right-click the spot and click the numbers at the top to copy them, then paste here — e.g. 49.1940, 2.4855',
      validation: (r) =>
        r.required().custom((v) => (v && !parseCoordinates(v) ? 'Paste them like “49.1940, 2.4855” (latitude, longitude).' : true)),
    }),
  ],
});
