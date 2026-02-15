'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewDashboard } from '@/components/submissions';
import {
  storiesApi,
  segmentsApi,
  choicesApi,
  branchSubmissionsApi,
} from '@/lib/api';

// Dynamically import the visual editor to avoid SSR issues with React Flow
const VisualEditorWithProvider = dynamic(
  () => import('@/components/editor').then((mod) => mod.VisualEditorWithProvider),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

function EditorSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-muted/30">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading editor...</p>
      </div>
    </div>
  );
}

// Types - Extended from shared Story type
interface Story {
  id: string;
  title: string;
  slug?: string;
  description: string;
  status: string;
  collaborationMode: string;
  rootSegmentId: string | null;
}

interface Segment {
  id: string;
  title: string | null;
  content: string;
  contentMarkdown: string | null;
  position: { x: number; y: number };
  isRootSegment: boolean;
  isEnding: boolean;
  endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;
  wordCount: number;
  // Note: stateEffects removed per design simplification
}

interface Choice {
  id: string;
  segmentId: string;
  nextSegmentId: string;
  choiceText: string;
  order: number;
  // Note: conditions removed per design simplification
}

// StateVariable interface removed - feature simplified out of design

interface BranchSubmission {
  id: string;
  segmentData: {
    title: string | null;
    content: string;
    isEnding: boolean;
    endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;
  };
  choicesData: {
    choiceText: string;
    order: number;
  }[];
  submissionNote: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  submittedBy: {
    id: string;
    username: string;
    displayName: string;
  };
  parentSegment: {
    id: string;
    title: string | null;
  };
  reviewNote: string | null;
  createdAt: string;
}

function getToken(): string | undefined {
  return typeof window !== 'undefined' ? localStorage.getItem('token') || undefined : undefined;
}

