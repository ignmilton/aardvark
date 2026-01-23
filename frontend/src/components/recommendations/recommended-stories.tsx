'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Sparkles, TrendingUp, Users, UserCheck } from 'lucide-react';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Skeleton } from '@/components/ui/skeleton';

interface RecommendedStory {
  story: {
    id: string;
    title: string;
    slug: string;
    description: string;
    coverImage?: string;
    category: string;
    averageRating: number;
    viewCount: number;
    author: {
      id: string;
      username: string;
      displayName: string;
    };
  };
  score: number;
  reason: 'similar_readers' | 'similar_content' | 'popular' | 'trending' | 'author_follow';
}

const reasonIcons = {
  similar_readers: Users,
  similar_content: Sparkles,
  popular: TrendingUp,
  trending: TrendingUp,
  author_follow: UserCheck,
};

const reasonLabels = {
  similar_readers: 'Readers like you enjoyed this',
  similar_content: 'Based on your interests',
  popular: 'Popular right now',
  trending: 'Trending',
  author_follow: 'From authors you follow',
};

async function fetchRecommendations(limit: number): Promise<RecommendedStory[]> {
  const response = await fetch(`/api/stories/recommendations?limit=${limit}`, {
    credentials: 'include',
  });
  if (!response.ok) return [];
  return response.json();
}

interface RecommendedStoriesProps {
  limit?: number;
  title?: string;
}

export function RecommendedStories({ limit = 8, title = 'Recommended for You' }: RecommendedStoriesProps) {
  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['recommendations', limit],
    queryFn: () => fetchRecommendations(limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (error || (!isLoading && (!recommendations || recommendations.length === 0))) {
    return null; // Don't show section if no recommendations
  }

  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {title}
        </h2>
        <Link
          href="/explore?tab=for-you"
          className="text-sm text-muted-foreground hover:text-primary"
        >
          See all
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recommendations?.map((rec) => (
            <RecommendationCard key={rec.story.id} recommendation={rec} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecommendationCard({ recommendation }: { recommendation: RecommendedStory }) {
  const { story, reason } = recommendation;
  const ReasonIcon = reasonIcons[reason];

  return (
    <Link
      href={`/story/${story.slug}`}
      className="group block rounded-lg border bg-card overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      {story.coverImage && (
        <div className="relative h-36 w-full">
          <OptimizedImage
            src={story.coverImage}
            alt={story.title}
            fill
            className="rounded-t-lg"
          />
        </div>
      )}

      <div className="p-3 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
          {story.title}
        </h3>

        <p className="text-xs text-muted-foreground line-clamp-2">
          {story.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {story.author.displayName}
          </span>
          {story.averageRating > 0 && (
            <span className="text-xs text-amber-500">
              {'★'.repeat(Math.round(story.averageRating))}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
          <ReasonIcon className="h-3 w-3" />
          <span>{reasonLabels[reason]}</span>
        </div>
      </div>
    </Link>
  );
}
