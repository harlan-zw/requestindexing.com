import { resolve } from 'node:path'
import { defineCollection, defineContentConfig } from '@harlan-zw/comark-content'
import { defineOgImageSchema, defineRobotsSchema, defineSchemaOrgSchema, defineSitemapSchema } from '@nuxtjs/seo/content'
import { z } from 'zod'

const schema = z.object({
  icon: z.string().optional(),
  publishedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  readTime: z.string().optional(),
  relatedPages: z.array(z.object({
    path: z.string(),
    title: z.string(),
  })).optional(),
  robots: defineRobotsSchema({ z }),
  sitemap: defineSitemapSchema({ z }),
  ogImage: defineOgImageSchema({ z }),
  schemaOrg: defineSchemaOrgSchema({ z }),
})

export default defineContentConfig({
  collections: {
    guides: defineCollection({
      schema,
      type: 'page',
      source: {
        include: '**/*.md',
        cwd: resolve(import.meta.dirname, './content/guides'),
        prefix: '/',
      },
    }),
    comparisons: defineCollection({
      schema,
      type: 'page',
      source: {
        include: '**/*.md',
        cwd: resolve(import.meta.dirname, './content/comparisons'),
        prefix: '/comparisons',
      },
    }),
  },
})
