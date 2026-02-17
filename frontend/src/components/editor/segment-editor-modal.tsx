'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAutosave } from './use-autosave';

const RichTextEditor = dynamic(
  () => import('./rich-text-editor').then((mod) => mod.RichTextEditor),
  {
    ssr: false,
    loading: () => <div className="h-[180px] rounded-md border bg-muted animate-pulse" />,
  },
);

// Note: StateEffect interface removed per design simplification

interface SegmentData {
  id?: string;
  title: string;
  content: string;
  contentMarkdown: string;
  isEnding: boolean;
  endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;
  // Note: stateEffects removed per design simplification
}

interface SegmentEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SegmentData) => void;
  initialData?: Partial<SegmentData>;
  // Note: stateVariables removed per design simplification
  storyId?: string;
}

export function SegmentEditorModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  storyId = 'unknown',
}: SegmentEditorModalProps) {
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentText, setContentText] = useState('');
  const [isEnding, setIsEnding] = useState(false);
  const [endingType, setEndingType] = useState<'good' | 'bad' | 'neutral' | 'secret' | null>(null);
  // Note: stateEffects state removed per design simplification
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);

  const { saveDraft, loadDraft, clearDraft, hasDraft } = useAutosave(
    storyId,
    initialData?.id,
    isOpen,
  );

  /* eslint-disable react-hooks/set-state-in-effect -- resetting form state when modal opens/closes based on props */
  useEffect(() => {
    if (!isOpen) {
      setShowDraftRecovery(false);
      return;
    }

    if (initialData) {
      setTitle(initialData.title || '');
      setContentHtml(initialData.content || '');
      setContentText(initialData.contentMarkdown || '');
      setIsEnding(initialData.isEnding || false);
      setEndingType(initialData.endingType || null);
    } else {
      setTitle('');
      setContentHtml('');
      setContentText('');
      setIsEnding(false);
      setEndingType(null);
    }

    // Check for a saved draft
    if (hasDraft()) {
      setShowDraftRecovery(true);
    }
  }, [initialData, isOpen, hasDraft]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const restoreDraft = useCallback(() => {
    const draft = loadDraft();
    if (draft) {
      setTitle(draft.title);
      setContentHtml(draft.contentHtml);
      setContentText(draft.contentText);
      setIsEnding(draft.isEnding);
      setEndingType(draft.endingType);
    }
    setShowDraftRecovery(false);
  }, [loadDraft]);

  const dismissDraft = useCallback(() => {
    clearDraft();
    setShowDraftRecovery(false);
  }, [clearDraft]);

  // Autosave on content changes
  useEffect(() => {
    if (!isOpen) return;
    if (!contentText.trim() && !title.trim()) return;
    saveDraft({ title, contentHtml, contentText, isEnding, endingType });
  }, [title, contentHtml, contentText, isEnding, endingType, isOpen, saveDraft]);

  const handleSave = () => {
    clearDraft();
    onSave({
      id: initialData?.id,
      title,
      content: contentHtml,
      contentMarkdown: contentText,
      isEnding,
      endingType: isEnding ? endingType : null,
      // Note: stateEffects removed per design simplification
    });
    onClose();
  };

  // Note: addStateEffect, removeStateEffect, updateStateEffect functions removed per design simplification

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-background rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initialData?.id ? 'Edit Segment' : 'Create Segment'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-md" aria-label="Close modal">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
          {/* Draft recovery banner */}
          {showDraftRecovery && (
            <div className="flex items-center justify-between p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                An unsaved draft was found. Restore it?
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={dismissDraft}>
                  Discard
                </Button>
                <Button size="sm" onClick={restoreDraft}>
                  Restore
                </Button>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="segment-title" className="block text-sm font-medium mb-2">Title (optional)</label>
            <Input
              id="segment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chapter title..."
            />
          </div>

          {/* Content */}
          <div>
            <label id="segment-content-label" className="block text-sm font-medium mb-2">Content</label>
            <RichTextEditor
              content={contentHtml}
              onChange={(html, text) => {
                setContentHtml(html);
                setContentText(text);
              }}
              aria-labelledby="segment-content-label"
            />
          </div>

          {/* Ending options */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="segment-is-ending"
                type="checkbox"
                checked={isEnding}
                onChange={(e) => setIsEnding(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium">This is an ending segment</span>
            </label>

            {isEnding && (
              <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Ending type">
                {(['good', 'bad', 'neutral', 'secret'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setEndingType(type)}
                    role="radio"
                    aria-checked={endingType === type}
                    aria-label={`${type} ending`}
                    className={cn(
                      'px-3 py-2 rounded-md border text-sm capitalize',
                      endingType === type
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    )}
                  >
                    {type === 'good' && '🌟 '}
                    {type === 'bad' && '💀 '}
                    {type === 'neutral' && '🔵 '}
                    {type === 'secret' && '🔮 '}
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Note: State effects UI removed per design simplification */}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!contentText.trim()}>
            {initialData?.id ? 'Save Changes' : 'Create Segment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
