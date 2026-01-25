'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { BookOpen, Clock, ChevronRight, Play, Loader2 } from 'lucide-react';

interface ReadingProgress {
  id: string;
  storyId: string;
  storyTitle: string;
  storySlug: string;
  storyCoverUrl?: string;
  currentSegmentId: string;
  visitedCount: number;
  isCompleted: boolean;
  lastReadAt: string;
}

export function ContinueReading() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [progress, setProgress] = useState<ReadingProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProgress() {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/progress?limit=4&completed=false`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setProgress(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load reading progress:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (!authLoading) {
      loadProgress();
    }
  }, [isAuthenticated, authLoading]);

  // Don't render if not authenticated or no progress
  if (!isAuthenticated || authLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <section className="py-12 md:py-16 bg-primary/5">
        <div className="container-wide">
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </section>
    );
  }

  if (progress.length === 0) {
    return null;
  }

  return (
    <section className="py-12 md:py-16 bg-primary/5">
      <div className="container-wide">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Play className="h-6 w-6 text-primary" />
              Continue Reading
            </h2>
            <p className="text-muted-foreground mt-1">
              Pick up where you left off
            </p>
          </div>
          <Link href="/library">
            <Button variant="ghost">
              View Library <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {progress.map((item) => (
            <Link
              key={item.id}
              href={`/story/${item.storySlug}/read`}
              className="group flex flex-col bg-card rounded-xl overflow-hidden border hover:border-primary/50 hover:shadow-md transition-all"
            >
              {/* Cover Image */}
              <div className="aspect-[16/9] relative bg-muted">
                {item.storyCoverUrl ? (
                  <img
                    src={item.storyCoverUrl}
                    alt={item.storyTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <BookOpen className="h-10 w-10 text-primary/40" />
                  </div>
                )}
                {/* Progress Overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(item.visitedCount * 10, 100)}%` }}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                  {item.storyTitle}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{item.visitedCount} segments read</span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(item.lastReadAt)}
                </div>
                <div className="mt-auto pt-3">
                  <Button size="sm" className="w-full group-hover:bg-primary/90">
                    <Play className="h-3 w-3 mr-1" />
                    Continue
                  </Button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
