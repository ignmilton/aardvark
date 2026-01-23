import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aardvark.com';

/**
 * Generate metadata for a story page
 */
export function generateStoryMetadata(story: {
  title: string;
  description: string;
  slug: string;
  author: string;
  coverImage?: string;
  tags?: string[];
  rating?: number;
  wordCount?: number;
  publishedAt?: string;
}): Metadata {
  const url = `${BASE_URL}/story/${story.slug}`;
  const image = story.coverImage || `${BASE_URL}/og-image.png`;

  return {
    title: story.title,
    description: story.description,
    keywords: story.tags,
    authors: [{ name: story.author }],
    openGraph: {
      title: story.title,
      description: story.description,
      url,
      type: 'article',
      authors: [story.author],
      publishedTime: story.publishedAt,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: story.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: story.title,
      description: story.description,
      images: [image],
    },
    alternates: {
      canonical: url,
    },
  };
}

/**
 * Generate metadata for an author profile page
 */
export function generateAuthorMetadata(author: {
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  storyCount?: number;
}): Metadata {
  const url = `${BASE_URL}/author/${author.username}`;
  const description = author.bio || `Read interactive stories by ${author.displayName} on Aardvark.`;

  return {
    title: `${author.displayName} - Author Profile`,
    description,
    openGraph: {
      title: `${author.displayName} on Aardvark`,
      description,
      url,
      type: 'profile',
      images: author.avatar
        ? [{ url: author.avatar, width: 256, height: 256, alt: author.displayName }]
        : undefined,
    },
    twitter: {
      card: 'summary',
      title: `${author.displayName} on Aardvark`,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

/**
 * Generate JSON-LD structured data for a story (CreativeWork)
 */
export function generateStoryJsonLd(story: {
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
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: story.title,
    description: story.description,
    url: `${BASE_URL}/story/${story.slug}`,
    image: story.coverImage,
    author: {
      '@type': 'Person',
      name: story.author,
      url: story.authorUrl,
    },
    datePublished: story.publishedAt,
    dateModified: story.updatedAt,
    genre: story.tags?.join(', '),
    wordCount: story.wordCount,
    isAccessibleForFree: story.isFree ?? true,
    interactivityType: 'mixed',
    ...(story.rating && story.ratingCount
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: story.rating,
            ratingCount: story.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    publisher: {
      '@type': 'Organization',
      name: 'Aardvark',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/icons/icon-512x512.png`,
      },
    },
  };
}

/**
 * Generate JSON-LD structured data for the website (Organization + WebSite)
 */
export function generateWebsiteJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Aardvark',
      url: BASE_URL,
      description: 'Create, read, and share interactive stories with branching narratives.',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${BASE_URL}/explore?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Aardvark',
      url: BASE_URL,
      logo: `${BASE_URL}/icons/icon-512x512.png`,
      sameAs: [],
    },
  ];
}

/**
 * Generate BreadcrumbList JSON-LD
 */
export function generateBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  };
}
