import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * App-Router robots route. In Next.js, this takes precedence over a static
 * `public/robots.txt` file, so we no longer keep the domain literal in two
 * places — both this file and the sitemap reference `@/lib/site`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
