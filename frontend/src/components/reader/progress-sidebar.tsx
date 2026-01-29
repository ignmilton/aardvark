'use client';

import { cn } from '@/lib/utils';

interface Bookmark {
  segmentId: string;
  note: string;
  createdAt: Date;
}

interface ProgressSidebarProps {
  visitedSegmentIds: string[];
  currentSegmentId: string;
  bookmarks: Bookmark[];
  // Note: stateVariables removed per design simplification
  onNavigate: (segmentId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ProgressSidebar({
  visitedSegmentIds,
  currentSegmentId,
  bookmarks,
  onNavigate,
  isOpen,
  onClose,
}: ProgressSidebarProps) {

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-14 right-0 bottom-0 w-80 bg-background border-l z-50',
          'transform transition-transform duration-300 ease-in-out',
          'lg:transform-none lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)]',
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="h-full overflow-y-auto p-4">
          {/* Close button (mobile) */}
          <button
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-2 hover:bg-muted rounded-md"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Progress stats */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Progress
            </h3>
            <p className="text-2xl font-bold">
              {visitedSegmentIds.length}{' '}
              <span className="text-sm font-normal text-muted-foreground">
                segments visited
              </span>
            </p>
          </div>

          {/* Bookmarks */}
          {bookmarks.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Bookmarks
              </h3>
              <div className="space-y-2">
                {bookmarks.map((bookmark, index) => (
                  <button
                    key={bookmark.segmentId}
                    onClick={() => onNavigate(bookmark.segmentId)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-colors',
                      bookmark.segmentId === currentSegmentId
                        ? 'border-primary bg-primary/10'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <svg
                        className="w-4 h-4 text-primary"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      <span className="truncate">
                        {bookmark.note || `Bookmark ${index + 1}`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note: State variables section removed per design simplification */}

          {/* Navigation history (collapsed by default) */}
          <details className="mt-6">
            <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground">
              Navigation History ({visitedSegmentIds.length})
            </summary>
            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
              {visitedSegmentIds.map((segmentId, index) => (
                <button
                  key={segmentId}
                  onClick={() => onNavigate(segmentId)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded text-sm transition-colors',
                    segmentId === currentSegmentId
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  Segment {index + 1}
                  {segmentId === currentSegmentId && ' (current)'}
                </button>
              ))}
            </div>
          </details>
        </div>
      </aside>
    </>
  );
}
