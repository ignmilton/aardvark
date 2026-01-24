'use client';

import { useQuery } from '@tanstack/react-query';
import { StoryCard } from '@/components/story/story-card';
import { StorySkeleton } from '@/components/ui/skeleton';
import type { Story } from '@aardvark/shared';

/**
 * Fetch trending stories from the API
 */
async function fetchTrendingStories(): Promise<Story[]> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/stories?sort=trending&limit=6`
  );
  if (!response.ok) throw new Error('Failed to fetch trending stories');
  const { data } = await response.json();
  return data.items;
}

/**
 * Trending stories section showing most popular stories this week.
 */
export function TrendingStories() {
  const { data: stories, isLoading, error } = useQuery({
    queryKey: ['stories', 'trending'],
    queryFn: fetchTrendingStories,
  });

  if (isLoading) {
    return <StorySkeleton count={6} />;
  }

  if (error || !stories?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No trending stories right now. Be the first to publish!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} />
      ))}
    </div>
  );
}
