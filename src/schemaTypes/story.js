import { defineArrayMember, defineField, defineType } from 'sanity';

export const story = defineType({
  name: 'story',
  title: 'Story',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', description: 'e.g. “Léa & Karim”', validation: (r) => r.required() }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 80 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      initialValue: () => new Date().getFullYear(),
      validation: (r) => r.required().integer().min(2000).max(2100),
    }),
    defineField({
      name: 'featured',
      title: 'Show on hero',
      type: 'boolean',
      description: 'Featured stories appear in the home gallery. Every story is always in the Archive.',
      initialValue: false,
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description: 'Used for Archive filters — e.g. Paris, Dubai, Château, Desert, Destination.',
    }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 3 }),
    defineField({
      name: 'cover',
      title: 'Cover',
      type: 'image',
      options: { hotspot: true },
      description: 'Used on the hero gallery, the Archive and social previews.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'gallery',
      title: 'Gallery',
      type: 'array',
      of: [defineArrayMember({ type: 'photo' }), defineArrayMember({ type: 'videoEmbed' })],
      options: { layout: 'grid' },
      description: 'Photos and films, in the order they should appear. Drag to reorder.',
    }),
    defineField({
      name: 'heroLoop',
      title: 'Play first film behind the headline',
      type: 'boolean',
      initialValue: false,
      description: 'Muted, looping, desktop only. Chrome-less Vimeo playback needs a Vimeo Plus plan or higher; YouTube always works.',
    }),
  ],
  orderings: [
    {
      title: 'Newest first',
      name: 'newest',
      by: [
        { field: 'featured', direction: 'desc' },
        { field: 'year', direction: 'desc' },
        { field: '_createdAt', direction: 'desc' },
      ],
    },
  ],
  preview: {
    select: { title: 'title', year: 'year', featured: 'featured', media: 'cover' },
    prepare: ({ title, year, featured, media }) => ({
      title,
      subtitle: [year, featured ? '★ hero' : null].filter(Boolean).join(' · '),
      media,
    }),
  },
});
