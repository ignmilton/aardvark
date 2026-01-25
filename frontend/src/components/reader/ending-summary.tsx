'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Clock,
  Route,
  Bookmark,
  Share2,
  Twitter,
  RotateCcw,
  Home,
  Star,
  Copy,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EndingSummaryProps {
  storyTitle: string;
  storySlug: string;
  endingType: 'good' | 'bad' | 'neutral' | 'secret' | null;
  segmentsVisited: number;
  choicesMade: number;
  bookmarksCount: number;
  totalTimeSeconds: number;
  onRestart: () => void;
  onRate?: (rating: number) => void;
}

const ENDING_CONFIG = {
  good: {
    emoji: '🌟',
    title: 'Good Ending',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  bad: {
    emoji: '💀',
    title: 'Bad Ending',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  neutral: {
    emoji: '🔵',
    title: 'Neutral Ending',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  secret: {
    emoji: '🔮',
    title: 'Secret Ending',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function EndingSummary({
  storyTitle,
  storySlug,
  endingType,
  segmentsVisited,
  choicesMade,
  bookmarksCount,
  totalTimeSeconds,
  onRestart,
  onRate,
}: EndingSummaryProps) {
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const ending = endingType ? ENDING_CONFIG[endingType] : null;

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/story/${storySlug}`
    : '';

  const shareText = `I just finished "${storyTitle}" on Aardvark${ending ? ` with a ${ending.title}` : ''}! 📚`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${storyTitle} - Aardvark`,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const handleRating = (rating: number) => {
    setUserRating(rating);
    if (onRate) {
      onRate(rating);
    }
    toast.success(`Thank you for rating ${rating} stars!`);
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Ending Badge */}
      {ending && (
        <div className={`text-center p-6 rounded-xl border ${ending.bgColor} ${ending.borderColor}`}>
          <span className="text-4xl">{ending.emoji}</span>
          <h3 className={`text-xl font-bold mt-2 ${ending.color}`}>
            {ending.title} Achieved
          </h3>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <Route className="h-5 w-5 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold">{segmentsVisited}</p>
          <p className="text-xs text-muted-foreground">Segments Visited</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <Trophy className="h-5 w-5 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold">{choicesMade}</p>
          <p className="text-xs text-muted-foreground">Choices Made</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <Clock className="h-5 w-5 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold">{formatTime(totalTimeSeconds)}</p>
          <p className="text-xs text-muted-foreground">Time Spent</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <Bookmark className="h-5 w-5 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold">{bookmarksCount}</p>
          <p className="text-xs text-muted-foreground">Bookmarks</p>
        </div>
      </div>

      {/* Rating */}
      {onRate && (
        <div className="text-center p-6 border rounded-lg">
          <p className="font-medium mb-3">How would you rate this story?</p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-110"
                aria-label={`Rate ${star} stars`}
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    star <= (hoverRating || userRating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  }`}
                />
              </button>
            ))}
          </div>
          {userRating > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              You rated this story {userRating} out of 5 stars
            </p>
          )}
        </div>
      )}

      {/* Share */}
      <div className="text-center p-6 border rounded-lg">
        <p className="font-medium mb-3">Share your journey</p>
        <div className="flex justify-center gap-2 flex-wrap">
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleTwitterShare}>
            <Twitter className="h-4 w-4 mr-2" />
            Tweet
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="outline" size="lg" onClick={onRestart}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Start Over
        </Button>
        <Button asChild size="lg">
          <Link href={`/story/${storySlug}`}>
            View Story Details
          </Link>
        </Button>
        <Button variant="ghost" size="lg" asChild>
          <Link href="/">
            <Home className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