export default function StoryEditorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [story, setStory] = useState<Story | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  // Note: stateVariables feature removed per design simplification
  const [submissions, setSubmissions] = useState<BranchSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'visual' | 'settings' | 'submissions'>('visual');

  // Settings form state
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsCollabMode, setSettingsCollabMode] = useState('private');
  // Note: Variable form state removed per design simplification

  // Load story data from API
  useEffect(() => {
    async function loadStory() {
      const token = getToken();
      try {
        // Fetch the story by slug
        const storyData = await storiesApi.getBySlug(slug);
        setStory(storyData);
        setSettingsTitle(storyData.title);
        setSettingsDescription(storyData.description || '');
        setSettingsCollabMode(storyData.collaborationMode || 'private');

        // Fetch segments for this story
        const segmentsData = await segmentsApi.getByStory(storyData.id);
        setSegments(segmentsData || []);

        // Fetch all choices for all segments
        const allChoices: Choice[] = [];
        for (const seg of segmentsData || []) {
          try {
            const segChoices = await choicesApi.getBySegment(seg.id);
            allChoices.push(...(segChoices || []));
          } catch {
            // Segment may have no choices
          }
        }
        setChoices(allChoices);

        // Note: State variables fetch removed per design simplification

        // Fetch branch submissions
        if (token && storyData.collaborationMode !== 'private') {
          try {
            const subsData = await branchSubmissionsApi.getByStory(storyData.id, token);
            setSubmissions((subsData as any) || []);
          } catch {
            // No submissions
          }
        }
      } catch (error) {
        console.error('Failed to load story:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadStory();
  }, [slug]);

  // Real API handlers
  const handleSegmentCreate = useCallback(async (segment: Partial<Segment>): Promise<Segment> => {
    const token = getToken();
    if (!token || !story) throw new Error('Not authenticated');

    const created = await segmentsApi.create({
      storyId: story.id,
      title: segment.title || undefined,
      content: segment.content || '',
      contentMarkdown: segment.contentMarkdown || undefined,
      position: segment.position || { x: 250, y: 250 },
      isEnding: segment.isEnding || false,
      endingType: segment.endingType || undefined,
      // Note: stateEffects removed per design simplification
    } as any, token);

    setSegments((prev) => [...prev, created]);
    return created;
  }, [story]);

  const handleSegmentUpdate = useCallback(async (id: string, data: Partial<Segment>): Promise<void> => {
    const token = getToken();
    if (!token) return;

    await segmentsApi.update(id, data as any, token);
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
  }, []);

  const handleSegmentDelete = useCallback(async (id: string): Promise<void> => {
    const token = getToken();
    if (!token) return;

    await segmentsApi.delete(id, token);
    setSegments((prev) => prev.filter((s) => s.id !== id));
    setChoices((prev) => prev.filter((c) => c.segmentId !== id && c.nextSegmentId !== id));
  }, []);

  const handleChoiceCreate = useCallback(async (choice: Partial<Choice>): Promise<Choice> => {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');

    const created = await choicesApi.create({
      segmentId: choice.segmentId!,
      nextSegmentId: choice.nextSegmentId!,
      choiceText: choice.choiceText || 'New choice',
      order: choices.filter((c) => c.segmentId === choice.segmentId).length + 1,
      // Note: conditions removed per design simplification
    } as any, token);

    setChoices((prev) => [...prev, created]);
    return created;
  }, [choices]);

  const handleChoiceDelete = useCallback(async (id: string): Promise<void> => {
    const token = getToken();
    if (!token) return;

    await choicesApi.delete(id, token);
    setChoices((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handlePositionsUpdate = useCallback(async (
    positions: { segmentId: string; x: number; y: number }[]
  ): Promise<void> => {
    const token = getToken();
    if (!token || !story) return;

    await segmentsApi.updatePositions(story.id, positions, token);
    setSegments((prev) =>
      prev.map((s) => {
        const pos = positions.find((p) => p.segmentId === s.id);
        return pos ? { ...s, position: { x: pos.x, y: pos.y } } : s;
      })
    );
  }, [story]);

  // Note: Variable management functions removed per design simplification

  // Settings save
  const handleSaveSettings = async () => {
    const token = getToken();
    if (!token || !story) return;

    await storiesApi.update(story.id, {
      title: settingsTitle,
      description: settingsDescription,
      collaborationMode: settingsCollabMode as any,
    }, token);

    setStory((prev) => prev ? {
      ...prev,
      title: settingsTitle,
      description: settingsDescription,
      collaborationMode: settingsCollabMode,
    } : null);
  };

  // Publish story
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    const token = getToken();
    if (!token || !story) return;

    // Validate story has content
    if (segments.length === 0) {
      toast.error('Add at least one segment before publishing');
      return;
    }

    // Check for root segment
    const rootSegment = segments.find(s => s.isRootSegment);
    if (!rootSegment) {
      toast.error('Your story needs a starting segment');
      return;
    }

    // Check for at least one ending
    const hasEnding = segments.some(s => s.isEnding);
    if (!hasEnding) {
      toast.error('Your story needs at least one ending');
      return;
    }

    setIsPublishing(true);
    try {
      await storiesApi.publish(story.id, token);
      setStory(prev => prev ? { ...prev, status: 'published' } : null);
      toast.success('Story published successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish story');
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="h-14 border-b px-4 flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex-1">
          <EditorSkeleton />
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Story not found</h1>
          <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b px-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-4">
          <Link
            href={`/story/${slug}`}
            className="p-2 -ml-2 hover:bg-muted rounded-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-semibold">{story.title}</h1>
            <p className="text-xs text-muted-foreground">
              {story.status === 'draft' ? 'Draft' : 'Published'} · {segments.length} segments
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('visual')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'visual'
                ? 'bg-background shadow-sm'
                : 'hover:bg-background/50'
            }`}
          >
            Visual Editor
          </button>
          {/* Note: Variables tab removed per design simplification */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'settings'
                ? 'bg-background shadow-sm'
                : 'hover:bg-background/50'
            }`}
          >
            Settings
          </button>
          {story.collaborationMode !== 'private' && (
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors relative ${
                activeTab === 'submissions'
                  ? 'bg-background shadow-sm'
                  : 'hover:bg-background/50'
              }`}
            >
              Submissions
              {submissions.filter((s) => s.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {submissions.filter((s) => s.status === 'pending').length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/story/${slug}/read`}>Preview</Link>
          </Button>
          {story.status === 'draft' ? (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? 'Publishing...' : 'Publish'}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled>
              Published
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'visual' && (
          <VisualEditorWithProvider
            storyId={story.id}
            segments={segments}
            choices={choices}
            onSegmentCreate={handleSegmentCreate}
            onSegmentUpdate={handleSegmentUpdate}
            onSegmentDelete={handleSegmentDelete}
            onChoiceCreate={handleChoiceCreate}
            onChoiceDelete={handleChoiceDelete}
            onPositionsUpdate={handlePositionsUpdate}
          />
        )}

        {/* Note: Variables tab content removed per design simplification */}

        {activeTab === 'settings' && (
          <div className="p-6 max-w-3xl mx-auto">
            <h2 className="text-xl font-semibold mb-6">Story Settings</h2>
            <div className="space-y-6">
              <div>
                <label htmlFor="story-title" className="block text-sm font-medium mb-2">Title</label>
                <input
                  id="story-title"
                  type="text"
                  value={settingsTitle}
                  onChange={(e) => setSettingsTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label htmlFor="story-description" className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  id="story-description"
                  value={settingsDescription}
                  onChange={(e) => setSettingsDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label htmlFor="collab-mode" className="block text-sm font-medium mb-2">Collaboration Mode</label>
                <select
                  id="collab-mode"
                  value={settingsCollabMode}
                  onChange={(e) => setSettingsCollabMode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="private">Private - Only you can edit</option>
                  <option value="moderated">Moderated - Others can submit branches for approval</option>
                  <option value="open">Open - Anyone can add branches</option>
                </select>
              </div>
              <Button onClick={handleSaveSettings}>Save Settings</Button>
            </div>
          </div>
        )}

        {activeTab === 'submissions' && (
          <ReviewDashboard
            submissions={submissions}
            onReview={async (submissionId, status, reviewNote) => {
              const token = getToken();
              if (!token) return;

              await branchSubmissionsApi.review(submissionId, { status, reviewNote } as any, token);
              setSubmissions((prev) =>
                prev.map((s) =>
                  s.id === submissionId
                    ? { ...s, status, reviewNote: reviewNote || null }
                    : s
                )
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
