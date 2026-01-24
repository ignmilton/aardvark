'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ReaderHeader, ReaderContent, ChoiceList, ProgressSidebar } from '@/components/reader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { storiesApi, segmentsApi, choicesApi, progressApi } from '@/lib/api';

// Types
interface Story {
  id: string;
  title: string;
  slug: string;
  rootSegmentId: string;
}

interface Segment {
  id: string;
  title: string | null;
  content: string;
  isEnding: boolean;
  endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;
  stateEffects: any[];
  choices: Choice[];
}

interface Choice {
  id: string;
  choiceText: string;
  nextSegmentId: string;
  order: number;
  isHidden: boolean;
}

interface Progress {
  id: string;
  currentSegmentId: string;
  visitedSegmentIds: string[];
  choiceHistory: { segmentId: string; choiceId: string; timestamp: Date }[];
  stateVariables: Record<string, any>;
  bookmarks: { segmentId: string; note: string; createdAt: Date }[];
  isCompleted: boolean;
}

function getToken(): string | undefined {
  return typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined;
}

async function loadSegmentWithChoices(segmentId: string): Promise<Segment> {
  const segmentData = await segmentsApi.getById(segmentId);
  let segChoices: Choice[] = [];
  try {
    segChoices = await choicesApi.getBySegment(segmentId);
  } catch {
    // Segment may have no choices
  }
  return {
    ...segmentData,
    choices: (segChoices || []).sort((a: Choice, b: Choice) => a.order - b.order),
  };
}

async function loadProgress(storyId: string, rootSegmentId: string): Promise<Progress> {
  const token = getToken();
  if (token) {
    try {
      const serverProgress = await progressApi.get(storyId, token);
      if (serverProgress) {
        return {
          id: serverProgress.id,
          currentSegmentId: serverProgress.currentSegmentId,
          visitedSegmentIds: serverProgress.visitedSegmentIds || [rootSegmentId],
          choiceHistory: serverProgress.choiceHistory || [],
          stateVariables: serverProgress.stateVariables || {},
          bookmarks: serverProgress.bookmarks || [],
          isCompleted: serverProgress.isCompleted || false,
        };
      }
    } catch {
      // No progress yet, will create below
    }
    // Start new progress on server
    try {
      const newProgress = await progressApi.start(storyId, token);
      return {
        id: newProgress.id,
        currentSegmentId: rootSegmentId,
        visitedSegmentIds: [rootSegmentId],
        choiceHistory: [],
        stateVariables: {},
        bookmarks: [],
        isCompleted: false,
      };
    } catch {
      // Fall through to local
    }
  }

  // Fallback: localStorage for unauthenticated users
  const saved = localStorage.getItem(`progress-${storyId}`);
  if (saved) return JSON.parse(saved);
  return {
    id: `local-${storyId}`,
    currentSegmentId: rootSegmentId,
    visitedSegmentIds: [rootSegmentId],
    choiceHistory: [],
    stateVariables: {},
    bookmarks: [],
    isCompleted: false,
  };
}

function saveLocalProgress(storyId: string, progress: Progress): void {
  localStorage.setItem(`progress-${storyId}`, JSON.stringify(progress));
}

