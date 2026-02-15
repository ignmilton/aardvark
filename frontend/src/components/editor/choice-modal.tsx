'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (choiceText: string) => void;
  sourceTitle?: string | null;
  targetTitle?: string | null;
}

/**
 * Modal for creating/editing choices between story segments.
 * Replaces the browser prompt() for a better UX.
 */
export function ChoiceModal({
  isOpen,
  onClose,
  onConfirm,
  sourceTitle,
  targetTitle,
}: ChoiceModalProps) {
  const [choiceText, setChoiceText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setChoiceText(''); // eslint-disable-line react-hooks/set-state-in-effect -- resetting form state when modal opens
      // Focus input after modal renders
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (choiceText.trim()) {
      onConfirm(choiceText.trim());
      setChoiceText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-background rounded-lg shadow-xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Create Choice</h2>
            {sourceTitle && targetTitle && (
              <p className="text-sm text-muted-foreground mt-1">
                From &ldquo;{sourceTitle}&rdquo; to &ldquo;{targetTitle}&rdquo;
              </p>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="choice-text" className="block text-sm font-medium mb-2">
                Choice text
              </label>
              <Input
                id="choice-text"
                ref={inputRef}
                value={choiceText}
                onChange={(e) => setChoiceText(e.target.value)}
                placeholder="e.g., Open the mysterious door..."
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The text readers will see as a clickable option ({choiceText.length}/200)
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!choiceText.trim()}>
              Create Choice
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
