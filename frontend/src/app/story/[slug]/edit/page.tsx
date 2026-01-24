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
  stateVariablesApi,
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

// Types
interface Story {
  id: string;
  title: string;
  slug: string;
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
  stateEffects: any[];
}

interface Choice {
  id: string;
  segmentId: string;
  nextSegmentId: string;
  choiceText: string;
  order: number;
  conditions: any[];
}

interface StateVariable {
  id: string;
  name: string;
  displayName: string;
  type: string;
}

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
  const slug = params.slug as string;

  const [story, setStory] = useState<Story | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [stateVariables, setStateVariables] = useState<StateVariable[]>([]);
  const [submissions, setSubmissions] = useState<BranchSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'visual' | 'settings' | 'variables' | 'submissions'>('visual');

  // Settings form state
  const [settingsTitle, setSettingsTitle] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsCollabMode, setSettingsCollabMode] = useState('private');
  const [newVarName, setNewVarName] = useState('');
  const [newVarDisplayName, setNewVarDisplayName] = useState('');
  const [newVarType, setNewVarType] = useState('boolean');
  const [showAddVariable, setShowAddVariable] = useState(false);

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

        // Fetch state variables
        if (token) {
          try {
            const vars = await stateVariablesApi.getByStory(storyData.id, token);
            setStateVariables(vars || []);
          } catch {
            // No variables yet
          }
        }

        // Fetch branch submissions
        if (token && storyData.collaborationMode !== 'private') {
          try {
            const subsData = await branchSubmissionsApi.getByStory(storyData.id, token);
            setSubmissions(subsData?.submissions || []);
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
      title: segment.title || null,
      content: segment.content || '',
      contentMarkdown: segment.contentMarkdown || null,
      position: segment.position || { x: 250, y: 250 },
      isRootSegment: segments.length === 0,
      isEnding: segment.isEnding || false,
      endingType: segment.endingType || null,
      stateEffects: segment.stateEffects || [],
    }, token);

    setSegments((prev) => [...prev, created]);
    return created;
  }, [story, segments.length]);

  const handleSegmentUpdate = useCallback(async (id: string, data: Partial<Segment>): Promise<void> => {
    const token = getToken();
    if (!token) return;

    await segmentsApi.update(id, data, token);
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
      segmentId: choice.segmentId,
      nextSegmentId: choice.nextSegmentId,
      choiceText: choice.choiceText || 'New choice',
      order: choices.filter((c) => c.segmentId === choice.segmentId).length + 1,
      conditions: [],
    }, token);

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

  // Variable management
  const handleAddVariable = async () => {
    const token = getToken();
    if (!token || !story || !newVarName.trim()) return;

    try {
      const created = await stateVariablesApi.create({
        storyId: story.id,
        name: newVarName.trim(),
        displayName: newVarDisplayName.trim() || newVarName.trim(),
        type: newVarType as 'boolean' | 'number' | 'string' | 'array',
        defaultValue: newVarType === 'boolean' ? false : newVarType === 'number' ? 0 : '',
      }, token);

      setStateVariables((prev) => [...prev, created]);
      setNewVarName('');
      setNewVarDisplayName('');
      setNewVarType('boolean');
      setShowAddVariable(false);
      toast.success('Variable created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create variable');
    }
  };

  const handleDeleteVariable = async (id: string) => {
    const token = getToken();
    if (!token) return;

    try {
      await stateVariablesApi.delete(id, token);
      setStateVariables((prev) => prev.filter((v) => v.id !== id));
      toast.success('Variable deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete variable');
    }
  };

  // Settings save
  const handleSaveSettings = async () => {
    const token = getToken();
    if (!token || !story) return;

    await storiesApi.update(story.id, {
      title: settingsTitle,
      description: settingsDescription,
      collaborationMode: settingsCollabMode,
    }, token);

    setStory((prev) => prev ? {
      ...prev,
      title: settingsTitle,
      description: settingsDescription,
      collaborationMode: settingsCollabMode,
    } : null);
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
          <button
            onClick={() => setActiveTab('variables')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'variables'
                ? 'bg-background shadow-sm'
                : 'hover:bg-background/50'
            }`}
          >
            Variables
          </button>
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
          <Button size="sm">Publish</Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'visual' && (
          <VisualEditorWithProvider
            storyId={story.id}
            segments={segments}
            choices={choices}
            stateVariables={stateVariables}
            onSegmentCreate={handleSegmentCreate}
            onSegmentUpdate={handleSegmentUpdate}
            onSegmentDelete={handleSegmentDelete}
            onChoiceCreate={handleChoiceCreate}
            onChoiceDelete={handleChoiceDelete}
            onPositionsUpdate={handlePositionsUpdate}
          />
        )}

        {activeTab === 'variables' && (
          <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">State Variables</h2>
                <p className="text-muted-foreground">
                  Define variables to track reader choices and unlock conditional content
                </p>
              </div>
              <Button onClick={() => setShowAddVariable(true)}>Add Variable</Button>
            </div>

            {showAddVariable && (
              <div className="mb-6 p-4 border rounded-lg space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name (code)</label>
                    <input
                      type="text"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      placeholder="e.g. has_key"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Display Name</label>
                    <input
                      type="text"
                      value={newVarDisplayName}
                      onChange={(e) => setNewVarDisplayName(e.target.value)}
                      placeholder="e.g. Has Key"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      value={newVarType}
                      onChange={(e) => setNewVarType(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="boolean">Boolean</option>
                      <option value="number">Number</option>
                      <option value="string">String</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowAddVariable(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddVariable} disabled={!newVarName.trim()}>
                    Create
                  </Button>
                </div>
              </div>
            )}

            {stateVariables.length === 0 && !showAddVariable ? (
              <div className="text-center py-12 bg-muted/30 rounded-lg">
                <p className="text-muted-foreground mb-4">No variables defined yet</p>
                <Button variant="outline" onClick={() => setShowAddVariable(true)}>
                  Create your first variable
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {stateVariables.map((variable) => (
                  <div
                    key={variable.id}
                    className="p-4 border rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{variable.displayName}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {variable.name} ({variable.type})
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteVariable(variable.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-6 max-w-3xl mx-auto">
            <h2 className="text-xl font-semibold mb-6">Story Settings</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={settingsTitle}
                  onChange={(e) => setSettingsTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={settingsDescription}
                  onChange={(e) => setSettingsDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Collaboration Mode</label>
                <select
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

              await branchSubmissionsApi.review(submissionId, { status, reviewNote }, token);
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
