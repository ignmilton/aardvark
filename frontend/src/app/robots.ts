import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aardvark.com';

/**
 * Robots.txt configuration for search engine crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/editor/',
          '/settings/',
          '/library/',
          '/messages/',
          '/notifications/',
          '/offline/',
          '/_next/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/editor/', '/settings/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
