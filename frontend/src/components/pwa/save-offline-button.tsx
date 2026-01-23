'use client';

import { Download, Trash2, Loader2 } from 'lucide-react';
import { useOfflineReading } from '@/hooks/use-offline-reading';

interface SaveOfflineButtonProps {
  story: {
    storyId: string;
    title: string;
    author: string;
    coverImage?: string;
    segments: Array<{
      id: string;
      title: string;
      content: string;
      choices: Array<{
        id: string;
        text: string;
        targetSegmentId: string;
      }>;
    }>;
  };
}

export function SaveOfflineButton({ story }: SaveOfflineButtonProps) {
  const { saveStoryForOffline, removeOfflineStory, isStorySaved, isSaving } =
    useOfflineReading();

  const saved = isStorySaved(story.storyId);

  const handleToggle = async () => {
    if (saved) {
      await removeOfflineStory(story.storyId);
    } else {
      await saveStoryForOffline(story);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isSaving}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        saved
          ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      }`}
      title={saved ? 'Remove from offline reading' : 'Save for offline reading'}
    >
      {isSaving ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <Trash2 className="h-4 w-4" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {saved ? 'Remove offline' : 'Save offline'}
    </button>
  );
}
