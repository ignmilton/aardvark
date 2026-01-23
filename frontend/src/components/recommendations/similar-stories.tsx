'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Skeleton } from '@/components/ui/skeleton';

interface SimilarStory {
  id: string;
  title: string;
  slug: string;
  coverImage?: string;
  averageRating: number;
  author: {
    displayName: string;
  };
}

async function fetchSimilarStories(storyId: string, limit: number): Promise<SimilarStory[]> {
  const response = await fetch(`/api/stories/${storyId}/similar?limit=${limit}`);
  if (!response.ok) return [];
  return response.json();
}

interface SimilarStoriesProps {
  storyId: string;
  limit?: number;
}

/**
 * Displays stories similar to the current one on story detail pages.
 */
export function SimilarStories({ storyId, limit = 4 }: SimilarStoriesProps) {
  const { data: stories, isLoading } = useQuery({
    queryKey: ['similar-stories', storyId, limit],
    queryFn: () => fetchSimilarStories(storyId, limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (!isLoading && (!stories || stories.length === 0)) {
    return null;
  }

  return (
    <section aria-label="Similar stories" className="mt-8">
      <h3 className="text-lg font-semibold mb-4">You might also like</h3>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stories?.map((story) => (
            <Link
              key={story.id}
              href={`/story/${story.slug}`}
              className="group rounded-lg border bg-card overflow-hidden transition-all hover:shadow-sm"
            >
              {story.coverImage && (
                <div className="relative h-28 w-full">
                  <OptimizedImage
                    src={story.coverImage}
                    alt={story.title}
                    fill
                    className="rounded-t-lg"
                  />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-medium line-clamp-2 group-hover:text-primary">
                  {story.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {story.author.displayName}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
