import { defineField, defineType } from 'sanity';

export const photo = defineType({
  name: 'photo',
  title: 'Photo',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'alt', title: 'Alt text', type: 'string', description: 'Short description for screen readers (optional).' }),
  ],
  preview: {
    select: { media: 'image', title: 'alt' },
    prepare: ({ media, title }) => ({ media, title: title || 'Photo' }),
  },
});
