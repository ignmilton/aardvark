'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';

interface ReaderContentProps {
  title?: string | null;
  content: string;
  isEnding?: boolean;
  endingType?: 'good' | 'bad' | 'neutral' | 'secret' | null;
}

export function ReaderContent({
  title,
  content,
  isEnding,
  endingType,
}: ReaderContentProps) {
  const endingStyles = {
    good: 'border-l-green-500 bg-green-50 dark:bg-green-950/30',
    bad: 'border-l-red-500 bg-red-50 dark:bg-red-950/30',
    neutral: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30',
    secret: 'border-l-purple-500 bg-purple-50 dark:bg-purple-950/30',
  };

  // Sanitize HTML content to prevent XSS attacks
  const sanitizedContent = useMemo(() => sanitizeHtml(content), [content]);

  return (
    <article
      className={cn(
        'prose prose-lg dark:prose-invert max-w-none',
        'font-reading leading-relaxed',
        isEnding && endingType && 'border-l-4 pl-6 py-4 rounded-r-lg',
        isEnding && endingType && endingStyles[endingType]
      )}
    >
      {title && (
        <h2 className="text-2xl font-bold mb-6 text-foreground">{title}</h2>
      )}

      {isEnding && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {endingType === 'good' && '🌟 Good Ending'}
            {endingType === 'bad' && '💀 Bad Ending'}
            {endingType === 'neutral' && '🔵 Neutral Ending'}
            {endingType === 'secret' && '🔮 Secret Ending'}
          </span>
        </div>
      )}

      <div
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        className="story-content"
      />

      {isEnding && (
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-center text-muted-foreground italic">
            You have reached the end of this path.
          </p>
        </div>
      )}
    </article>
  );
}
