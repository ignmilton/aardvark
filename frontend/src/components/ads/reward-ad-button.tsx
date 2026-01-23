'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RewardAdButtonProps {
  onCreditsEarned?: (amount: number, newBalance: number) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

interface AdState {
  isLoading: boolean;
  isPlaying: boolean;
  progress: number;
  error: string | null;
  cooldownRemaining: number;
}

const AD_DURATION = 30; // seconds
const COOLDOWN_DURATION = 600; // 10 minutes in seconds

export function RewardAdButton({
  onCreditsEarned,
  className,
  variant = 'outline',
  size = 'default',
}: RewardAdButtonProps) {
  const [adState, setAdState] = useState<AdState>({
    isLoading: false,
    isPlaying: false,
    progress: 0,
    error: null,
    cooldownRemaining: 0,
  });
  const [showAdDialog, setShowAdDialog] = useState(false);

  // Check cooldown on mount and periodically
  useEffect(() => {
    const checkCooldown = () => {
      const lastAdTime = localStorage.getItem('lastAdWatchTime');
      if (lastAdTime) {
        const elapsed = Math.floor((Date.now() - parseInt(lastAdTime, 10)) / 1000);
        const remaining = Math.max(0, COOLDOWN_DURATION - elapsed);
        setAdState((prev) => ({ ...prev, cooldownRemaining: remaining }));
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate ad playback progress
  useEffect(() => {
    if (!adState.isPlaying) return;

    const interval = setInterval(() => {
      setAdState((prev) => {
        const newProgress = prev.progress + (100 / AD_DURATION);
        if (newProgress >= 100) {
          clearInterval(interval);
          return { ...prev, progress: 100 };
        }
        return { ...prev, progress: newProgress };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [adState.isPlaying]);

  // Handle ad completion
  useEffect(() => {
    if (adState.progress >= 100 && adState.isPlaying) {
      handleAdComplete();
    }
  }, [adState.progress, adState.isPlaying]);

  const handleWatchAd = useCallback(async () => {
    if (adState.cooldownRemaining > 0) return;

    setAdState((prev) => ({ ...prev, isLoading: true, error: null }));
    setShowAdDialog(true);

    try {
      // Request ad session token from server (prevents client-side manipulation)
      const tokenResponse = await fetch('/api/credits/ad-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const tokenData = await tokenResponse.json();

      if (!tokenData.success) {
        throw new Error(tokenData.error || 'Cannot start ad session');
      }

      // Store session token for verification on completion
      sessionStorage.setItem('adSessionToken', tokenData.data.sessionToken);

      // Load real ad content via Google Publisher Tag if available
      if (typeof window !== 'undefined' && (window as any).googletag) {
        (window as any).googletag.cmd.push(() => {
          (window as any).googletag.display('reward-ad-slot');
        });
      }

      setAdState((prev) => ({
        ...prev,
        isLoading: false,
        isPlaying: true,
        progress: 0,
      }));
    } catch (error) {
      setAdState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load ad',
      }));
    }
  }, [adState.cooldownRemaining]);

  const handleAdComplete = async () => {
    setAdState((prev) => ({ ...prev, isPlaying: false }));

    try {
      const sessionToken = sessionStorage.getItem('adSessionToken');
      sessionStorage.removeItem('adSessionToken');

      // Call API to claim reward with session token for server-side verification
      const response = await fetch('/api/credits/ad-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adType: 'video_reward',
          adUnitId: process.env.NEXT_PUBLIC_AD_SLOT_VIDEO || 'reward_video_1',
          duration: AD_DURATION,
          completed: true,
          sessionToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Store cooldown timestamp
        localStorage.setItem('lastAdWatchTime', Date.now().toString());
        setAdState((prev) => ({
          ...prev,
          cooldownRemaining: COOLDOWN_DURATION,
        }));

        // Notify parent
        if (onCreditsEarned && data.data) {
          onCreditsEarned(data.data.creditsAwarded, data.data.newBalance);
        }

        // Close dialog after short delay
        setTimeout(() => {
          setShowAdDialog(false);
          setAdState((prev) => ({ ...prev, progress: 0 }));
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to claim reward');
      }
    } catch (error) {
      setAdState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to claim reward',
      }));
    }
  };

  const handleSkip = () => {
    setAdState((prev) => ({
      ...prev,
      isPlaying: false,
      progress: 0,
      error: 'Ad skipped - no credits earned',
    }));
  };

  const formatCooldown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isOnCooldown = adState.cooldownRemaining > 0;

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleWatchAd}
        disabled={isOnCooldown || adState.isLoading}
      >
        {isOnCooldown ? (
          <>
            <ClockIcon className="w-4 h-4 mr-2" />
            {formatCooldown(adState.cooldownRemaining)}
          </>
        ) : (
          <>
            <PlayIcon className="w-4 h-4 mr-2" />
            Watch Ad for Credits
          </>
        )}
      </Button>

      <Dialog open={showAdDialog} onOpenChange={(open) => !adState.isPlaying && setShowAdDialog(open)}>
        <DialogContent className="sm:max-w-md" hideCloseButton={adState.isPlaying}>
          <DialogHeader>
            <DialogTitle>
              {adState.isLoading
                ? 'Loading Ad...'
                : adState.progress >= 100
                ? 'Ad Complete!'
                : 'Watch to Earn Credits'}
            </DialogTitle>
          </DialogHeader>

          <div className="py-6">
            {adState.isLoading && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground">Loading advertisement...</p>
              </div>
            )}

            {adState.isPlaying && adState.progress < 100 && (
              <div className="space-y-4">
                {/* Placeholder for actual ad content */}
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <PlayIcon className="w-16 h-16 text-primary/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Advertisement Playing
                    </p>
                    <p className="text-2xl font-bold mt-2">
                      {Math.ceil(AD_DURATION - (adState.progress * AD_DURATION / 100))}s
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-1000 ease-linear"
                      style={{ width: `${adState.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Watch the full ad to earn credits</span>
                    <span>{Math.round(adState.progress)}%</span>
                  </div>
                </div>

                {/* Skip button (appears after 5 seconds) */}
                {adState.progress > 16 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkip}
                    className="w-full text-muted-foreground"
                  >
                    Skip (no reward)
                  </Button>
                )}
              </div>
            )}

            {adState.progress >= 100 && !adState.error && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckIcon className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold">+1 Credit Earned!</p>
                  <p className="text-sm text-muted-foreground">
                    Thanks for watching. Come back in 10 minutes for more!
                  </p>
                </div>
              </div>
            )}

            {adState.error && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <XIcon className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold">No Credits Earned</p>
                  <p className="text-sm text-muted-foreground">{adState.error}</p>
                </div>
                <Button variant="outline" onClick={() => setShowAdDialog(false)}>
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Icons
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
