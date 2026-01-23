'use client';

import { useEffect, useState } from 'react';
import { WifiOff, BookOpen } from 'lucide-react';
import { useOfflineReading } from '@/hooks/use-offline-reading';
import Link from 'next/link';

interface OfflineStory {
  storyId: string;
  title: string;
  author: string;
  savedAt: number;
}

export default function OfflinePage() {
  const { savedStories, isOnline } = useOfflineReading();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">
          {isOnline ? 'Offline Library' : "You're Offline"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isOnline
            ? 'Stories saved for offline reading.'
            : "Don't worry! You can still read your saved stories."}
        </p>
      </div>

      {savedStories.length > 0 ? (
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Saved Stories ({savedStories.length})
          </h2>
          {savedStories.map((story: OfflineStory) => (
            <Link
              key={story.storyId}
              href={`/story/${story.storyId}/read?offline=true`}
              className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{story.title}</p>
                <p className="text-sm text-muted-foreground">by {story.author}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                Saved {new Date(story.savedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No stories saved for offline reading yet.
            {isOnline && ' Browse stories and tap "Save offline" to read them without internet.'}
          </p>
        </div>
      )}
    </div>
  );
}
