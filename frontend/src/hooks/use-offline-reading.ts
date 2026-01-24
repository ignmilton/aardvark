'use client';

import { useState, useEffect, useCallback } from 'react';

interface OfflineSegment {
  id: string;
  title: string;
  content: string;
  choices: Array<{
    id: string;
    text: string;
    targetSegmentId: string;
  }>;
}

interface OfflineStory {
  storyId: string;
  title: string;
  author: string;
  coverImage?: string;
  segments: OfflineSegment[];
  savedAt: number;
}

function sendMessageToSW<T>(type: string, payload: any): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('No active service worker'));
      return;
    }

    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      resolve(event.data as T);
    };

    navigator.serviceWorker.controller.postMessage(
      { type, payload },
      [messageChannel.port2]
    );

    // Timeout after 5 seconds
    setTimeout(() => reject(new Error('Service worker message timeout')), 5000);
  });
}

export function useOfflineReading() {
  const [isOnline, setIsOnline] = useState(true);
  const [savedStories, setSavedStories] = useState<OfflineStory[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load saved stories list
    loadSavedStories();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadSavedStories = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      await navigator.serviceWorker.ready;
      const result = await sendMessageToSW<{ stories: OfflineStory[] }>(
        'LIST_OFFLINE_STORIES',
        {}
      );
      setSavedStories(result.stories || []);
    } catch {
      // Service worker not ready yet, use localStorage fallback
      const stored = localStorage.getItem('offline-stories');
      if (stored) {
        try {
          setSavedStories(JSON.parse(stored));
        } catch {
          // Corrupted localStorage data, ignore
        }
      }
    }
  }, []);

  const saveStoryForOffline = useCallback(
    async (story: {
      storyId: string;
      title: string;
      author: string;
      coverImage?: string;
      segments: OfflineSegment[];
    }) => {
      setIsSaving(true);
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          await sendMessageToSW('SAVE_STORY_OFFLINE', {
            storyId: story.storyId,
            segments: story.segments,
          });
        }

        // Also save to localStorage as fallback
        const offlineStory: OfflineStory = {
          ...story,
          savedAt: Date.now(),
        };

        let existing: OfflineStory[] = [];
        try {
          existing = JSON.parse(localStorage.getItem('offline-stories') || '[]');
        } catch {
          // Corrupted data, start fresh
        }
        const updated = [
          ...existing.filter((s: OfflineStory) => s.storyId !== story.storyId),
          offlineStory,
        ];
        localStorage.setItem('offline-stories', JSON.stringify(updated));

        setSavedStories(updated);
        return true;
      } catch (error) {
        console.error('Failed to save story offline:', error);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const removeOfflineStory = useCallback(async (storyId: string) => {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        await sendMessageToSW('REMOVE_OFFLINE_STORY', { storyId });
      }

      let existing: OfflineStory[] = [];
      try {
        existing = JSON.parse(localStorage.getItem('offline-stories') || '[]');
      } catch {
        // Corrupted data, start fresh
      }
      const updated = existing.filter((s: OfflineStory) => s.storyId !== storyId);
      localStorage.setItem('offline-stories', JSON.stringify(updated));

      setSavedStories(updated);
    } catch (error) {
      console.error('Failed to remove offline story:', error);
    }
  }, []);

  const getOfflineStory = useCallback(async (storyId: string): Promise<OfflineStory | null> => {
    // Try service worker first
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        const result = await sendMessageToSW<{ story: OfflineStory | null }>(
          'GET_OFFLINE_STORY',
          { storyId }
        );
        if (result.story) return result.story;
      } catch {
        // Fall through to localStorage
      }
    }

    // Fallback to localStorage
    try {
      const stored: OfflineStory[] = JSON.parse(localStorage.getItem('offline-stories') || '[]');
      return stored.find((s: OfflineStory) => s.storyId === storyId) || null;
    } catch {
      return null;
    }
  }, []);

  const isStorySaved = useCallback(
    (storyId: string) => savedStories.some((s) => s.storyId === storyId),
    [savedStories]
  );

  const syncProgress = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync?.register('sync-reading-progress');
  }, []);

  return {
    isOnline,
    savedStories,
    isSaving,
    saveStoryForOffline,
    removeOfflineStory,
    getOfflineStory,
    isStorySaved,
    syncProgress,
  };
}
