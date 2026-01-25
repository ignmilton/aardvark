'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface SegmentData {
  title: string;
  content: string;
  contentMarkdown: string;
  isEnding: boolean;
  endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;
}

interface ChoiceData {
  choiceText: string;
  order: number;
}

interface SubmissionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    segmentData: SegmentData;
    choicesData: ChoiceData[];
    submissionNote: string;
  }) => Promise<void>;
  storyTitle: string;
  parentSegmentTitle: string | null;
}

export function SubmissionForm({
  isOpen,
  onClose,
  onSubmit,
  storyTitle,
  parentSegmentTitle,
}: SubmissionFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isEnding, setIsEnding] = useState(false);
  const [endingType, setEndingType] = useState<'good' | 'bad' | 'neutral' | 'secret' | null>(null);
  const [choiceText, setChoiceText] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    // Validate
    if (!content.trim()) {
      setError('Content is required');
      return;
    }
    if (content.trim().length < 10) {
      setError('Content must be at least 10 characters');
      return;
    }
    if (!choiceText.trim()) {
      setError('Choice text is required');
      return;
    }
    if (!submissionNote.trim()) {
      setError('Please add a note explaining your submission');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        segmentData: {
          title: title.trim() || '',
          content: `<p>${content}</p>`,
          contentMarkdown: content,
          isEnding,
          endingType: isEnding ? endingType : null,
        },
        choicesData: [{
          choiceText: choiceText.trim(),
          order: 1,
        }],
        submissionNote: submissionNote.trim(),
      });

      // Reset form
      setTitle('');
      setContent('');
      setIsEnding(false);
      setEndingType(null);
      setChoiceText('');
      setSubmissionNote('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit branch');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a Branch</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Contributing to &quot;{storyTitle}&quot;
            {parentSegmentTitle && (
              <> from segment: <span className="font-medium">{parentSegmentTitle}</span></>
            )}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Choice Text - What connects to your branch */}
          <div>
            <label htmlFor="submission-choice-text" className="block text-sm font-medium mb-2">
              Choice Text <span className="text-destructive">*</span>
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              This is the choice readers will see that leads to your branch
            </p>
            <input
              id="submission-choice-text"
              type="text"
              value={choiceText}
              onChange={(e) => setChoiceText(e.target.value)}
              placeholder='e.g., "Explore the mysterious cave"'
              className="w-full px-3 py-2 border rounded-md"
              maxLength={300}
            />
          </div>

          {/* Segment Title */}
          <div>
            <label htmlFor="submission-segment-title" className="block text-sm font-medium mb-2">
              Segment Title (Optional)
            </label>
            <input
              id="submission-segment-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your segment a title..."
              className="w-full px-3 py-2 border rounded-md"
              maxLength={200}
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="submission-content" className="block text-sm font-medium mb-2">
              Content <span className="text-destructive">*</span>
            </label>
            <textarea
              id="submission-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your story content here..."
              rows={8}
              className="w-full px-3 py-2 border rounded-md resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {content.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>

          {/* Ending Options */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="submission-is-ending"
                type="checkbox"
                checked={isEnding}
                onChange={(e) => setIsEnding(e.target.checked)}
                className="w-4 h-4"
                aria-describedby="ending-type-section"
              />
              <span className="text-sm font-medium">This is an ending segment</span>
            </label>

            {isEnding && (
              <div className="mt-3 ml-6">
                <label className="block text-sm font-medium mb-2">Ending Type</label>
                <div className="flex flex-wrap gap-2">
                  {(['good', 'bad', 'neutral', 'secret'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEndingType(type)}
                      className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
                        endingType === type
                          ? type === 'good'
                            ? 'bg-green-500 text-white'
                            : type === 'bad'
                            ? 'bg-red-500 text-white'
                            : type === 'secret'
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-500 text-white'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submission Note */}
          <div>
            <label htmlFor="submission-note" className="block text-sm font-medium mb-2">
              Note to Author <span className="text-destructive">*</span>
            </label>
            <p id="submission-note-desc" className="text-xs text-muted-foreground mb-2">
              Explain why this branch fits the story and any notes for the author
            </p>
            <textarea
              id="submission-note"
              value={submissionNote}
              onChange={(e) => setSubmissionNote(e.target.value)}
              placeholder="I think this branch would be interesting because..."
              rows={3}
              className="w-full px-3 py-2 border rounded-md resize-none"
              maxLength={1000}
              aria-describedby="submission-note-desc"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
