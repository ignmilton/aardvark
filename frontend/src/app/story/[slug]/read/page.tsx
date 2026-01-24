'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ReaderHeader, ReaderContent, ChoiceList, ProgressSidebar } from '@/components/reader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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

// Mock API functions (replace with actual API calls)
const api = {
  getStory: async (slug: string): Promise<Story> => {
    // Mock data - replace with actual API call
    return {
      id: '1',
      title: 'The Dragon\'s Choice',
      slug: slug,
      rootSegmentId: 'seg-1',
    };
  },

  getSegment: async (segmentId: string): Promise<Segment> => {
    // Mock data - replace with actual API call
    const segments: Record<string, Segment> = {
      'seg-1': {
        id: 'seg-1',
        title: 'The Beginning',
        content: `
          <p>You stand at the entrance of a dark cave. The wind howls behind you, pushing you forward into the unknown darkness. Your torch flickers, casting dancing shadows on the ancient stone walls.</p>
          <p>Legend speaks of a dragon who guards an immense treasure deep within these mountains. Many have entered seeking fortune; few have returned.</p>
          <p>As you take your first steps into the cave, you hear a sound ahead. It could be the wind echoing through the tunnels, or perhaps something else entirely...</p>
        `,
        isEnding: false,
        endingType: null,
        stateEffects: [],
        choices: [
          { id: 'c1', choiceText: 'Proceed cautiously with your torch held high', nextSegmentId: 'seg-2', order: 1, isHidden: false },
          { id: 'c2', choiceText: 'Call out to see if anyone responds', nextSegmentId: 'seg-3', order: 2, isHidden: false },
          { id: 'c3', choiceText: 'Extinguish your torch and move silently in the dark', nextSegmentId: 'seg-4', order: 3, isHidden: false },
        ],
      },
      'seg-2': {
        id: 'seg-2',
        title: 'The Careful Path',
        content: `
          <p>You raise your torch higher, letting its warm glow push back the shadows. The cave walls glitter with mineral deposits - crystals that catch the firelight and scatter it like stars.</p>
          <p>Ahead, the tunnel splits into two passages. The left path slopes downward, and you can hear the distant sound of running water. The right path continues level, but there are strange markings etched into the stone.</p>
        `,
        isEnding: false,
        endingType: null,
        stateEffects: [{ variableName: 'careful', operation: 'set', value: true }],
        choices: [
          { id: 'c4', choiceText: 'Take the left path toward the water', nextSegmentId: 'seg-5', order: 1, isHidden: false },
          { id: 'c5', choiceText: 'Examine the markings on the right path', nextSegmentId: 'seg-6', order: 2, isHidden: false },
        ],
      },
      'seg-3': {
        id: 'seg-3',
        title: 'A Voice in the Dark',
        content: `
          <p>"Hello?" Your voice echoes through the cavern, bouncing off walls you cannot see. For a long moment, there is only silence.</p>
          <p>Then, a deep, rumbling voice responds from somewhere far below: "Who dares enter my domain?"</p>
          <p>The dragon knows you're here now. There's no turning back.</p>
        `,
        isEnding: false,
        endingType: null,
        stateEffects: [{ variableName: 'dragon_aware', operation: 'set', value: true }],
        choices: [
          { id: 'c6', choiceText: '"I come seeking wisdom, great one!"', nextSegmentId: 'seg-7', order: 1, isHidden: false },
          { id: 'c7', choiceText: 'Run back toward the entrance', nextSegmentId: 'seg-8', order: 2, isHidden: false },
        ],
      },
      'seg-4': {
        id: 'seg-4',
        title: 'Darkness Embraces You',
        content: `
          <p>You extinguish your torch with a quick motion. Darkness swallows you whole, but your other senses sharpen. You can smell the musty age of the cave, feel the slight movement of air indicating passages ahead.</p>
          <p>Moving by touch alone, you navigate deeper. Your hand brushes against something unexpected - scales, warm and smooth.</p>
          <p>Before you can react, a massive eye opens right in front of you, glowing with an inner fire that illuminates your terrified face.</p>
          <p>"Brave, or foolish?" the dragon muses. "Perhaps both."</p>
        `,
        isEnding: true,
        endingType: 'neutral',
        stateEffects: [],
        choices: [],
      },
    };

    return segments[segmentId] || segments['seg-1'];
  },

  getProgress: async (storyId: string): Promise<Progress | null> => {
    // Check localStorage for saved progress
    const saved = localStorage.getItem(`progress-${storyId}`);
    return saved ? JSON.parse(saved) : null;
  },

  saveProgress: async (storyId: string, progress: Progress): Promise<void> => {
    localStorage.setItem(`progress-${storyId}`, JSON.stringify(progress));
  },
};

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
    async function loadStory() {
      try {
        setIsLoading(true);
        const storyData = await api.getStory(slug);
        setStory(storyData);

        // Load or create progress
        let progressData = await api.getProgress(storyData.id);
        if (!progressData) {
          progressData = {
            id: `progress-${storyData.id}`,
            currentSegmentId: storyData.rootSegmentId,
            visitedSegmentIds: [storyData.rootSegmentId],
            choiceHistory: [],
            stateVariables: {},
            bookmarks: [],
            isCompleted: false,
          };
        }
        setProgress(progressData);

        // Load current segment
        const segmentData = await api.getSegment(progressData.currentSegmentId);
        setSegment(segmentData);
        setStartTime(Date.now());
      } catch (err) {
        setError('Failed to load story');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStory();
  }, [slug]);

  // Handle choice selection
  const handleChoice = useCallback(
    async (choiceId: string) => {
      if (!story || !segment || !progress || isTransitioning) return;

      setIsTransitioning(true);

      try {
        const choice = segment.choices.find((c) => c.id === choiceId);
        if (!choice) return;

        // Update progress
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

        // Load next segment
        const nextSegment = await api.getSegment(choice.nextSegmentId);

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

        // Save progress
        await api.saveProgress(story.id, updatedProgress);

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
        const segmentData = await api.getSegment(segmentId);

        const updatedProgress: Progress = {
          ...progress,
          currentSegmentId: segmentId,
          isCompleted: false,
        };

        await api.saveProgress(story.id, updatedProgress);

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
    if (isBookmarked) {
      updatedBookmarks = progress.bookmarks.filter(
        (b) => b.segmentId !== segment.id
      );
    } else {
      updatedBookmarks = [
        ...progress.bookmarks,
        { segmentId: segment.id, note: segment.title || '', createdAt: new Date() },
      ];
    }

    const updatedProgress = { ...progress, bookmarks: updatedBookmarks };
    await api.saveProgress(story.id, updatedProgress);
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
      id: `progress-${story.id}`,
      currentSegmentId: story.rootSegmentId,
      visitedSegmentIds: [story.rootSegmentId],
      choiceHistory: [],
      stateVariables: {},
      bookmarks: [],
      isCompleted: false,
    };

    await api.saveProgress(story.id, newProgress);
    setProgress(newProgress);

    const segmentData = await api.getSegment(story.rootSegmentId);
    setSegment(segmentData);
    setStartTime(Date.now());

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [story]);

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
