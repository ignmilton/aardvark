import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aardvark.com';

/**
 * Dynamic sitemap generation for search engines.
 * Includes static pages and dynamically fetches published stories.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/explore`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/tags`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Fetch published stories for dynamic pages
  let storyPages: MetadataRoute.Sitemap = [];
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    const response = await fetch(`${apiUrl}/api/stories/sitemap`, {
      next: { revalidate: 3600 }, // Revalidate every hour
    });

    if (response.ok) {
      const stories: Array<{ slug: string; updatedAt: string }> = await response.json();
      storyPages = stories.map((story) => ({
        url: `${BASE_URL}/story/${story.slug}`,
        lastModified: new Date(story.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch {
    // Sitemap generation should not fail if API is unreachable
  }

  // Fetch author profiles
  let authorPages: MetadataRoute.Sitemap = [];
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:4000';
    const response = await fetch(`${apiUrl}/api/users/sitemap`, {
      next: { revalidate: 86400 }, // Revalidate daily
    });

    if (response.ok) {
      const authors: Array<{ username: string; updatedAt: string }> = await response.json();
      authorPages = authors.map((author) => ({
        url: `${BASE_URL}/author/${author.username}`,
        lastModified: new Date(author.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch {
    // Continue with static pages only
  }

  return [...staticPages, ...storyPages, ...authorPages];
}