export default function StoryReaderPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [story, setStory] = useState<Story | null>(null);
  const [segment, setSegment] = useState<Segment | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Load story and progress
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const storyData = await storiesApi.getBySlug(slug);
        setStory(storyData);

        // Load or create progress
        const progressData = await loadProgress(storyData.id, storyData.rootSegmentId);
        setProgress(progressData);

        // Load current segment with choices
        const segmentData = await loadSegmentWithChoices(progressData.currentSegmentId);
        setSegment(segmentData);
        setStartTime(Date.now());
      } catch (err) {
        setError('Failed to load story');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [slug]);

  // Handle choice selection
  const handleChoice = useCallback(
    async (choiceId: string) => {
      if (!story || !segment || !progress || isTransitioning) return;

      setIsTransitioning(true);

      try {
        const choice = segment.choices.find((c) => c.id === choiceId);
        if (!choice) return;

        const timeSpent = Math.floor((Date.now() - startTime) / 1000);

        // Update progress locally
        const updatedProgress: Progress = {
          ...progress,
          currentSegmentId: choice.nextSegmentId,
          visitedSegmentIds: progress.visitedSegmentIds.includes(choice.nextSegmentId)
            ? progress.visitedSegmentIds
            : [...progress.visitedSegmentIds, choice.nextSegmentId],
          choiceHistory: [
            ...progress.choiceHistory,
            { segmentId: segment.id, choiceId, timestamp: new Date() },
          ],
        };

        // Load next segment with choices
        const nextSegment = await loadSegmentWithChoices(choice.nextSegmentId);

        // Apply state effects
        if (nextSegment.stateEffects) {
          for (const effect of nextSegment.stateEffects) {
            updatedProgress.stateVariables[effect.variableName] = effect.value;
          }
        }

        // Check if ending
        if (nextSegment.isEnding) {
          updatedProgress.isCompleted = true;
        }

        // Persist progress
        const token = getToken();
        if (token) {
          try {
            await progressApi.makeChoice(story.id, choiceId, timeSpent, token);
          } catch {
            // Fallback to local
          }
        }
        saveLocalProgress(story.id, updatedProgress);

        // Record choice analytics (fire-and-forget)
        choicesApi.recordChoice(choiceId).catch(() => {});

        // Update state
        setProgress(updatedProgress);
        setSegment(nextSegment);
        setStartTime(Date.now());

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error('Failed to process choice:', err);
      } finally {
        setIsTransitioning(false);
      }
    },
    [story, segment, progress, isTransitioning, startTime]
  );

  // Handle navigation to previous segment
  const handleNavigate = useCallback(
    async (segmentId: string) => {
      if (!story || !progress) return;

      setIsTransitioning(true);

      try {
        const segmentData = await loadSegmentWithChoices(segmentId);

        const updatedProgress: Progress = {
          ...progress,
          currentSegmentId: segmentId,
          isCompleted: false,
        };

        // Persist
        const token = getToken();
        if (token) {
          try {
            await progressApi.navigate(story.id, segmentId, token);
          } catch {
            // Fallback to local
          }
        }
        saveLocalProgress(story.id, updatedProgress);

        setProgress(updatedProgress);
        setSegment(segmentData);
        setStartTime(Date.now());
        setShowSidebar(false);

        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error('Failed to navigate:', err);
      } finally {
        setIsTransitioning(false);
      }
    },
    [story, progress]
  );

  // Handle bookmark toggle
  const handleBookmark = useCallback(async () => {
    if (!story || !segment || !progress) return;

    const isBookmarked = progress.bookmarks.some(
      (b) => b.segmentId === segment.id
    );

    let updatedBookmarks: Progress['bookmarks'];
    const token = getToken();

    if (isBookmarked) {
      updatedBookmarks = progress.bookmarks.filter(
        (b) => b.segmentId !== segment.id
      );
      if (token) {
        try {
          await progressApi.removeBookmark(story.id, segment.id, token);
        } catch { /* fallback to local */ }
      }
    } else {
      const note = segment.title || '';
      updatedBookmarks = [
        ...progress.bookmarks,
        { segmentId: segment.id, note, createdAt: new Date() },
      ];
      if (token) {
        try {
          await progressApi.addBookmark(story.id, segment.id, note, token);
        } catch { /* fallback to local */ }
      }
    }

    const updatedProgress = { ...progress, bookmarks: updatedBookmarks };
    saveLocalProgress(story.id, updatedProgress);
    setProgress(updatedProgress);
  }, [story, segment, progress]);

  // Handle reset
  const handleReset = useCallback(async () => {
    if (!story) return;

    const confirmed = window.confirm(
      'Are you sure you want to start over? Your progress will be reset.'
    );
    if (!confirmed) return;

    const newProgress: Progress = {
      id: progress?.id || `local-${story.id}`,
      currentSegmentId: story.rootSegmentId,
      visitedSegmentIds: [story.rootSegmentId],
      choiceHistory: [],
      stateVariables: {},
      bookmarks: [],
      isCompleted: false,
    };

    // Reset on server
    const token = getToken();
    if (token) {
      try {
        await progressApi.reset(story.id, token);
      } catch { /* fallback to local */ }
    }
    saveLocalProgress(story.id, newProgress);
    setProgress(newProgress);

    const segmentData = await loadSegmentWithChoices(story.rootSegmentId);
    setSegment(segmentData);
    setStartTime(Date.now());

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [story, progress]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="sticky top-0 z-40 bg-background border-b h-14" />
        <div className="container max-w-3xl py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-8" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !story || !segment || !progress) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Unable to load story</h1>
          <p className="text-muted-foreground mb-6">{error || 'Story not found'}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const isBookmarked = progress.bookmarks.some((b) => b.segmentId === segment.id);
  const segmentNumber = progress.visitedSegmentIds.indexOf(segment.id) + 1;

  return (
    <div className="min-h-screen bg-background">
      <ReaderHeader
        storyTitle={story.title}
        storySlug={story.slug}
        segmentTitle={segment.title}
        segmentNumber={segmentNumber}
        totalVisited={progress.visitedSegmentIds.length}
        isBookmarked={isBookmarked}
        onBookmark={handleBookmark}
        onReset={handleReset}
      />

      <div className="lg:flex">
        {/* Main content */}
        <div className="flex-1 container max-w-3xl py-8 lg:pr-80">
          <ReaderContent
            title={segment.title}
            content={segment.content}
            isEnding={segment.isEnding}
            endingType={segment.endingType}
          />

          <ChoiceList
            choices={segment.choices}
            onSelect={handleChoice}
            isLoading={isTransitioning}
            disabled={isTransitioning || segment.isEnding}
          />

          {/* Ending actions */}
          {segment.isEnding && (
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={handleReset} variant="outline" size="lg">
                Start Over
              </Button>
              <Button onClick={() => router.push(`/story/${story.slug}`)} size="lg">
                View Story Details
              </Button>
            </div>
          )}

          {/* Toggle sidebar button (mobile) */}
          <button
            onClick={() => setShowSidebar(true)}
            className="fixed bottom-20 right-4 lg:hidden z-30 p-3 bg-primary text-primary-foreground rounded-full shadow-lg"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </button>
        </div>

        {/* Sidebar */}
        <ProgressSidebar
          visitedSegmentIds={progress.visitedSegmentIds}
          currentSegmentId={segment.id}
          bookmarks={progress.bookmarks}
          stateVariables={progress.stateVariables}
          onNavigate={handleNavigate}
          isOpen={showSidebar}
          onClose={() => setShowSidebar(false)}
        />
      </div>
    </div>
  );
}
