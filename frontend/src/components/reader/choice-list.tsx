'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Choice {
  id: string;
  choiceText: string;
  order: number;
  isHidden?: boolean;
}

interface ChoiceListProps {
  choices: Choice[];
  onSelect: (choiceId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ChoiceList({
  choices,
  onSelect,
  isLoading,
  disabled,
}: ChoiceListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (choiceId: string) => {
    if (disabled || isLoading) return;
    setSelectedId(choiceId);
    onSelect(choiceId);
  };

  const visibleChoices = choices
    .filter((c) => !c.isHidden)
    .sort((a, b) => a.order - b.order);

  if (visibleChoices.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 pt-6 border-t border-border" role="region" aria-label="Story choices">
      <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
        What do you do?
      </h3>

      <div className="space-y-3" role="group" aria-label="Available choices">
        {visibleChoices.map((choice, index) => (
          <button
            key={choice.id}
            onClick={() => handleSelect(choice.id)}
            disabled={disabled || isLoading}
            aria-label={`Choice ${index + 1}: ${choice.choiceText}`}
            aria-pressed={selectedId === choice.id}
            className={cn(
              'w-full text-left p-4 rounded-lg border-2 transition-all duration-200',
              'hover:border-primary hover:bg-primary/5',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              selectedId === choice.id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card'
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                  selectedId === choice.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {index + 1}
              </span>
              <span className="text-base leading-relaxed pt-1">
                {choice.choiceText}
              </span>
            </div>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="mt-4 flex items-center justify-center gap-2 text-muted-foreground">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading next segment...</span>
        </div>
      )}
    </div>
  );
}
