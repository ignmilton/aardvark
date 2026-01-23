import { generateStoryJsonLd, generateBreadcrumbJsonLd } from '@/lib/seo';
import { JsonLd } from './json-ld';

interface StoryStructuredDataProps {
  story: {
    title: string;
    description: string;
    slug: string;
    author: string;
    authorUrl?: string;
    coverImage?: string;
    rating?: number;
    ratingCount?: number;
    wordCount?: number;
    publishedAt?: string;
    updatedAt?: string;
    tags?: string[];
    isFree?: boolean;
    category?: string;
  };
}

/**
 * Renders structured data for a story page including
 * CreativeWork schema and BreadcrumbList.
 */
export function StoryStructuredData({ story }: StoryStructuredDataProps) {
  const storyJsonLd = generateStoryJsonLd(story);
  const breadcrumbs = generateBreadcrumbJsonLd([
    { name: 'Home', url: '/' },
    ...(story.category
      ? [{ name: story.category, url: `/explore?category=${story.category}` }]
      : []),
    { name: story.title, url: `/story/${story.slug}` },
  ]);

  return <JsonLd data={[storyJsonLd, breadcrumbs]} />;
}
