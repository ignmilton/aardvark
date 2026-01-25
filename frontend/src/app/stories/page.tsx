'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Star,
  Clock,
  Sparkles,
  ChevronRight,
  Loader2,
  BookOpen,
} from 'lucide-react';

interface Story {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImageUrl?: string;
  authorName: string;
  authorUsername: string;
  averageRating: number;
  viewCount: number;
  category: string;
  tags: string[];
  isPremium: boolean;
}

interface StoriesResponse {
  success: boolean;
  data: Story[];
  meta?: { total: number };
}

const CATEGORIES = [
  { id: 'fantasy', label: 'Fantasy', emoji: '🧙' },
  { id: 'sci-fi', label: 'Sci-Fi', emoji: '🚀' },
  { id: 'romance', label: 'Romance', emoji: '💕' },
  { id: 'mystery', label: 'Mystery', emoji: '🔍' },
  { id: 'horror', label: 'Horror', emoji: '👻' },
  { id: 'adventure', label: 'Adventure', emoji: '⚔️' },
  { id: 'thriller', label: 'Thriller', emoji: '😱' },
  { id: 'comedy', label: 'Comedy', emoji: '😂' },
  { id: 'drama', label: 'Drama', emoji: '🎭' },
  { id: 'historical', label: 'Historical', emoji: '📜' },
];

function StoryCard({ story }: { story: Story }) {
  return (
    <Link
      href={`/story/${story.slug}`}
      className="group block overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md hover:border-primary/50"
    >
      <div className="aspect-[3/4] relative bg-muted">
        {story.coverImageUrl ? (
          <img
            src={story.coverImageUrl}
            alt={story.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
            <BookOpen className="h-12 w-12 text-primary/40" />
          </div>
        )}
        {story.isPremium && (
          <span className="absolute top-2 right-2 px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">
            Premium
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
          {story.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          by {story.authorName}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          {story.averageRating > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {story.averageRating.toFixed(1)}
            </span>
          )}
          <span>{story.viewCount.toLocaleString()} views</span>
        </div>
      </div>
    </Link>
  );
}

function StorySection({
  title,
  icon: Icon,
  stories,
  isLoading,
  href,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  stories: Story[];
  isLoading: boolean;
  href?: string;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stories.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground">No stories found</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function StoriesPage() {
  const [trending, setTrending] = useState<Story[]>([]);
  const [topRated, setTopRated] = useState<Story[]>([]);
  const [recent, setRecent] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStories() {
      try {
        const [trendingRes, topRatedRes, recentRes] = await Promise.all([
          fetchApi<StoriesResponse>('/stories?sortBy=views&limit=10'),
          fetchApi<StoriesResponse>('/stories?sortBy=rating&limit=10'),
          fetchApi<StoriesResponse>('/stories?sortBy=created&limit=10'),
        ]);

        setTrending(trendingRes.data || []);
        setTopRated(topRatedRes.data || []);
        setRecent(recentRes.data || []);
      } catch (error) {
        console.error('Failed to load stories:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadStories();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Explore Stories</h1>
          <p className="text-muted-foreground">
            Discover interactive stories across all genres
          </p>
        </div>

        {/* Categories */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={`/search?category=${cat.id}`}
                className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted hover:border-primary/50 transition-colors"
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="font-medium">{cat.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Trending Stories */}
        <StorySection
          title="Trending Now"
          icon={TrendingUp}
          stories={trending}
          isLoading={isLoading}
          href="/search?sort=views"
        />

        {/* Top Rated */}
        <StorySection
          title="Top Rated"
          icon={Star}
          stories={topRated}
          isLoading={isLoading}
          href="/search?sort=rating"
        />

        {/* Recently Added */}
        <StorySection
          title="Recently Added"
          icon={Clock}
          stories={recent}
          isLoading={isLoading}
          href="/search?sort=created"
        />

        {/* CTA */}
        <div className="text-center py-10 border-t mt-10">
          <Sparkles className="h-10 w-10 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-2">Ready to create your own story?</h2>
          <p className="text-muted-foreground mb-4">
            Build interactive adventures and share them with the world
          </p>
          <Button asChild size="lg">
            <Link href="/create">Start Writing</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
