'use client';

import { Button } from '@/components/ui/button';

interface EditorToolbarProps {
  onAddSegment: () => void;
  onSave: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onToggleMinimap: () => void;
  showMinimap: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}

export function EditorToolbar({
  onAddSegment,
  onSave,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleMinimap,
  showMinimap,
  isSaving,
  hasUnsavedChanges,
}: EditorToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex gap-2">
      {/* Add segment */}
      <Button onClick={onAddSegment} size="sm" className="gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Segment
      </Button>

      {/* Save */}
      <Button
        onClick={onSave}
        size="sm"
        variant={hasUnsavedChanges ? 'default' : 'outline'}
        disabled={isSaving || !hasUnsavedChanges}
        className="gap-2"
      >
        {isSaving ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
        )}
        {isSaving ? 'Saving...' : 'Save'}
      </Button>

      {/* Divider */}
      <div className="w-px bg-border" />

      {/* Zoom controls */}
      <div className="flex rounded-md border bg-background">
        <button
          onClick={onZoomOut}
          className="p-2 hover:bg-muted rounded-l-md"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={onFitView}
          className="p-2 hover:bg-muted border-x"
          title="Fit view"
          aria-label="Fit view"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <button
          onClick={onZoomIn}
          className="p-2 hover:bg-muted rounded-r-md"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Minimap toggle */}
      <button
        onClick={onToggleMinimap}
        className={`p-2 rounded-md border ${showMinimap ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
        title="Toggle minimap"
        aria-label="Toggle minimap"
        aria-pressed={showMinimap}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </button>
    </div>
  );
}
