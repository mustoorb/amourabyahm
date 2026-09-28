import { defineField, defineType } from 'sanity';

export const videoEmbed = defineType({
  name: 'videoEmbed',
  title: 'Film',
  type: 'object',
  fields: [
    defineField({
      name: 'provider',
      title: 'Provider',
      type: 'string',
      options: { list: ['vimeo', 'youtube'], layout: 'radio', direction: 'horizontal' },
      initialValue: 'vimeo',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'videoId',
      title: 'Video ID',
      type: 'string',
      description: 'Just the id — e.g. 76979871 for vimeo.com/76979871, or dQw4w9WgXcQ for youtube.com/watch?v=dQw4w9WgXcQ. A full URL is fine too.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'poster',
      title: 'Poster (optional)',
      type: 'image',
      options: { hotspot: true },
      description: 'Still used before the film plays. If empty, the provider thumbnail is used.',
    }),
  ],
  preview: {
    select: { provider: 'provider', id: 'videoId', media: 'poster' },
    prepare: ({ provider, id, media }) => ({ title: `Film · ${provider || '?'}`, subtitle: id, media }),
  },
});
