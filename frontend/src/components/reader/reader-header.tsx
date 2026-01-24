'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ReaderHeaderProps {
  storyTitle: string;
  storySlug: string;
  segmentTitle?: string | null;
  segmentNumber: number;
  totalVisited: number;
  isBookmarked?: boolean;
  onBookmark?: () => void;
  onReset?: () => void;
}

export function ReaderHeader({
  storyTitle,
  storySlug,
  segmentTitle,
  segmentNumber,
  totalVisited,
  isBookmarked,
  onBookmark,
  onReset,
}: ReaderHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container flex h-14 items-center justify-between gap-4">
        {/* Back to story */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/story/${storySlug}`}
            className="flex-shrink-0 p-2 -ml-2 rounded-md hover:bg-muted transition-colors"
            title="Back to story page"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>

          <div className="min-w-0">
            <h1 className="text-sm font-medium truncate">{storyTitle}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {segmentTitle || `Segment ${segmentNumber}`} · {totalVisited} visited
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Bookmark button */}
          {onBookmark && (
            <button
              onClick={onBookmark}
              className={cn(
                'p-2 rounded-md transition-colors',
                isBookmarked
                  ? 'text-primary bg-primary/10'
                  : 'hover:bg-muted text-muted-foreground'
              )}
              title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            >
              <svg
                className="w-5 h-5"
                fill={isBookmarked ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
            </button>
          )}

          {/* Menu button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-md hover:bg-muted transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-popover border rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    {onReset && (
                      <button
                        onClick={() => {
                          onReset();
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Start Over
                      </button>
                    )}
                    <Link
                      href={`/story/${storySlug}`}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      onClick={() => setShowMenu(false)}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Story Info
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
