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
      name: 'date',
      title: 'Wedding date',
      type: 'date',
      description: 'Sets the order everywhere. The newest wedding goes first, with the NEW badge.',
      options: { dateFormat: 'D MMMM YYYY' },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'featured',
      title: 'Show in spiral',
      type: 'boolean',
      description: 'Include this wedding in the spiral at the top of the home page.',
      initialValue: true,
    }),
    defineField({
      name: 'pinned',
      title: 'Pin to corridor',
      type: 'boolean',
      description: 'The memory corridor shows your 8 latest weddings automatically. Pin an older one to keep it there too.',
      initialValue: false,
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'location',
      description: 'Puts this wedding on the globe and in the counts (weddings · countries · places).',
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
      title: 'Newest wedding first',
      name: 'newest',
      by: [
        { field: 'date', direction: 'desc' },
        { field: '_createdAt', direction: 'desc' },
      ],
    },
  ],
  preview: {
    select: { title: 'title', date: 'date', featured: 'featured', pinned: 'pinned', media: 'cover' },
    prepare: ({ title, date, featured, pinned, media }) => ({
      title,
      subtitle: [date, featured ? 'spiral' : null, pinned ? '📌 corridor' : null].filter(Boolean).join(' · '),
      media,
    }),
  },
});
