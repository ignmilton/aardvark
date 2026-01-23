'use client';

import { useCallback, useEffect, useRef } from 'react';

const AUTOSAVE_INTERVAL_MS = 5000; // Save every 5 seconds
const DRAFT_PREFIX = 'aardvark_draft_';

export interface DraftData {
  title: string;
  contentHtml: string;
  contentText: string;
  isEnding: boolean;
  endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;
  savedAt: number;
}

/**
 * Generates a storage key for a draft.
 * Uses storyId + segmentId to uniquely identify what's being edited.
 */
function getDraftKey(storyId: string, segmentId?: string): string {
  return `${DRAFT_PREFIX}${storyId}_${segmentId || 'new'}`;
}

/**
 * Hook for autosaving editor content to localStorage with draft recovery.
 */
export function useAutosave(
  storyId: string,
  segmentId: string | undefined,
  isActive: boolean,
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef = useRef<DraftData | null>(null);

  const key = getDraftKey(storyId, segmentId);

  /**
   * Save the current draft data to localStorage.
   */
  const saveDraft = useCallback(
    (data: Omit<DraftData, 'savedAt'>) => {
      if (!isActive) return;
      const draft: DraftData = { ...data, savedAt: Date.now() };
      dataRef.current = draft;
      try {
        localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        // localStorage might be full or unavailable
      }
    },
    [key, isActive],
  );

  /**
   * Load a saved draft from localStorage if it exists.
   */
  const loadDraft = useCallback((): DraftData | null => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      const draft: DraftData = JSON.parse(stored);
      // Only return drafts less than 24 hours old
      if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return null;
      }
      return draft;
    } catch {
      return null;
    }
  }, [key]);

  /**
   * Clear the saved draft.
   */
  const clearDraft = useCallback(() => {
    dataRef.current = null;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key]);

  /**
   * Check if a draft exists without loading full data.
   */
  const hasDraft = useCallback((): boolean => {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }, [key]);

  // Set up autosave interval
  useEffect(() => {
    if (!isActive) return;

    intervalRef.current = setInterval(() => {
      if (dataRef.current) {
        try {
          localStorage.setItem(key, JSON.stringify(dataRef.current));
        } catch {
          // ignore
        }
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [key, isActive]);

  return { saveDraft, loadDraft, clearDraft, hasDraft };
}
