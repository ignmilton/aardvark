'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Bookmark,
  Clock,
  PenTool,
  Loader2,
  Play,
  Star,
  Trash2,
} from 'lucide-react';

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

interface SavedStory {
  id: string;
  storyId: string;
  title: string;
  slug: string;
  coverImageUrl?: string;
  authorName: string;
  savedAt: string;
}

interface MyStory {
  id: string;
  title: string;
  slug: string;
  coverImageUrl?: string;
  status: 'draft' | 'published' | 'archived';
  viewCount: number;
  averageRating: number;
  updatedAt: string;
}

type TabId = 'reading' | 'saved' | 'my-stories';

export default function LibraryPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('reading');
  const [readingProgress, setReadingProgress] = useState<ReadingProgress[]>([]);
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [myStories, setMyStories] = useState<MyStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/library');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load data
  useEffect(() => {
    async function loadLibraryData() {
      if (!isAuthenticated) return;

      try {
        const token = localStorage.getItem('accessToken');
        const headers = { Authorization: `Bearer ${token}` };

        const [progressRes, savedRes, myStoriesRes] = await Promise.allSettled([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/progress`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/saved-stories`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/stories`, { headers }),
        ]);

        if (progressRes.status === 'fulfilled' && progressRes.value.ok) {
          const data = await progressRes.value.json();
          setReadingProgress(data.data || []);
        }

        if (savedRes.status === 'fulfilled' && savedRes.value.ok) {
          const data = await savedRes.value.json();
          setSavedStories(data.data || []);
        }

        if (myStoriesRes.status === 'fulfilled' && myStoriesRes.value.ok) {
          const data = await myStoriesRes.value.json();
          setMyStories(data.data || []);
        }
      } catch (error) {
        console.error('Failed to load library:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadLibraryData();
  }, [isAuthenticated]);

  const removeProgress = async (progressId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/progress/${progressId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setReadingProgress((prev) => prev.filter((p) => p.id !== progressId));
    } catch (error) {
      console.error('Failed to remove progress:', error);
    }
  };

  const removeSavedStory = async (storyId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stories/${storyId}/save`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedStories((prev) => prev.filter((s) => s.storyId !== storyId));
    } catch (error) {
      console.error('Failed to remove saved story:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabs = [
    { id: 'reading' as TabId, label: 'Continue Reading', icon: Play, count: readingProgress.length },
    { id: 'saved' as TabId, label: 'Saved', icon: Bookmark, count: savedStories.length },
    { id: 'my-stories' as TabId, label: 'My Stories', icon: PenTool, count: myStories.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Your Library</h1>
          <p className="text-muted-foreground">
            Track your reading progress and manage your stories
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b pb-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-primary-foreground/20' : 'bg-muted'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Continue Reading Tab */}
            {activeTab === 'reading' && (
              <div className="space-y-4">
                {readingProgress.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-2">No stories in progress</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Start reading a story and your progress will be saved here
                    </p>
                    <Button asChild>
                      <Link href="/stories">Browse Stories</Link>
                    </Button>
                  </div>
                ) : (
                  readingProgress.map((progress) => (
                    <div
                      key={progress.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-16 h-20 rounded overflow-hidden bg-muted flex-shrink-0">
                        {progress.storyCoverUrl ? (
                          <img
                            src={progress.storyCoverUrl}
                            alt={progress.storyTitle}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/story/${progress.storySlug}/read`}
                          className="font-semibold hover:text-primary transition-colors line-clamp-1"
                        >
                          {progress.storyTitle}
                        </Link>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{progress.visitedCount} segments visited</span>
                          {progress.isCompleted && (
                            <span className="text-green-600">Completed</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Last read {new Date(progress.lastReadAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/story/${progress.storySlug}/read`}>
                            {progress.isCompleted ? 'Replay' : 'Continue'}
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeProgress(progress.id)}
                          aria-label="Remove from reading list"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Saved Stories Tab */}
            {activeTab === 'saved' && (
              <div className="space-y-4">
                {savedStories.length === 0 ? (
                  <div className="text-center py-12">
                    <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-2">No saved stories</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Save stories you want to read later
                    </p>
                    <Button asChild>
                      <Link href="/stories">Browse Stories</Link>
                    </Button>
                  </div>
                ) : (
                  savedStories.map((saved) => (
                    <div
                      key={saved.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-16 h-20 rounded overflow-hidden bg-muted flex-shrink-0">
                        {saved.coverImageUrl ? (
                          <img
                            src={saved.coverImageUrl}
                            alt={saved.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/story/${saved.slug}`}
                          className="font-semibold hover:text-primary transition-colors line-clamp-1"
                        >
                          {saved.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          by {saved.authorName}
                        </p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Bookmark className="h-3 w-3" />
                          Saved {new Date(saved.savedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button asChild size="sm">
                          <Link href={`/story/${saved.slug}/read`}>Read</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSavedStory(saved.storyId)}
                          aria-label="Remove from saved"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* My Stories Tab */}
            {activeTab === 'my-stories' && (
              <div className="space-y-4">
                <div className="flex justify-end mb-4">
                  <Button asChild>
                    <Link href="/create">
                      <PenTool className="h-4 w-4 mr-2" />
                      Create New Story
                    </Link>
                  </Button>
                </div>

                {myStories.length === 0 ? (
                  <div className="text-center py-12">
                    <PenTool className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-2">No stories yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create your first interactive story
                    </p>
                    <Button asChild>
                      <Link href="/create">Start Writing</Link>
                    </Button>
                  </div>
                ) : (
                  myStories.map((story) => (
                    <div
                      key={story.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-16 h-20 rounded overflow-hidden bg-muted flex-shrink-0">
                        {story.coverImageUrl ? (
                          <img
                            src={story.coverImageUrl}
                            alt={story.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/story/${story.slug}/edit`}
                          className="font-semibold hover:text-primary transition-colors line-clamp-1"
                        >
                          {story.title}
                        </Link>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            story.status === 'published'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : story.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {story.status.charAt(0).toUpperCase() + story.status.slice(1)}
                          </span>
                          {story.status === 'published' && (
                            <>
                              <span className="text-xs text-muted-foreground">
                                {story.viewCount.toLocaleString()} views
                              </span>
                              {story.averageRating > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                  {story.averageRating.toFixed(1)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Updated {new Date(story.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/story/${story.slug}/edit`}>Edit</Link>
                        </Button>
                        {story.status === 'published' && (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/story/${story.slug}`}>View</Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
